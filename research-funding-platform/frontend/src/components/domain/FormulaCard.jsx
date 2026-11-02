import { Info, Sigma } from 'lucide-react'
import { Card } from '../ui/Card'
import { innovationApi } from '../../api/innovation'
import { useApi } from '../../utils/hooks'
import { COMPONENT_ORDER, componentColor } from './ScoreBreakdown'

const FALLBACK_LABELS = {
  research_novelty: 'Research Novelty',
  patent_strength: 'Patent Strength',
  technology_maturity: 'Technology Maturity',
  market_potential: 'Market Potential',
  funding_relevance: 'Funding Relevance',
}

/** Shows the scoring formula and weights returned by GET /api/innovation/weights, plus the disclaimer. */
export default function FormulaCard({ compact = false }) {
  const { data } = useApi(() => innovationApi.weights(), [])
  const weights = data?.weights || {}
  const labels = data?.labels || FALLBACK_LABELS
  const keys = COMPONENT_ORDER.filter((key) => weights[key] !== undefined)
  return (
    <Card padded>
      <div className="flex flex-wrap items-start gap-4">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
          <Sigma className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900">Weighted innovation scoring model</p>
          <p className="mt-1 font-mono text-xs text-slate-600">
            {data?.formula ||
              'Innovation Score = 0.30·Research Novelty + 0.20·Patent Strength + 0.15·Technology Maturity + 0.20·Market Potential + 0.15·Funding Relevance'}
          </p>
          {keys.length > 0 && !compact && (
            <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-slate-600">
              {keys.map((key) => (
                <li key={key} className="inline-flex items-center gap-1.5">
                  <span className="inline-block h-2.5 w-2.5 rounded-[3px]" style={{ background: componentColor(key) }} aria-hidden="true" />
                  {labels[key] || FALLBACK_LABELS[key]} <span className="font-semibold text-slate-900">{Math.round(weights[key] * 100)}%</span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 flex gap-1.5 text-xs text-amber-800">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {data?.disclaimer ||
              'Each component is normalised to 0–100. This is a heuristic decision-support score, not a validated prediction of commercial success.'}
          </p>
        </div>
      </div>
    </Card>
  )
}
