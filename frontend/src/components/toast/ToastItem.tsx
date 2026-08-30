import type { Toast, ToastType } from './toast-context'

const STYLES: Record<ToastType, { border: string; accent: string }> = {
  pending: { border: 'border-cyan-400/40', accent: 'text-cyan-400' },
  success: { border: 'border-emerald-400/40', accent: 'text-emerald-400' },
  error: { border: 'border-red-400/40', accent: 'text-red-400' },
  info: { border: 'border-navy-700', accent: 'text-gray-300' },
}

function ToastIcon({ type }: { type: ToastType }) {
  if (type === 'pending') {
    return (
      <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" opacity="0.25" />
        <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    )
  }

  const path =
    type === 'success'
      ? 'M5 13l4 4L19 7'
      : type === 'error'
        ? 'M6 6l12 12M18 6L6 18'
        : 'M12 8h.01M11 12h1v5h1'

  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d={path} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

interface ToastItemProps {
  toast: Toast
  onDismiss: (id: string) => void
}

function ToastItem({ toast, onDismiss }: ToastItemProps) {
  const { border, accent } = STYLES[toast.type]

  return (
    <div
      role={toast.type === 'error' ? 'alert' : 'status'}
      aria-live={toast.type === 'error' ? 'assertive' : 'polite'}
      className={`toast-enter pointer-events-auto flex w-full max-w-sm gap-3 rounded-lg border ${border} bg-navy-800 dark:bg-navy-800 light:bg-white p-4 shadow-lg shadow-black/40`}
    >
      <span className={`mt-0.5 shrink-0 ${accent}`}>
        <ToastIcon type={toast.type} />
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-white dark:text-white light:text-gray-900">{toast.title}</p>
        {toast.message && (
          <p className="mt-1 break-words text-sm text-gray-400 dark:text-gray-400 light:text-gray-600">{toast.message}</p>
        )}
        {toast.link && (
          <a
            href={toast.link.href}
            target="_blank"
            rel="noreferrer"
            className={`mt-2 inline-block text-sm font-medium hover:underline ${accent}`}
          >
            {toast.link.label}
          </a>
        )}
      </div>

      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss notification"
        className="-mt-1 -mr-1 h-6 w-6 shrink-0 rounded text-gray-500 dark:text-gray-500 light:text-gray-600 transition-colors hover:text-gray-200 dark:hover:text-gray-200 light:hover:text-gray-700"
      >
        <svg className="h-4 w-4 mx-auto" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  )
}

export default ToastItem
