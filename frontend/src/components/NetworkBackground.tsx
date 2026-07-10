import { useEffect, useRef } from 'react'
import { useTheme } from '../context/useTheme'

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  radius: number
  baseX: number
  baseY: number
}

interface Mouse {
  x: number | null
  y: number | null
  speed: number
  lastX: number | null
  lastY: number | null
}

export function NetworkBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { theme } = useTheme()
  const mouseRef = useRef<Mouse>({
    x: null,
    y: null,
    speed: 0,
    lastX: null,
    lastY: null,
  })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas!.getContext('2d')
    if (!ctx) return

    let animationId: number
    let particles: Particle[] = []

    const PARTICLE_COUNT = 90
    const MAX_DISTANCE = 160
    const MOUSE_RADIUS = 180
    const REPULSION_STRENGTH = 3.5
    const RETURN_SPEED = 0.04
    const PARTICLE_COLOR = '0, 194, 255'
    const LINE_COLOR = '0, 194, 255'
    const BG_COLOR = theme === 'dark' ? '#0A0E17' : '#F8FAFC'
    const PARTICLE_OPACITY = theme === 'dark' ? 0.8 : 0.45
    const LINE_OPACITY_MULTIPLIER = theme === 'dark' ? 0.5 : 0.28

    function resize() {
      canvas!.width = window.innerWidth
      canvas!.height = window.innerHeight
    }

    function createParticles() {
      particles = []
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const x = Math.random() * canvas!.width
        const y = Math.random() * canvas!.height
        particles.push({
          x,
          y,
          baseX: x,
          baseY: y,
          vx: (Math.random() - 0.5) * 0.6,
          vy: (Math.random() - 0.5) * 0.6,
          radius: Math.random() * 2 + 1,
        })
      }
    }

    function drawFrame() {
      const mouse = mouseRef.current

      // Calculate mouse speed
      if (mouse.lastX !== null && mouse.lastY !== null && mouse.x !== null && mouse.y !== null) {
        const dx = mouse.x - mouse.lastX
        const dy = mouse.y - mouse.lastY
        mouse.speed = Math.sqrt(dx * dx + dy * dy)
      }
      mouse.lastX = mouse.x
      mouse.lastY = mouse.y

      // Clear background
      ctx!.fillStyle = BG_COLOR
      ctx!.fillRect(0, 0, canvas!.width, canvas!.height)

      // Update and draw particles
      for (const p of particles) {
        // Natural drift movement
        p.baseX += p.vx
        p.baseY += p.vy

        // Bounce base position off edges
        if (p.baseX < 0 || p.baseX > canvas!.width) p.vx *= -1
        if (p.baseY < 0 || p.baseY > canvas!.height) p.vy *= -1

        // Mouse repulsion
        if (mouse.x !== null && mouse.y !== null) {
          const dx = p.x - mouse.x
          const dy = p.y - mouse.y
          const distance = Math.sqrt(dx * dx + dy * dy)

          if (distance < MOUSE_RADIUS) {
            // Stronger repulsion when mouse moves faster
            const force = (MOUSE_RADIUS - distance) / MOUSE_RADIUS
            const speedMultiplier = 1 + mouse.speed * 0.08
            const repulsion = force * REPULSION_STRENGTH * speedMultiplier
            p.x += (dx / distance) * repulsion
            p.y += (dy / distance) * repulsion
          }
        }

        // Gently return toward base position
        p.x += (p.baseX - p.x) * RETURN_SPEED
        p.y += (p.baseY - p.y) * RETURN_SPEED

        // Draw particle dot
        ctx!.beginPath()
        ctx!.arc(p.x, p.y, p.radius, 0, Math.PI * 2)
        ctx!.fillStyle = `rgba(${PARTICLE_COLOR}, ${PARTICLE_OPACITY})`
        ctx!.fill()
      }

      // Draw standard connecting lines between particles
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x
          const dy = particles[i].y - particles[j].y
          const distance = Math.sqrt(dx * dx + dy * dy)

          if (distance < MAX_DISTANCE) {
            const opacity = (1 - distance / MAX_DISTANCE) * LINE_OPACITY_MULTIPLIER
            ctx!.beginPath()
            ctx!.moveTo(particles[i].x, particles[i].y)
            ctx!.lineTo(particles[j].x, particles[j].y)
            ctx!.strokeStyle = `rgba(${LINE_COLOR}, ${opacity})`
            ctx!.lineWidth = 0.8
            ctx!.stroke()
          }
        }
      }

      // Draw cursor web — glowing lines from cursor to nearby nodes
      if (mouse.x !== null && mouse.y !== null) {
        // Draw glowing cursor dot
        const glowRadius = 6 + mouse.speed * 0.3
        const gradient = ctx!.createRadialGradient(
          mouse.x, mouse.y, 0,
          mouse.x, mouse.y, glowRadius * 3
        )
        gradient.addColorStop(0, 'rgba(0, 194, 255, 0.9)')
        gradient.addColorStop(0.4, 'rgba(0, 194, 255, 0.4)')
        gradient.addColorStop(1, 'rgba(0, 194, 255, 0)')
        ctx!.beginPath()
        ctx!.arc(mouse.x, mouse.y, glowRadius * 3, 0, Math.PI * 2)
        ctx!.fillStyle = gradient
        ctx!.fill()

        // Draw web lines from cursor to nearby particles
        for (const p of particles) {
          const dx = p.x - mouse.x
          const dy = p.y - mouse.y
          const distance = Math.sqrt(dx * dx + dy * dy)

          if (distance < MOUSE_RADIUS) {
            // Brighter and thicker when closer
            const opacity = (1 - distance / MOUSE_RADIUS) * 0.9
            const lineWidth = (1 - distance / MOUSE_RADIUS) * 1.5

            ctx!.beginPath()
            ctx!.moveTo(mouse.x, mouse.y)
            ctx!.lineTo(p.x, p.y)
            ctx!.strokeStyle = `rgba(${LINE_COLOR}, ${opacity})`
            ctx!.lineWidth = lineWidth
            ctx!.stroke()

            // Make nearby particles glow brighter
            ctx!.beginPath()
            ctx!.arc(p.x, p.y, p.radius + 1.5, 0, Math.PI * 2)
            ctx!.fillStyle = `rgba(${PARTICLE_COLOR}, ${opacity})`
            ctx!.fill()
          }
        }
      }

      animationId = requestAnimationFrame(drawFrame)
    }

    // Mouse move handler
    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current.x = e.clientX
      mouseRef.current.y = e.clientY
    }

    // Mouse leave handler — cursor leaves window
    const handleMouseLeave = () => {
      mouseRef.current.x = null
      mouseRef.current.y = null
      mouseRef.current.speed = 0
    }

    // Window resize handler
    const handleResize = () => {
      resize()
      createParticles()
    }

    // Initialize
    resize()
    createParticles()
    drawFrame()

    // Event listeners
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseleave', handleMouseLeave)
    window.addEventListener('resize', handleResize)

    // Cleanup
    return () => {
      cancelAnimationFrame(animationId)
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseleave', handleMouseLeave)
      window.removeEventListener('resize', handleResize)
    }
  }, [theme])

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 z-0 transition-opacity duration-200 dark:opacity-100 opacity-90"
      style={{ display: 'block', cursor: 'none' }}
    />
  )
}
