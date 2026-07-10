/* oxlint-disable react/only-export-components */
import { createContext, useCallback, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

export type ToastType = 'success' | 'error' | 'pending' | 'info'

export interface Toast {
  id: string
  type: ToastType
  title: string
  message?: string
  duration?: number
  txHash?: string
}

export type ToastInput = Omit<Toast, 'id'> & { id?: string }

interface ToastContextValue {
  toasts: Toast[]
  addToast: (toast: ToastInput) => void
  removeToast: (id: string) => void
}

export const ToastContext = createContext<ToastContextValue | undefined>(undefined)

interface ToastProviderProps {
  children: ReactNode
}

function createToastId() {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID()
  }

  return `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((toastInput: ToastInput) => {
    const toast: Toast = {
      ...toastInput,
      id: toastInput.id ?? createToastId(),
      duration: toastInput.duration ?? (toastInput.type === 'pending' ? 0 : 5000),
    }

    setToasts((currentToasts) => [
      ...currentToasts.filter((currentToast) => currentToast.id !== toast.id),
      toast,
    ])
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts((currentToasts) => currentToasts.filter((toast) => toast.id !== id))
  }, [])

  const value = useMemo(
    () => ({
      toasts,
      addToast,
      removeToast,
    }),
    [addToast, removeToast, toasts],
  )

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>
}


