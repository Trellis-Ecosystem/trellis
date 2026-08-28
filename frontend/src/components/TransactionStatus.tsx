import { useEffect, useRef, useState } from 'react'
import { ExplorerLink } from './ExplorerLink'
import type { InvokeStatus } from '../hooks/useContractInvoke'

const TIMEOUT_MS = 60_000

interface TransactionStatusProps {
  status: InvokeStatus
  txHash: string | null
  error: string | null
  onRetry: () => void
  method: string
  retryCount?: number
  maxRetries?: number
}

const PHASE_LABELS: Record<InvokeStatus, string> = {
  idle: '',
  building: 'Building transaction',
  signing: 'Awaiting signature in Freighter',
  submitting: 'Broadcasting to network',
  success: 'Confirmed',
  error: 'Failed',
}

const PHASE_ORDER: InvokeStatus[] = ['building', 'signing', 'submitting']

export default function TransactionStatus({ status, txHash, error, onRetry, method, retryCount = 0, maxRetries = 3 }: TransactionStatusProps) {
  const [timeoutWarning, setTimeoutWarning] = useState(false)
  const startRef = useRef<number | null>(null)

  useEffect(() => {
    if (PHASE_ORDER.includes(status)) {
      if (startRef.current === null) {
        startRef.current = Date.now()
      }
      const elapsed = Date.now() - startRef.current
      const remaining = Math.max(0, TIMEOUT_MS - elapsed)
      const timer = setTimeout(() => {
        if (status === 'submitting' || status === 'building' || status === 'signing') {
          setTimeoutWarning(true)
        }
      }, remaining)
      return () => clearTimeout(timer)
    } else {
      startRef.current = null
      setTimeoutWarning(false)
    }
  }, [status])

  if (status === 'idle') return null

  if (status === 'success') {
    return (
      <div className="flex items-center gap-2 text-sm">
        <span className="text-emerald-400 font-semibold">Confirmed</span>
        {txHash && <ExplorerLink type="tx" value={txHash} label="View transaction" />}
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="space-y-2 p-3 bg-navy-700 rounded border border-red-500/50">
        <div className="flex items-center gap-2 text-sm text-red-400">
          <span className="font-semibold">Failed</span>
          <span className="text-gray-400">— {error || 'Transaction failed'}</span>
        </div>
        {txHash && <ExplorerLink type="tx" value={txHash} label="View failed transaction" />}
        {retryCount < maxRetries ? (
          <button
            onClick={onRetry}
            className="px-3 py-1 bg-cyan-500 hover:bg-cyan-400 text-white text-xs rounded transition-colors"
          >
            {`Retry with adjusted gas (+${Math.round((Math.pow(1.1, retryCount + 1) - 1) * 100)}%)`}
          </button>
        ) : (
          <span className="px-3 py-1 bg-navy-600 text-gray-400 text-xs rounded">
            Max retries reached ({maxRetries}/{maxRetries})
          </span>
        )}
      </div>
    )
  }

  const phaseIndex = PHASE_ORDER.indexOf(status)
  const label = PHASE_LABELS[status]

  return (
    <div className="space-y-2 p-3 bg-navy-700 rounded border border-cyan-500/30">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          {PHASE_ORDER.map((phase, i) => (
            <div key={phase} className="flex items-center gap-1.5">
              <div
                className={`h-2 w-2 rounded-full transition-all duration-500 ${
                  i < phaseIndex
                    ? 'bg-emerald-400'
                    : i === phaseIndex
                      ? 'bg-cyan-400 animate-pulse'
                      : 'bg-navy-500'
                }`}
              />
              {i < PHASE_ORDER.length - 1 && (
                <div
                  className={`h-0.5 w-3 transition-colors duration-500 ${
                    i < phaseIndex ? 'bg-emerald-400' : 'bg-navy-500'
                  }`}
                />
              )}
            </div>
          ))}
        </div>
        <span className="text-sm text-cyan-300 font-medium">{label}</span>
      </div>

      {timeoutWarning && (
        <div className="flex items-center gap-2 text-xs text-yellow-400 bg-yellow-400/10 px-2 py-1 rounded">
          <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 8v4m0 4h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <span>Transaction is taking longer than expected ({Math.floor(TIMEOUT_MS / 1000)}s+).</span>
        </div>
      )}
    </div>
  )
}