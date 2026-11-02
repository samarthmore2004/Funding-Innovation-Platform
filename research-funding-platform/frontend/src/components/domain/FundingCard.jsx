import { Link } from 'react-router-dom'
import clsx from 'clsx'
import { Bookmark, BookmarkCheck, CalendarClock, CircleDollarSign } from 'lucide-react'
import { FunderTypeBadge, FundingRecordBadge, FundingStatusBadge } from './Badges'
import { deadlineLabel, formatAmountRange, formatDate, truncate } from '../../utils/format'
import { useTaxonomy } from '../../utils/taxonomy'

export function DeadlineText({ funding, className }) {
  const days = funding?.days_until_deadline
  const urgent = days !== null && days !== undefined && days >= 0 && days <= 14
  return (
    <span className={clsx('inline-flex items-center gap-1', urgent ? 'font-medium text-rose-700' : 'text-slate-600', className)}>
      <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
      {funding?.deadline ? formatDate(funding.deadline) : 'No fixed deadline'}
      {funding?.deadline && <span className="text-slate-400">·</span>}
      {funding?.deadline && <span>{deadlineLabel(days, funding.deadline)}</span>}
    </span>
  )
}

/** Funding opportunity summary card used in search results and dashboards. */
export default function FundingCard({ funding, saved = false, onToggleSave, saving = false, compact = false }) {
  const { domainName } = useTaxonomy()
  if (!funding) return null
  return (
    <article className="flex h-full flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-indigo-200 hover:shadow">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          <FunderTypeBadge type={funding.funder_type} />
          <FundingRecordBadge type={funding.record_type} />
          <FundingStatusBadge status={funding.status} />
        </div>
        {onToggleSave && (
          <button
            type="button"
            onClick={() => onToggleSave(funding)}
            disabled={saving}
            className={clsx(
              'rounded-lg p-1.5 transition-colors disabled:opacity-50',
              saved ? 'text-indigo-600 hover:bg-indigo-50' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600',
            )}
            aria-pressed={saved}
            aria-label={saved ? 'Remove from tracked opportunities' : 'Track this opportunity'}
            title={saved ? 'Tracked — click to remove' : 'Track this opportunity'}
          >
            {saved ? <BookmarkCheck className="h-5 w-5" /> : <Bookmark className="h-5 w-5" />}
          </button>
        )}
      </div>
      <Link to={`/app/funding/${funding.id}`} className="mt-2 text-sm font-semibold leading-snug text-slate-900 hover:text-indigo-700">
        {funding.title}
      </Link>
      <p className="mt-0.5 text-xs text-slate-500">{funding.organization}</p>
      {!compact && funding.description && (
        <p className="mt-2 line-clamp-3 text-sm text-slate-600">{truncate(funding.description, 260)}</p>
      )}
      {!compact && funding.domains?.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {funding.domains.slice(0, 4).map((domain) => (
            <span key={domain} className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600">
              {domainName(domain)}
            </span>
          ))}
          {funding.domains.length > 4 && <span className="text-[11px] text-slate-400">+{funding.domains.length - 4}</span>}
        </div>
      )}
      <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-slate-100 pt-3 text-xs" style={{ marginTop: compact ? '0.75rem' : undefined }}>
        <span className="inline-flex items-center gap-1 text-slate-600">
          <CircleDollarSign className="h-3.5 w-3.5" aria-hidden="true" />
          {formatAmountRange(funding.min_amount, funding.max_amount, funding.currency)}
        </span>
        <DeadlineText funding={funding} />
      </div>
    </article>
  )
}
