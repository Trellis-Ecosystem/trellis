import { useScrollReveal } from '../hooks/useScrollReveal'
import type { ReactNode } from 'react'

interface ScrollRevealProps {
  children: ReactNode
  className?: string
  delay?: number
  direction?: 'up' | 'down' | 'left' | 'right'
  distance?: number
  duration?: number
}

export function ScrollReveal({
  children,
  className = '',
  delay = 0,
  direction = 'up',
  distance = 30,
  duration = 600,
}: ScrollRevealProps) {
  const { ref, isVisible } = useScrollReveal()

  const getTransform = () => {
    if (isVisible) return 'translate(0, 0)'
    switch (direction) {
      case 'up': return `translateY(${distance}px)`
      case 'down': return `translateY(-${distance}px)`
      case 'left': return `translateX(${distance}px)`
      case 'right': return `translateX(-${distance}px)`
    }
  }

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: isVisible ? 1 : 0,
        transform: getTransform(),
        transition: `opacity ${duration}ms ease ${delay}ms, transform ${duration}ms ease ${delay}ms`,
      }}
    >
      {children}
    </div>
  )
}
