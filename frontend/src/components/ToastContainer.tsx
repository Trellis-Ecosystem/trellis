import { useEffect } from 'react'
import type { Toast } from '../context/ToastContext'
import { useToast } from '../hooks/useToast'

const toastIcons: Record<Toast['type'], string> = {
  success: '✅',
  error: '❌',
  pending: '⏳',
  info: 'ℹ️',
}

const toastBorders: Record<Toast['type'], string> = {
  success: 'border-l-green-400',
  error: 'border-l-red-400',
  pending: 'border-l-cyan-400',
  info: 'border-l-slate-400',
}

interface ToastItemProps {
  toast: Toast
  onClose: (id: string) => void
}

function ToastItem({ toast, onClose }: ToastItemProps) {
  useEffect(() => {
    if (toast.duration === 0) return

    const timeoutId = window.setTimeout(() => {
      onClose(toast.id)
    }, toast.duration ?? 5000)

    return () => window.clearTimeout(timeoutId)
  }, [onClose, toast.duration, toast.id])

  const explorerUrl = toast.txHash
    ? `https://stellar.expert/explorer/testnet/tx/${encodeURIComponent(toast.txHash)}`
    : undefined

  return (
    <div
      className={`pointer-events-auto rounded-xl border border-navy-700 border-l-4 ${toastBorders[toast.type]} bg-navy-800/95 p-4 text-gray-200 shadow-2xl shadow-black/40 backdrop-blur`}
      style={{ animation: 'trellis-toast-slide-in 180ms ease-out' }}
      role="status"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 text-lg" aria-hidden="true">
          {toastIcons[toast.type]}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-white">{toast.title}</p>
          {toast.message ? <p className="mt-1 text-sm text-gray-400">{toast.message}</p> : null}
          {explorerUrl ? (
            <a
              href={explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex text-sm font-semibold text-cyan-400 transition-colors hover:text-cyan-300"
            >
              View on Explorer →
            </a>
          ) : null}
        </div>
        <button
          type="button"
          className="rounded-md px-2 text-xl leading-none text-gray-500 transition-colors hover:bg-navy-700 hover:text-white"
          aria-label={`Dismiss ${toast.title}`}
          onClick={() => onClose(toast.id)}
        >
          ×
        </button>
      </div>
    </div>
  )
}

export function ToastContainer() {
  const { toasts, removeToast } = useToast()

  if (toasts.length === 0) return null

  return (
    <>
      <style>
        {`
          @keyframes trellis-toast-slide-in {
            from { opacity: 0; transform: translateX(1.5rem); }
            to { opacity: 1; transform: translateX(0); }
          }
        `}
      </style>
      <div className="pointer-events-none fixed bottom-6 right-6 z-50 flex w-[min(calc(100vw-3rem),24rem)] flex-col gap-3">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onClose={removeToast} />
        ))}
      </div>
    </>
  )
}
