import { useCallback, useEffect, useRef, useState } from 'react'

function copyWithTextarea(text: string): void {
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.top = '-9999px'
  textarea.style.left = '-9999px'
  textarea.style.opacity = '0'

  document.body.appendChild(textarea)

  try {
    textarea.focus()
    textarea.select()
    textarea.setSelectionRange(0, text.length)

    const successful = document.execCommand('copy')
    if (!successful) {
      throw new Error('Copy command was unsuccessful')
    }
  } finally {
    document.body.removeChild(textarea)
  }
}

export function useCopyToClipboard() {
  const [copied, setCopied] = useState(false)
  const resetTimerRef = useRef<number | null>(null)

  const copy = useCallback(async (text: string) => {
    if (resetTimerRef.current !== null) {
      window.clearTimeout(resetTimerRef.current)
      resetTimerRef.current = null
    }

    setCopied(false)

    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
    } else {
      copyWithTextarea(text)
    }

    setCopied(true)
    resetTimerRef.current = window.setTimeout(() => {
      setCopied(false)
      resetTimerRef.current = null
    }, 2000)
  }, [])

  useEffect(() => {
    return () => {
      if (resetTimerRef.current !== null) {
        window.clearTimeout(resetTimerRef.current)
      }
    }
  }, [])

  return { copied, copy }
}
