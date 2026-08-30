import { useCallback, useState } from 'react'

interface CopyButtonProps {
  text: string
  label?: string
  className?: string
}

export function CopyButton({ text, label, className = '' }: CopyButtonProps) {
  const [copied, setCopied] = useState(false)
  const [copyFailed, setCopyFailed] = useState(false)

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopyFailed(true)
      setTimeout(() => setCopyFailed(false), 2000)
    }
  }, [text])

  const buttonTitle = copied ? 'Copied!' : copyFailed ? 'Copy failed — check clipboard permissions' : (label ?? 'Copy to clipboard')

  return (
    <button
      onClick={handleCopy}
      className={`p-1.5 rounded transition-colors ${
        copied
          ? 'text-green-400 bg-green-400/10'
          : copyFailed
            ? 'text-red-400 bg-red-400/10'
            : 'text-gray-400 dark:text-gray-400 light:text-gray-600 hover:text-cyan-400 dark:hover:text-cyan-400 light:hover:text-cyan-600 hover:bg-navy-700 dark:hover:bg-navy-700 light:hover:bg-gray-100'
      } ${className}`}
      title={buttonTitle}
      aria-label={buttonTitle}
    >
      {copied ? (
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
      ) : copyFailed ? (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M6 6l12 12M6 18L18 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      ) : (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect x="9" y="9" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="2" />
          <path d="M5 15V6a1 1 0 0 1 1-1h9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      )}
    </button>
  )
}

export default CopyButton