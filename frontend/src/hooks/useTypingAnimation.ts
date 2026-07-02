import { useState, useEffect } from 'react'

interface UseTypingAnimationOptions {
  text: string
  speed?: number
  delay?: number
  onComplete?: () => void
}

export function useTypingAnimation({
  text,
  speed = 50,
  delay = 500,
  onComplete,
}: UseTypingAnimationOptions) {
  const [displayedText, setDisplayedText] = useState('')
  const [isComplete, setIsComplete] = useState(false)
  const [hasStarted, setHasStarted] = useState(false)

  useEffect(() => {
    const startTimer = setTimeout(() => {
      setHasStarted(true)
    }, delay)
    return () => clearTimeout(startTimer)
  }, [delay])

  useEffect(() => {
    if (!hasStarted) return
    if (displayedText.length === text.length) {
      setIsComplete(true)
      onComplete?.()
      return
    }

    const timer = setTimeout(() => {
      setDisplayedText(text.slice(0, displayedText.length + 1))
    }, speed)

    return () => clearTimeout(timer)
  }, [hasStarted, displayedText, text, speed, onComplete])

  return { displayedText, isComplete, hasStarted }
}
