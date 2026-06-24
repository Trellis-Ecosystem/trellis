import { useEffect, useRef } from 'react'

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  radius: number
}

export function NetworkBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animationId: number
    let particles: Particle[] = []

    const PARTICLE_COUNT = 90
    const MAX_DISTANCE = 160
    const PARTICLE_COLOR = '0, 194, 255'      // cyan #00C2FF as RGB
    const LINE_COLOR = '0, 194, 255'
    const BG_COLOR = '#0A0E17'

    function resize() {
      canvas!.width = window.innerWidth
      canvas!.height = window.innerHeight
    }

    function createParticles() {
      particles = []
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        particles.push({
          x: Math.random() * canvas!.width,
          y: Math.random() * canvas!.height,
          vx: (Math.random() - 0.5) * 0.6,
          vy: (Math.random() - 0.5) * 0.6,
          radius: Math.random() * 2 + 1,
        })
      }
    }

    function drawFrame() {
      // Clear with background color
      ctx!.fillStyle = BG_COLOR
      ctx!.fillRect(0, 0, canvas!.width, canvas!.height)

      // Update and draw particles
      for (const p of particles) {
        // Move
        p.x += p.vx
        p.y += p.vy

        // Bounce off edges
        if (p.x < 0 || p.x > canvas!.width) p.vx *= -1
        if (p.y < 0 || p.y > canvas!.height) p.vy *= -1

        // Draw dot
        ctx!.beginPath()
        ctx!.arc(p.x, p.y, p.radius, 0, Math.PI * 2)
        ctx!.fillStyle = `rgba(${PARTICLE_COLOR}, 0.8)`
        ctx!.fill()
      }

      // Draw connecting lines
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x
          const dy = particles[i].y - particles[j].y
          const distance = Math.sqrt(dx * dx + dy * dy)

          if (distance < MAX_DISTANCE) {
            // Opacity fades with distance
            const opacity = (1 - distance / MAX_DISTANCE) * 0.5
            ctx!.beginPath()
            ctx!.moveTo(particles[i].x, particles[i].y)
            ctx!.lineTo(particles[j].x, particles[j].y)
            ctx!.strokeStyle = `rgba(${LINE_COLOR}, ${opacity})`
            ctx!.lineWidth = 0.8
            ctx!.stroke()
          }
        }
      }

      animationId = requestAnimationFrame(drawFrame)
    }

    // Initialize
    resize()
    createParticles()
    drawFrame()

    // Handle window resize
    const handleResize = () => {
      resize()
      createParticles()
    }
    window.addEventListener('resize', handleResize)

    // Cleanup on unmount
    return () => {
      cancelAnimationFrame(animationId)
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 z-0"
      style={{ display: 'block' }}
    />
  )
}
