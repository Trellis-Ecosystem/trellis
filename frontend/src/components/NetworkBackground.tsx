import { useEffect, useRef } from 'react'

type Layer = 0 | 1 | 2

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  radius: number
  baseX: number
  baseY: number
  layer: Layer
}

interface Mouse {
  x: number | null
  y: number | null
  speed: number
  lastX: number | null
  lastY: number | null
}

type LayerBuckets = [Particle[], Particle[], Particle[]]

export function NetworkBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
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
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animationId: number
    let particles: Particle[] = []
    let resizeTimeoutId: ReturnType<typeof setTimeout> | null = null
    const RESIZE_DEBOUNCE_MS = 200

    const layerBuckets: LayerBuckets = [[], [], []]

    const PARTICLE_COUNT = 90
    const MAX_DISTANCE = 160
    const MOUSE_RADIUS = 180
    const REPULSION_STRENGTH = 3.5
    const RETURN_SPEED = 0.04
    const PARTICLE_COLOR = '0, 194, 255'
    const LINE_COLOR = '0, 194, 255'
    const BG_COLOR = '#0A0E17'

    function resize() {
      const dpr = window.devicePixelRatio || 1
      const cssW = window.innerWidth
      const cssH = window.innerHeight
      canvas.width = cssW * dpr
      canvas.height = cssH * dpr
      canvas.style.width = `${cssW}px`
      canvas.style.height = `${cssH}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    function rebuildBuckets() {
      layerBuckets[0].length = 0
      layerBuckets[1].length = 0
      layerBuckets[2].length = 0

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i]
        layerBuckets[p.layer].push(p)
      }
    }

    function createParticles() {
      particles = []
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const x = Math.random() * canvas!.width
        const y = Math.random() * canvas!.height
        const layer = (i % 3) as Layer
        particles.push({
          x,
          y,
          baseX: x,
          baseY: y,
          vx: (Math.random() - 0.5) * 0.6,
          vy: (Math.random() - 0.5) * 0.6,
          radius: Math.random() * 2 + 1,
          layer,
        })
      }
      rebuildBuckets()
    }

    function drawFrame(timestamp: number) {
      const mouse = mouseRef.current
      const cssW = window.innerWidth
      const cssH = window.innerHeight

      if (mouse.lastX !== null && mouse.lastY !== null && mouse.x !== null && mouse.y !== null) {
        const dx = mouse.x - mouse.lastX
        const dy = mouse.y - mouse.lastY
        mouse.speed = Math.sqrt(dx * dx + dy * dy)
      }
      mouse.lastX = mouse.x
      mouse.lastY = mouse.y

      ctx.fillStyle = BG_COLOR
      ctx.fillRect(0, 0, cssW, cssH)

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i]

        p.baseX += p.vx
        p.baseY += p.vy

        if (p.baseX < 0 || p.baseX > cssW) p.vx *= -1
        if (p.baseY < 0 || p.baseY > cssH) p.vy *= -1

        if (mouse.x !== null && mouse.y !== null) {
          const dx = p.x - mouse.x
          const dy = p.y - mouse.y
          const distance = Math.sqrt(dx * dx + dy * dy)

          if (distance < MOUSE_RADIUS) {
            const force = (MOUSE_RADIUS - distance) / MOUSE_RADIUS
            const speedMultiplier = 1 + mouse.speed * 0.08
            const repulsion = force * REPULSION_STRENGTH * speedMultiplier
            p.x += (dx / distance) * repulsion
            p.y += (dy / distance) * repulsion
          }
        }

        p.x += (p.baseX - p.x) * RETURN_SPEED
        p.y += (p.baseY - p.y) * RETURN_SPEED

        const layerOpacity = 0.5 + p.layer * 0.15
        ctx!.beginPath()
        ctx!.arc(p.x, p.y, p.radius, 0, Math.PI * 2)
        ctx!.fillStyle = `rgba(${PARTICLE_COLOR}, ${layerOpacity})`
        ctx!.fill()
      }

      for (let layer = 0; layer < 3; layer++) {
        const bucket = layerBuckets[layer]
        for (let i = 0; i < bucket.length; i++) {
          for (let j = i + 1; j < bucket.length; j++) {
            const dx = bucket[i].x - bucket[j].x
            const dy = bucket[i].y - bucket[j].y
            const distance = Math.sqrt(dx * dx + dy * dy)

            if (distance < MAX_DISTANCE) {
              const opacity = (1 - distance / MAX_DISTANCE) * 0.5
              ctx!.beginPath()
              ctx!.moveTo(bucket[i].x, bucket[i].y)
              ctx!.lineTo(bucket[j].x, bucket[j].y)
              ctx!.strokeStyle = `rgba(${LINE_COLOR}, ${opacity})`
              ctx!.lineWidth = 0.8
              ctx!.stroke()
            }
          }
        }
      }

      if (mouse.x !== null && mouse.y !== null) {
        const glowRadius = 6 + mouse.speed * 0.3
        const gradient = ctx.createRadialGradient(
          mouse.x, mouse.y, 0,
          mouse.x, mouse.y, glowRadius * 3,
        )
        gradient.addColorStop(0, 'rgba(0, 194, 255, 0.9)')
        gradient.addColorStop(0.4, 'rgba(0, 194, 255, 0.4)')
        gradient.addColorStop(1, 'rgba(0, 194, 255, 0)')
        ctx.beginPath()
        ctx.arc(mouse.x, mouse.y, glowRadius * 3, 0, Math.PI * 2)
        ctx.fillStyle = gradient
        ctx.fill()

        for (let i = 0; i < particles.length; i++) {
          const p = particles[i]
          const dx = p.x - mouse.x
          const dy = p.y - mouse.y
          const distance = Math.sqrt(dx * dx + dy * dy)

          if (distance < MOUSE_RADIUS) {
            const opacity = (1 - distance / MOUSE_RADIUS) * 0.9
            const lineWidth = (1 - distance / MOUSE_RADIUS) * 1.5

            ctx!.beginPath()
            ctx!.moveTo(mouse.x, mouse.y)
            ctx!.lineTo(p.x, p.y)
            ctx!.strokeStyle = `rgba(${LINE_COLOR}, ${opacity})`
            ctx!.lineWidth = lineWidth
            ctx!.stroke()

            ctx!.beginPath()
            ctx!.arc(p.x, p.y, p.radius + 1.5, 0, Math.PI * 2)
            ctx!.fillStyle = `rgba(${PARTICLE_COLOR}, ${opacity})`
            ctx!.fill()
          }
        }
      }

      animationId = requestAnimationFrame(drawFrame)
    }

    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current.x = e.clientX
      mouseRef.current.y = e.clientY
    }

    const handleMouseLeave = () => {
      mouseRef.current.x = null
      mouseRef.current.y = null
      mouseRef.current.speed = 0
    }

    const recalibrateParticles = (oldWidth: number, oldHeight: number) => {
      const newWidth = canvas!.width
      const newHeight = canvas!.height
      if (oldWidth <= 0 || oldHeight <= 0) {
        createParticles()
        return
      }
      const scaleX = newWidth / oldWidth
      const scaleY = newHeight / oldHeight
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i]
        p.x *= scaleX
        p.y *= scaleY
        p.baseX *= scaleX
        p.baseY *= scaleY
      }
    }

    const performResize = () => {
      const dpr = window.devicePixelRatio || 1
      const nextWidth = Math.round(window.innerWidth * dpr)
      const nextHeight = Math.round(window.innerHeight * dpr)
      // Skip the expensive resize + particle recalibration entirely when the
      // physical canvas size hasn't actually changed (e.g. devtools repaint,
      // toolbar show/hide firing a resize event with identical dimensions).
      if (nextWidth === canvas!.width && nextHeight === canvas!.height) return

      const oldWidth = canvas!.width
      const oldHeight = canvas!.height
      resize()
      recalibrateParticles(oldWidth, oldHeight)
    }

    const handleResize = () => {
      if (resizeTimeoutId !== null) clearTimeout(resizeTimeoutId)
      resizeTimeoutId = setTimeout(performResize, RESIZE_DEBOUNCE_MS)
    }

    const handleVisibilityChange = () => {
      if (document.hidden) {
        cancelAnimationFrame(animationId)
      } else {
        animationId = requestAnimationFrame(drawFrame)
      }
    }

    resize()
    createParticles()
    animationId = requestAnimationFrame(drawFrame)

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseleave', handleMouseLeave)
    window.addEventListener('resize', handleResize)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      cancelAnimationFrame(animationId)
      if (resizeTimeoutId !== null) clearTimeout(resizeTimeoutId)
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseleave', handleMouseLeave)
      window.removeEventListener('resize', handleResize)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
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
