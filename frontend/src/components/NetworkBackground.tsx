import { useEffect, useRef } from 'react'

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  radius: number
  baseX: number
  baseY: number
  layer: 1 | 2 | 3        // depth layer: 1=back, 2=mid, 3=front
  opacity: number
}

interface TrailParticle {
  x: number
  y: number
  radius: number
  opacity: number
  decay: number            // how fast it fades (0.02-0.05)
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
  const mouseRef = useRef<Mouse>({
    x: null,
    y: null,
    speed: 0,
    lastX: null,
    lastY: null,
  })
  const trailRef = useRef<TrailParticle[]>([])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animationId: number
    let particles: Particle[] = []

    // Layer configuration — each layer has different speed and opacity
    const LAYERS = {
      1: { speedMult: 0.3, opacity: 0.3, maxDist: 120, mouseEffect: 0.3 },
      2: { speedMult: 0.6, opacity: 0.6, maxDist: 150, mouseEffect: 0.7 },
      3: { speedMult: 1.0, opacity: 1.0, maxDist: 180, mouseEffect: 1.0 },
    }

    const PARTICLE_COUNT = 90
    const MOUSE_RADIUS = 180
    const REPULSION_STRENGTH = 3.5
    const RETURN_SPEED = 0.04
    const PARTICLE_COLOR = '0, 194, 255'
    const LINE_COLOR = '0, 194, 255'
    const BG_COLOR = '#0A0E17'
    const MAX_TRAIL_PARTICLES = 120

    function resize() {
      canvas!.width = window.innerWidth
      canvas!.height = window.innerHeight
    }

    function createParticles() {
      particles = []
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const x = Math.random() * canvas!.width
        const y = Math.random() * canvas!.height

        // Distribute particles across layers: 40% back, 35% mid, 25% front
        const rand = Math.random()
        const layer: 1 | 2 | 3 = rand < 0.4 ? 1 : rand < 0.75 ? 2 : 3
        const layerConfig = LAYERS[layer]

        particles.push({
          x,
          y,
          baseX: x,
          baseY: y,
          vx: (Math.random() - 0.5) * 0.6 * layerConfig.speedMult,
          vy: (Math.random() - 0.5) * 0.6 * layerConfig.speedMult,
          radius: layer === 1 ? Math.random() * 1 + 0.5
                : layer === 2 ? Math.random() * 1.5 + 1
                : Math.random() * 2 + 1.5,
          layer,
          opacity: layerConfig.opacity,
        })
      }
    }

    function spawnTrailParticles(x: number, y: number, speed: number) {
      // Spawn 1-3 trail particles based on mouse speed
      const count = Math.min(Math.floor(speed / 8) + 1, 3)
      
      for (let i = 0; i < count; i++) {
        if (trailRef.current.length >= MAX_TRAIL_PARTICLES) {
          trailRef.current.shift()
        }

        trailRef.current.push({
          x: x + (Math.random() - 0.5) * 8,
          y: y + (Math.random() - 0.5) * 8,
          radius: Math.random() * 2.5 + 0.5,
          opacity: Math.random() * 0.6 + 0.4,
          decay: Math.random() * 0.03 + 0.02,
        })
      }
    }

    function drawFrame() {
      const mouse = mouseRef.current

      // Calculate mouse speed
      if (
        mouse.lastX !== null &&
        mouse.lastY !== null &&
        mouse.x !== null &&
        mouse.y !== null
      ) {
        const dx = mouse.x - mouse.lastX
        const dy = mouse.y - mouse.lastY
        mouse.speed = Math.sqrt(dx * dx + dy * dy)

        // Spawn trail particles when mouse moves
        if (mouse.speed > 2) {
          spawnTrailParticles(mouse.x, mouse.y, mouse.speed)
        }
      }

      mouse.lastX = mouse.x
      mouse.lastY = mouse.y

      // Clear background
      ctx!.fillStyle = BG_COLOR
      ctx!.fillRect(0, 0, canvas!.width, canvas!.height)

      // Draw trail particles first (behind everything)
      const trail = trailRef.current
      for (let i = trail.length - 1; i >= 0; i--) {
        const t = trail[i]
        t.opacity -= t.decay

        if (t.opacity <= 0) {
          trail.splice(i, 1)
          continue
        }

        // Draw glowing trail particle
        const gradient = ctx!.createRadialGradient(t.x, t.y, 0, t.x, t.y, t.radius * 3)
        gradient.addColorStop(0, `rgba(0, 220, 255, ${t.opacity})`)
        gradient.addColorStop(0.4, `rgba(0, 194, 255, ${t.opacity * 0.5})`)
        gradient.addColorStop(1, `rgba(0, 194, 255, 0)`)

        ctx!.beginPath()
        ctx!.arc(t.x, t.y, t.radius * 3, 0, Math.PI * 2)
        ctx!.fillStyle = gradient
        ctx!.fill()
      }

      // Draw particles layer by layer (back to front for correct depth)
      for (const layerNum of [1, 2, 3] as const) {
        const layerConfig = LAYERS[layerNum]
        const layerParticles = particles.filter(p => p.layer === layerNum)

        // Update particles in this layer
        for (const p of layerParticles) {
          // Natural drift
          p.baseX += p.vx
          p.baseY += p.vy

          // Bounce off edges
          if (p.baseX < 0 || p.baseX > canvas!.width) p.vx *= -1
          if (p.baseY < 0 || p.baseY > canvas!.height) p.vy *= -1

          // Mouse repulsion — scaled by layer
          if (mouse.x !== null && mouse.y !== null) {
            const dx = p.x - mouse.x
            const dy = p.y - mouse.y
            const distance = Math.sqrt(dx * dx + dy * dy)
            const effectiveRadius = MOUSE_RADIUS * layerConfig.mouseEffect

            if (distance < effectiveRadius && distance > 0) {
              const force = (effectiveRadius - distance) / effectiveRadius
              const speedMult = 1 + mouse.speed * 0.08
              const repulsion = force * REPULSION_STRENGTH * speedMult * layerConfig.mouseEffect
              p.x += (dx / distance) * repulsion
              p.y += (dy / distance) * repulsion
            }
          }

          // Return to base position
          p.x += (p.baseX - p.x) * RETURN_SPEED
          p.y += (p.baseY - p.y) * RETURN_SPEED

          // Draw particle with layer opacity
          ctx!.beginPath()
          ctx!.arc(p.x, p.y, p.radius, 0, Math.PI * 2)
          ctx!.fillStyle = `rgba(${PARTICLE_COLOR}, ${p.opacity * 0.8})`
          ctx!.fill()
        }

        // Draw connections within this layer only
        const maxDist = layerConfig.maxDist
        for (let i = 0; i < layerParticles.length; i++) {
          for (let j = i + 1; j < layerParticles.length; j++) {
            const dx = layerParticles[i].x - layerParticles[j].x
            const dy = layerParticles[i].y - layerParticles[j].y
            const distance = Math.sqrt(dx * dx + dy * dy)

            if (distance < maxDist) {
              const opacity =
                (1 - distance / maxDist) * 0.5 * layerConfig.opacity
              ctx!.beginPath()
              ctx!.moveTo(layerParticles[i].x, layerParticles[i].y)
              ctx!.lineTo(layerParticles[j].x, layerParticles[j].y)
              ctx!.strokeStyle = `rgba(${LINE_COLOR}, ${opacity})`
              ctx!.lineWidth = layerNum === 1 ? 0.4 : layerNum === 2 ? 0.6 : 0.9
              ctx!.stroke()
            }
          }
        }
      }

      // Draw cursor web — glowing lines from cursor to nearby front-layer nodes
      if (mouse.x !== null && mouse.y !== null) {
        // Glowing cursor dot — grows with speed
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

        // Web lines to nearby particles — stronger effect on front layer
        for (const p of particles) {
          const layerConfig = LAYERS[p.layer]
          const dx = p.x - mouse.x
          const dy = p.y - mouse.y
          const distance = Math.sqrt(dx * dx + dy * dy)
          const effectiveRadius = MOUSE_RADIUS * layerConfig.mouseEffect

          if (distance < effectiveRadius) {
            const opacity =
              (1 - distance / effectiveRadius) * 0.9 * layerConfig.opacity
            const lineWidth =
              (1 - distance / effectiveRadius) * 1.5 * layerConfig.opacity

            ctx!.beginPath()
            ctx!.moveTo(mouse.x, mouse.y)
            ctx!.lineTo(p.x, p.y)
            ctx!.strokeStyle = `rgba(${LINE_COLOR}, ${opacity})`
            ctx!.lineWidth = lineWidth
            ctx!.stroke()

            // Brighten nearby particles
            ctx!.beginPath()
            ctx!.arc(p.x, p.y, p.radius + 1.5, 0, Math.PI * 2)
            ctx!.fillStyle = `rgba(${PARTICLE_COLOR}, ${opacity})`
            ctx!.fill()
          }
        }
      }

      animationId = requestAnimationFrame(drawFrame)
    }

    // Event handlers
    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current.x = e.clientX
      mouseRef.current.y = e.clientY
    }

    const handleMouseLeave = () => {
      mouseRef.current.x = null
      mouseRef.current.y = null
      mouseRef.current.speed = 0
    }

    const handleResize = () => {
      resize()
      createParticles()
    }

    // Initialize
    resize()
    createParticles()
    drawFrame()

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseleave', handleMouseLeave)
    window.addEventListener('resize', handleResize)

    return () => {
      cancelAnimationFrame(animationId)
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseleave', handleMouseLeave)
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-0"
      style={{ display: 'block', cursor: 'none' }}
    />
  )
}
