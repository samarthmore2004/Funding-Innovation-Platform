import clsx from 'clsx'

const SIZES = { sm: 'h-4 w-4 border-2', md: 'h-6 w-6 border-2', lg: 'h-10 w-10 border-[3px]' }

export function Spinner({ size = 'md', className }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={clsx(
        'inline-block animate-spin rounded-full border-current border-r-transparent text-indigo-600',
        SIZES[size] || SIZES.md,
        className,
      )}
    />
  )
}

export function LoadingState({ label = 'Loading…', className, compact = false }) {
  return (
    <div className={clsx('flex flex-col items-center justify-center gap-3 text-sm text-slate-500', compact ? 'py-6' : 'py-16', className)}>
      <Spinner size={compact ? 'md' : 'lg'} />
      <span>{label}</span>
    </div>
  )
}

export function FullPageLoader({ label = 'Loading…' }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <LoadingState label={label} />
    </div>
  )
}

/** Placeholder block used inside cards while content loads. */
export function Skeleton({ className }) {
  return <div className={clsx('animate-pulse rounded-md bg-slate-200/70', className)} />
}

export default Spinner
