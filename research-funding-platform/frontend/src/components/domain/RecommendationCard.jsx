import { useState } from 'react'
import { Link } from 'react-router-dom'
import { BookmarkPlus, ChevronDown, ChevronUp, CircleDollarSign, ThumbsDown } from 'lucide-react'
import Button from '../ui/Button'
import ProgressBar from '../ui/ProgressBar'
import { EligibilityBadge, FunderTypeBadge, FundingRecordBadge, FundingStatusBadge } from './Badges'
import EligibilityChecklist from './EligibilityChecklist'
import { DeadlineText } from './FundingCard'
import { formatAmountRange, formatDecimal } from '../../utils/format'

/**
 * Explainable recommendation: match score, cosine similarity, eligibility, matched terms and
 * reasons. Feedback callbacks are optional (dashboards render it read-only).
 */
export default function RecommendationCard({ rec, rank, onSave, onDismiss, onOpen, busy, compact = false }) {
  const [expanded, setExpanded] = useState(false)
  const funding = rec?.funding
  if (!funding) return null
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        {rank !== undefined && (
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-xs font-semibold text-indigo-700">
            {rank}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <Link
                to={`/app/funding/${funding.id}`}
                onClick={() => onOpen?.(funding)}
                className="text-sm font-semibold leading-snug text-slate-900 hover:text-indigo-700"
              >
                {funding.title}
              </Link>
              <p className="mt-0.5 text-xs text-slate-500">{funding.organization}</p>
            </div>
            {(onSave || onDismiss) && (
              <div className="flex gap-1.5">
                {onSave && (
                  <Button size="xs" variant="subtle" icon={BookmarkPlus} onClick={() => onSave(rec)} loading={busy === 'save'}>
                    Track
                  </Button>
                )}
                {onDismiss && (
                  <Button size="xs" variant="ghost" icon={ThumbsDown} onClick={() => onDismiss(rec)} loading={busy === 'dismiss'}>
                    Not relevant
                  </Button>
                )}
              </div>
            )}
          </div>

          <div className="mt-2 flex flex-wrap gap-1.5">
            <FunderTypeBadge type={funding.funder_type} />
            <FundingRecordBadge type={funding.record_type} />
            <FundingStatusBadge status={funding.status} />
            <EligibilityBadge status={rec.eligibility?.status} />
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <ProgressBar value={rec.match_score} label="Match score" />
            <p className="text-xs text-slate-500">
              Cosine similarity <span className="font-semibold text-slate-800 tabular">{formatDecimal(rec.similarity, 3)}</span>
            </p>
          </div>

          {rec.matched_terms?.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-1">
              <span className="mr-1 text-xs text-slate-500">Matched terms:</span>
              {rec.matched_terms.slice(0, compact ? 5 : 10).map((term) => (
                <span key={term} className="rounded-md bg-indigo-50 px-1.5 py-0.5 text-[11px] font-medium text-indigo-700">
                  {term}
                </span>
              ))}
            </div>
          )}

          {!compact && rec.reasons?.length > 0 && (
            <ul className="mt-3 list-disc space-y-0.5 pl-5 text-xs text-slate-600">
              {rec.reasons.map((reason, index) => (
                <li key={index}>{reason}</li>
              ))}
            </ul>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
            <span className="inline-flex items-center gap-1 text-slate-600">
              <CircleDollarSign className="h-3.5 w-3.5" aria-hidden="true" />
              {formatAmountRange(funding.min_amount, funding.max_amount, funding.currency)}
            </span>
            <DeadlineText funding={funding} />
            {!compact && rec.eligibility?.checks?.length > 0 && (
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="ml-auto inline-flex items-center gap-1 font-medium text-indigo-600 hover:text-indigo-800"
                aria-expanded={expanded}
              >
                {expanded ? 'Hide' : 'Show'} eligibility checks
                {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </button>
            )}
          </div>
          {expanded && (
            <div className="mt-3 rounded-lg bg-slate-50 p-3">
              <EligibilityChecklist eligibility={rec.eligibility} compact />
            </div>
          )}
        </div>
      </div>
    </article>
  )
}
