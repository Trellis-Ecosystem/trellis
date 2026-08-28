import { useContext } from 'react'
import { ToastActionsContext, ToastContext } from '../components/toast/toast-context'

/**
 * Access the full toast API including the live toasts array.
 *
 * NOTE: This hook re-renders its consumer on every toast addition/dismissal
 * because it subscribes to the full ToastContext (which includes `toasts`).
 * If your component only needs to *trigger* toasts (show / update / dismiss)
 * and never reads the `toasts` array, use `useToastActions()` instead — it
 * subscribes to the stable actions-only context and will not re-render on
 * toast state changes.
 *
 * Typical transaction flow:
 *
 *   const toast = useToast()
 *   const id = toast.pending({ title: 'Locking funds…' })
 *   try {
 *     const hash = await lockFunds()
 *     toast.update(id, 'success', { title: 'Funds locked', message: hash })
 *   } catch (err) {
 *     toast.update(id, 'error', { title: 'Transaction failed', message: String(err) })
 *   }
 */
export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}

/**
 * Access only the stable toast action methods (show / update / dismiss /
 * dismissAll and the typed convenience helpers).
 *
 * This hook subscribes to ToastActionsContext whose value never changes after
 * mount, so the consuming component is **not** re-rendered when toasts are
 * added or dismissed.  Use this in page-level components and other heavy
 * subtrees that call toast actions but do not render the toast list.
 *
 * Falls back to ToastContext when ToastActionsContext is not provided — this
 * preserves compatibility with test setups that only inject ToastContext.
 */
export function useToastActions() {
  // Both useContext calls must be unconditional to satisfy the Rules of Hooks.
  const actionsCtx = useContext(ToastActionsContext)
  const fullCtx = useContext(ToastContext)

  if (actionsCtx) return actionsCtx

  if (fullCtx) {
    // Destructure toasts out so the returned object only contains action methods.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { toasts: _toasts, ...actions } = fullCtx
    return actions
  }

  throw new Error('useToastActions must be used within a ToastProvider')
}

export default useToast
