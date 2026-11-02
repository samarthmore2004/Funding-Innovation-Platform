import { useState } from 'react'
import { ChevronDown, ChevronUp, Info } from 'lucide-react'
import ScoreGauge from '../ui/ScoreGauge'
import ProgressBar from '../ui/ProgressBar'
import { BandBadge } from './Badges'
import { SERIES_COLORS, INK } from '../charts/palette'
import { formatDateTime, formatDecimal, formatScore } from '../../utils/format'

export const COMPONENT_ORDER = ['research_novelty', 'patent_strength', 'technology_maturity', 'market_potential', 'funding_relevance']
const COMPONENT_LABELS = {
  research_novelty: 'Research Novelty',
  patent_strength: 'Patent Strength',
  technology_maturity: 'Technology Maturity',
  market_potential: 'Market Potential',
  funding_relevance: 'Funding Relevance',
}
const DEFAULT_DISCLAIMER =
  'This is a heuristic decision-support score built from the platform’s data and your inputs. It is not a validated prediction of commercial success.'

/** Fixed color per component (follows the entity, never its rank). */
export function componentColor(key) {
  const index = COMPONENT_ORDER.indexOf(key)
  return SERIES_COLORS[(index >= 0 ? index : COMPONENT_ORDER.length) % SERIES_COLORS.length]
}

export function sortComponents(components = []) {
  return [...components].sort((a, b) => {
    const ia = COMPONENT_ORDER.indexOf(a.key)
    const ib = COMPONENT_ORDER.indexOf(b.key)
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
  })
}

/** Stacked bar of weighted contributions (they sum to the overall score; the rest of 100 is track). */
export function ContributionBar({ components = [], overall }) {
  const sorted = sortComponents(components)
  return (
    <div>
      <div className="flex h-4 w-full overflow-hidden rounded-[4px] bg-slate-100" role="img" aria-label={`Overall score ${formatScore(overall)} composed of weighted components`}>
        {sorted.map((component, index) => {
          const width = Math.max(0, Number(component.weighted) || 0)
          if (!width) return null
          return (
            <div
              key={component.key}
              title={`${component.label || COMPONENT_LABELS[component.key]}: ${formatDecimal(component.weighted, 1)} points`}
              style={{
                width: `${width}%`,
                background: componentColor(component.key),
                borderLeft: index > 0 ? `2px solid ${INK.surface}` : undefined,
              }}
            />
          )
        })}
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
        {sorted.map((component) => (
          <li key={component.key} className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-[3px]" style={{ background: componentColor(component.key) }} aria-hidden="true" />
            {component.label || COMPONENT_LABELS[component.key]}
            <span className="font-semibold text-slate-900 tabular">{formatDecimal(component.weighted, 1)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function ComponentRow({ component }) {
  const [open, setOpen] = useState(false)
  const factors = component.factors || []
  return (
    <li className="py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-2.5 rounded-[3px]" style={{ background: componentColor(component.key) }} aria-hidden="true" />
          <span className="text-sm font-medium text-slate-800">{component.label || COMPONENT_LABELS[component.key]}</span>
          <span className="text-xs text-slate-500">weight {Math.round((component.weight || 0) * 100)}%</span>
        </div>
        <span className="text-xs text-slate-500">
          <span className="font-semibold text-slate-900 tabular">{formatScore(component.value)}</span>/100 ×{' '}
          {formatDecimal(component.weight, 2)} = <span className="font-semibold text-slate-900 tabular">{formatDecimal(component.weighted, 1)}</span> pts
        </span>
      </div>
      <ProgressBar value={component.value} showValue={false} size="sm" className="mt-2" />
      {component.explanation && <p className="mt-2 text-xs text-slate-600">{component.explanation}</p>}
      {factors.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-800"
            aria-expanded={open}
          >
            {open ? 'Hide' : 'Show'} {factors.length} input factor{factors.length === 1 ? '' : 's'}
            {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
          {open && (
            <ul className="mt-2 space-y-1 rounded-lg bg-slate-50 p-3 text-xs">
              {factors.map((factor, index) => (
                <li key={`${factor.name}-${index}`} className="flex flex-wrap justify-between gap-2">
                  <span className="text-slate-600">
                    {factor.name}
                    {factor.detail && <span className="block text-slate-400">{factor.detail}</span>}
                  </span>
                  <span className="font-semibold text-slate-900 tabular">
                    {typeof factor.value === 'number' ? formatDecimal(factor.value, Math.abs(factor.value) < 10 ? 2 : 1) : String(factor.value ?? '—')}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </li>
  )
}

/** Full score presentation: gauge, band, contribution bar, per-component breakdown, disclaimer. */
export default function ScoreBreakdown({ score, title = 'Innovation score', showDisclaimer = true }) {
  if (!score) return null
  const components = sortComponents(score.components || [])
  return (
    <div className="space-y-5">
      <div className="grid gap-6 md:grid-cols-[auto_1fr] md:items-center">
        <div className="flex flex-col items-center gap-2">
          <ScoreGauge value={score.overall} label={title} />
          <BandBadge band={score.band} />
          {score.created_at && <span className="text-[11px] text-slate-400">Scored {formatDateTime(score.created_at)}</span>}
        </div>
        <div className="space-y-3">
          {score.explanation && <p className="text-sm text-slate-700">{score.explanation}</p>}
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">How the overall score is composed</p>
            <ContributionBar components={components} overall={score.overall} />
          </div>
        </div>
      </div>
      <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 px-4">
        {components.map((component) => (
          <ComponentRow key={component.key} component={component} />
        ))}
      </ul>
      {showDisclaimer && (
        <p className="flex gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900 ring-1 ring-inset ring-amber-200">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {score.disclaimer || DEFAULT_DISCLAIMER}
        </p>
      )}
    </div>
  )
}
