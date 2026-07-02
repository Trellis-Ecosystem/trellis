import { useTypingAnimation } from '../hooks/useTypingAnimation'

interface TypingTextProps {
  text: string
  speed?: number
  delay?: number
  className?: string
  onComplete?: () => void
  showCursor?: boolean
}

export function TypingText({
  text,
  speed = 45,
  delay = 300,
  className = '',
  onComplete,
  showCursor = true,
}: TypingTextProps) {
  const { displayedText, isComplete } = useTypingAnimation({
    text,
    speed,
    delay,
    onComplete,
  })

  return (
    <span className={className}>
      {displayedText}
      {showCursor && (
        <span
          className={`inline-block w-0.5 h-[1em] bg-cyan-400 ml-1 align-middle ${
            isComplete ? 'animate-pulse' : 'animate-none opacity-100'
          }`}
          style={{
            animation: isComplete
              ? 'pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite'
              : 'blink 0.5s step-end infinite',
          }}
        />
      )}
    </span>
  )
}
