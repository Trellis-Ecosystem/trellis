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

  // Validate and clamp target value
  const validatedTarget = validateAndClampTarget(targetValue)

  const [displayValue, setDisplayValue] = useState(validatedTarget)
  const previousValueRef = useRef(validatedTarget)
  const animationFrameRef = useRef<number | null>(null)
  const startTimeRef = useRef<number | null>(null)
  const iterationCountRef = useRef(0)

  useEffect(() => {
    const startValue = previousValueRef.current
    const change = Math.abs(validatedTarget - startValue)

    if (change === 0) return

    if (change < minThreshold) {
      setDisplayValue(validatedTarget)
      previousValueRef.current = validatedTarget
      return
    }

    const startTime = performance.now()
    startTimeRef.current = startTime
    iterationCountRef.current = 0

    const animate = (currentTime: number) => {
      // Safeguard against infinite animation loops (max 1000 iterations)
      iterationCountRef.current += 1
      if (iterationCountRef.current > 1000) {
        setDisplayValue(validatedTarget)
        previousValueRef.current = validatedTarget
        animationFrameRef.current = null
        return
      }

      const elapsed = currentTime - startTime
      const progress = Math.min(elapsed / duration, 1)

      const current = startValue + (validatedTarget - startValue) * progress
      setDisplayValue(Math.round(current))

      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(animate)
      } else {
        setDisplayValue(validatedTarget)
        previousValueRef.current = validatedTarget
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
  }, [validatedTarget, duration, minThreshold])

  return displayValue
}

/**
 * Validates and clamps the target value for count-up animation.
 *
 * Ensures:
 * - Input is a finite number (rejects NaN and Infinity)
 * - Value is within reasonable range [0, 1e9]
 * - Returns a safe default (0) for invalid inputs
 *
 * @param value - The target value to validate
 * @returns A valid, finite number within the safe range
 */
function validateAndClampTarget(value: number): number {
  // Check if value is a finite number
  if (!Number.isFinite(value)) {
    return 0
  }

  // Clamp to safe range [0, 1e9]
  const MIN_VALUE = 0
  const MAX_VALUE = 1e9
  return Math.max(MIN_VALUE, Math.min(MAX_VALUE, value))
}
