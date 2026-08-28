import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import ToastItem from './ToastItem'
import {
  DEFAULT_DURATIONS,
  ToastActionsContext,
  ToastContext,
  type Toast,
  type ToastActionsContextValue,
  type ToastOptions,
  type ToastType,
} from './toast-context'

/** Newest toasts render at the top; older ones drop off once this many are on screen. */
const MAX_VISIBLE = 4

function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(0)
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>())

  // ---------------------------------------------------------------------------
  // Internal helpers — defined once via useRef so they are always stable
  // ---------------------------------------------------------------------------

  const clearTimer = useCallback((id: string) => {
    const timer = timers.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timers.current.delete(id)
    }
  }, [])

  const dismiss = useCallback(
    (id: string) => {
      clearTimer(id)
      setToasts((current) => current.filter((toast) => toast.id !== id))
    },
    [clearTimer],
  )

  const scheduleDismiss = useCallback(
    (id: string, type: ToastType, duration: number | null | undefined) => {
      clearTimer(id)
      const lifetime = duration === undefined ? DEFAULT_DURATIONS[type] : duration
      if (lifetime === null) return
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), lifetime),
      )
    },
    [clearTimer, dismiss],
  )

  const show = useCallback(
    (type: ToastType, options: ToastOptions) => {
      const id = `toast-${nextId.current++}`
      setToasts((current) => [{ ...options, id, type }, ...current].slice(0, MAX_VISIBLE))
      scheduleDismiss(id, type, options.duration)
      return id
    },
    [scheduleDismiss],
  )

  const update = useCallback(
    (id: string, type: ToastType, options: ToastOptions) => {
      setToasts((current) =>
        current.map((toast) => (toast.id === id ? { ...options, id, type } : toast)),
      )
      scheduleDismiss(id, type, options.duration)
    },
    [scheduleDismiss],
  )

  const dismissAll = useCallback(() => {
    timers.current.forEach(clearTimeout)
    timers.current.clear()
    setToasts([])
  }, [])

  // Drop any outstanding timers when the provider unmounts.
  useEffect(() => {
    const pending = timers.current
    return () => {
      pending.forEach(clearTimeout)
      pending.clear()
    }
  }, [])

  // ---------------------------------------------------------------------------
  // Stable actions context — never recreated after mount.
  // Consumers that only call actions (show / dismiss / update) subscribe here
  // and will NOT re-render when the toasts array changes.
  // ---------------------------------------------------------------------------
  const actionsValue = useMemo<ToastActionsContextValue>(
    () => ({
      show,
      pending: (options: ToastOptions) => show('pending', options),
      success: (options: ToastOptions) => show('success', options),
      error: (options: ToastOptions) => show('error', options),
      info: (options: ToastOptions) => show('info', options),
      update,
      dismiss,
      dismissAll,
    }),
    // show / update / dismiss / dismissAll are all stable useCallback refs
    // so this memo is only computed once.
    [show, update, dismiss, dismissAll],
  )

  // ---------------------------------------------------------------------------
  // Full context — includes the toasts array for backward-compatibility.
  // This value changes every time toasts changes, but useToast() consumers
  // that only need actions can migrate to useToastActions() to opt out.
  // ---------------------------------------------------------------------------
  const fullValue = useMemo(
    () => ({ ...actionsValue, toasts }),
    [actionsValue, toasts],
  )

  return (
    <ToastActionsContext.Provider value={actionsValue}>
      <ToastContext.Provider value={fullValue}>
        {children}
        <div
          aria-live="polite"
          className="pointer-events-none fixed top-4 right-4 z-50 flex w-full max-w-sm flex-col gap-3 px-4 sm:px-0"
        >
          {toasts.map((toast) => (
            <ToastItem key={toast.id} toast={toast} onDismiss={dismiss} />
          ))}
        </div>
      </ToastContext.Provider>
    </ToastActionsContext.Provider>
  )
}

export default ToastProvider
