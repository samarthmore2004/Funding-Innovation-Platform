import clsx from 'clsx'
import { AlertCircle, RefreshCw } from 'lucide-react'
import Button from './Button'

export default function ErrorState({ title = "We couldn't load this", message, onRetry, compact = false, className }) {
  return (
    <div
      role="alert"
      className={clsx(
        'flex flex-col items-center justify-center rounded-xl text-center',
        compact ? 'py-6' : 'py-12',
        className,
      )}
    >
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-rose-50 text-rose-500">
        <AlertCircle className="h-5 w-5" aria-hidden="true" />
      </span>
      <h3 className="mt-3 text-sm font-semibold text-slate-900">{title}</h3>
      {message && <p className="mt-1 max-w-md text-sm text-slate-500">{message}</p>}
      {onRetry && (
        <Button variant="secondary" size="sm" icon={RefreshCw} onClick={() => onRetry()} className="mt-4">
          Try again
        </Button>
      )}
    </div>
  )
}
