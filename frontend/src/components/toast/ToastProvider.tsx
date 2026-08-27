import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import ToastItem from './ToastItem'
import {
  DEFAULT_DURATIONS,
  ToastContext,
  type Toast,
  type ToastOptions,
  type ToastType,
} from './toast-context'

/** Newest toasts render at the top; older ones drop off once this many are on screen. */
const MAX_VISIBLE = 4

function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(0)
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>())

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

  const value = useMemo(
    () => ({
      toasts,
      show,
      pending: (options: ToastOptions) => show('pending', options),
      success: (options: ToastOptions) => show('success', options),
      error: (options: ToastOptions) => show('error', options),
      info: (options: ToastOptions) => show('info', options),
      update,
      dismiss,
      dismissAll,
    }),
    [toasts, show, update, dismiss, dismissAll],
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed top-4 left-4 right-4 z-50 flex flex-col gap-3 sm:left-auto sm:right-4 sm:w-full sm:max-w-sm"
      >
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export default ToastProvider
