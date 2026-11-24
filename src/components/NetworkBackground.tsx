import { useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
}

const PARTICLE_COUNT = 60;
const CONNECT_DISTANCE = 140;
const MOUSE_RADIUS = 120;

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

function createParticles(width: number, height: number): Particle[] {
  const particles: Particle[] = [];
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    particles.push({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      radius: Math.random() * 1.5 + 0.5,
    });
  }
  return particles;
}

function drawFrame(
  ctx: CanvasRenderingContext2D,
  particles: Particle[],
  width: number,
  height: number,
  mouse: { x: number; y: number } | null,
) {
  ctx.clearRect(0, 0, width, height);

  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    for (let j = i + 1; j < particles.length; j++) {
      const q = particles[j];
      const dx = p.x - q.x;
      const dy = p.y - q.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < CONNECT_DISTANCE) {
        ctx.strokeStyle = `rgba(99, 102, 241, ${0.15 * (1 - dist / CONNECT_DISTANCE)})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(q.x, q.y);
        ctx.stroke();
      }
    }
  }

  for (const p of particles) {
    ctx.fillStyle = 'rgba(99, 102, 241, 0.6)';
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fill();
  }

  if (mouse) {
    ctx.strokeStyle = 'rgba(99, 102, 241, 0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(mouse.x, mouse.y, MOUSE_RADIUS, 0, Math.PI * 2);
    ctx.stroke();
  }
}

export default function NetworkBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let particles: Particle[] = [];
    let animationFrame = 0;
    let mouse: { x: number; y: number } | null = null;

    const resize = () => {
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      particles = createParticles(width, height);
    };

    const step = () => {
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;

        if (mouse) {
          const dx = p.x - mouse.x;
          const dy = p.y - mouse.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < MOUSE_RADIUS && dist > 0) {
            const force = (MOUSE_RADIUS - dist) / MOUSE_RADIUS;
            p.x += (dx / dist) * force * 2;
            p.y += (dy / dist) * force * 2;
          }
        }

        if (p.x < 0 || p.x > width) p.vx *= -1;
        if (p.y < 0 || p.y > height) p.vy *= -1;
        p.x = Math.max(0, Math.min(width, p.x));
        p.y = Math.max(0, Math.min(height, p.y));
      }

      drawFrame(ctx, particles, width, height, mouse);
      animationFrame = requestAnimationFrame(step);
    };

    const handleMouseMove = (event: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    };

    const handleMouseLeave = () => {
      mouse = null;
    };

    resize();

    if (prefersReducedMotion()) {
      // Draw a single static frame and schedule no animation frames.
      drawFrame(ctx, particles, width, height, null);
      window.addEventListener('resize', resize);
      return () => {
        window.removeEventListener('resize', resize);
      };
    }

    window.addEventListener('resize', resize);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseleave', handleMouseLeave);
    animationFrame = requestAnimationFrame(step);

    return () => {
      cancelAnimationFrame(animationFrame);
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 h-full w-full"
      aria-hidden="true"
    />
  );
}
