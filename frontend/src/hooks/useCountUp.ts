import { useEffect, useRef, useState } from 'react'

interface UseCountUpOptions {
  duration?: number
  minThreshold?: number
}

export function useCountUp(
  targetValue: number,
  options: UseCountUpOptions = {},
): number {
  const { duration = 500, minThreshold = 5 } = options

  const [displayValue, setDisplayValue] = useState(targetValue)
  const previousValueRef = useRef(targetValue)
  const animationFrameRef = useRef<number | null>(null)
  const startTimeRef = useRef<number | null>(null)

  useEffect(() => {
    const startValue = previousValueRef.current
    const change = Math.abs(targetValue - startValue)

    if (change === 0) return

    if (change < minThreshold) {
      setDisplayValue(targetValue)
      previousValueRef.current = targetValue
      return
    }

    const startTime = performance.now()
    startTimeRef.current = startTime

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime
      const progress = Math.min(elapsed / duration, 1)

      const current = startValue + (targetValue - startValue) * progress
      setDisplayValue(Math.round(current))

      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(animate)
      } else {
        setDisplayValue(targetValue)
        previousValueRef.current = targetValue
        animationFrameRef.current = null
      }
    }

    animationFrameRef.current = requestAnimationFrame(animate)

    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current)
        animationFrameRef.current = null
      }
    }
  }, [targetValue, duration, minThreshold])

  return displayValue
}
