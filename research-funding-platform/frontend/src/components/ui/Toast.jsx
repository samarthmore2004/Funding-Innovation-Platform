import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import clsx from 'clsx'
import { AlertCircle, CheckCircle2, Info, TriangleAlert, X } from 'lucide-react'

const ToastContext = createContext(null)

const STYLES = {
  success: { icon: CheckCircle2, className: 'text-emerald-600' },
  error: { icon: AlertCircle, className: 'text-rose-600' },
  warning: { icon: TriangleAlert, className: 'text-amber-600' },
  info: { icon: Info, className: 'text-indigo-600' },
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const counter = useRef(0)

  const dismiss = useCallback((id) => setToasts((list) => list.filter((toast) => toast.id !== id)), [])

  const push = useCallback(
    (type, message, options = {}) => {
      const id = ++counter.current
      setToasts((list) => [...list.slice(-4), { id, type, message, title: options.title }])
      const duration = options.duration ?? (type === 'error' ? 6500 : 4000)
      if (duration > 0) setTimeout(() => dismiss(id), duration)
      return id
    },
    [dismiss],
  )

  const api = useMemo(
    () => ({
      success: (message, options) => push('success', message, options),
      error: (message, options) => push('error', message, options),
      warning: (message, options) => push('warning', message, options),
      info: (message, options) => push('info', message, options),
      dismiss,
    }),
    [push, dismiss],
  )

  return (
    <ToastContext.Provider value={api}>
      {children}
      {createPortal(
        <div
          className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 p-4 sm:items-end"
          aria-live="polite"
          aria-atomic="false"
        >
          {toasts.map((toast) => {
            const style = STYLES[toast.type] || STYLES.info
            const Icon = style.icon
            return (
              <div
                key={toast.id}
                role={toast.type === 'error' ? 'alert' : 'status'}
                className="pointer-events-auto flex w-full max-w-sm animate-fade-in items-start gap-3 rounded-xl border border-slate-200 bg-white p-3.5 shadow-lg"
              >
                <Icon className={clsx('mt-0.5 h-5 w-5 shrink-0', style.className)} aria-hidden="true" />
                <div className="min-w-0 flex-1 text-sm">
                  {toast.title && <p className="font-semibold text-slate-900">{toast.title}</p>}
                  <p className="break-words text-slate-600">{toast.message}</p>
                </div>
                <button
                  type="button"
                  onClick={() => dismiss(toast.id)}
                  className="rounded p-0.5 text-slate-400 hover:text-slate-600"
                  aria-label="Dismiss notification"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )
          })}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToast() {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast must be used inside <ToastProvider>')
  return context
}

export default ToastProvider
