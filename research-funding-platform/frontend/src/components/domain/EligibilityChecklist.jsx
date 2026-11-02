import clsx from 'clsx'
import { CircleCheck, CircleHelp, CircleX } from 'lucide-react'
import { EligibilityBadge } from './Badges'
import { formatRatio } from '../../utils/format'

/** Rule-by-rule eligibility result. `passed` may be true, false or null (not enough profile info). */
export default function EligibilityChecklist({ eligibility, compact = false }) {
  if (!eligibility) return <p className="text-sm text-slate-500">Eligibility information is not available.</p>
  const checks = eligibility.checks || []
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <EligibilityBadge status={eligibility.status} />
        {eligibility.score !== undefined && eligibility.score !== null && (
          <span className="text-xs text-slate-500">{formatRatio(eligibility.score)} of criteria satisfied</span>
        )}
      </div>
      {checks.length > 0 && (
        <ul className={clsx('space-y-2', compact && 'space-y-1.5')}>
          {checks.map((check, index) => {
            const Icon = check.passed === true ? CircleCheck : check.passed === false ? CircleX : CircleHelp
            const tone = check.passed === true ? 'text-emerald-600' : check.passed === false ? 'text-rose-600' : 'text-slate-400'
            const state = check.passed === true ? 'Met' : check.passed === false ? 'Not met' : 'Unknown'
            return (
              <li key={`${check.criterion}-${index}`} className="flex items-start gap-2 text-sm">
                <Icon className={clsx('mt-0.5 h-4 w-4 shrink-0', tone)} aria-hidden="true" />
                <div className="min-w-0">
                  <span className="font-medium text-slate-800">{check.criterion}</span>
                  <span className="sr-only"> — {state}</span>
                  {check.detail && <p className="text-xs text-slate-500">{check.detail}</p>}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
