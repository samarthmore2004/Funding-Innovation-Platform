import clsx from 'clsx'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { formatNumber } from '../../utils/format'

function pageWindow(page, pages) {
  const out = []
  const add = (n) => out.push(n)
  if (pages <= 7) {
    for (let i = 1; i <= pages; i += 1) add(i)
    return out
  }
  add(1)
  if (page > 3) add('…l')
  for (let i = Math.max(2, page - 1); i <= Math.min(pages - 1, page + 1); i += 1) add(i)
  if (page < pages - 2) add('…r')
  add(pages)
  return out
}

export default function Pagination({ page = 1, pages = 1, total, pageSize, onChange, className }) {
  if (!pages || pages <= 1) {
    return total !== undefined ? (
      <p className={clsx('text-xs text-slate-500', className)}>{formatNumber(total)} result{total === 1 ? '' : 's'}</p>
    ) : null
  }
  const start = pageSize ? (page - 1) * pageSize + 1 : null
  const end = pageSize && total !== undefined ? Math.min(page * pageSize, total) : null
  return (
    <nav className={clsx('flex flex-wrap items-center justify-between gap-3', className)} aria-label="Pagination">
      <p className="text-xs text-slate-500">
        {start && end ? `Showing ${formatNumber(start)}–${formatNumber(end)} of ${formatNumber(total)}` : `Page ${page} of ${pages}`}
      </p>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onChange(page - 1)}
          disabled={page <= 1}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-300"
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        {pageWindow(page, pages).map((item) =>
          typeof item === 'string' ? (
            <span key={item} className="px-1 text-sm text-slate-400">
              …
            </span>
          ) : (
            <button
              key={item}
              type="button"
              onClick={() => onChange(item)}
              aria-current={item === page ? 'page' : undefined}
              className={clsx(
                'h-8 min-w-8 rounded-lg px-2 text-sm font-medium tabular',
                item === page ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100',
              )}
            >
              {item}
            </button>
          ),
        )}
        <button
          type="button"
          onClick={() => onChange(page + 1)}
          disabled={page >= pages}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-300"
          aria-label="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </nav>
  )
}
