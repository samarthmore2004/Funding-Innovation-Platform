import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Info, RefreshCw, Sparkles, UserRound } from 'lucide-react'
import {
  Alert,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Field,
  LoadingState,
  PageHeader,
  ProgressBar,
  Select,
  Toggle,
  useToast,
} from '../components/ui'
import RecommendationCard from '../components/domain/RecommendationCard'
import { recommendationsApi } from '../api/recommendations'
import { fundingApi } from '../api/funding'
import { getErrorMessage } from '../api/client'
import { useApi } from '../utils/hooks'
import { formatDateTime, formatNumber } from '../utils/format'
import { FUNDER_TYPE_LABELS, optionsFrom } from '../utils/labels'

const LIMITS = [10, 20, 50].map((n) => ({ value: String(n), label: `Top ${n}` }))
const MIN_SCORES = [0, 25, 40, 60, 75].map((n) => ({ value: String(n), label: n ? `Match ≥ ${n}` : 'Any match score' }))

export default function RecommendationsPage() {
  const toast = useToast()
  const [limit, setLimit] = useState('10')
  const [includeIneligible, setIncludeIneligible] = useState(false)
  const [funderType, setFunderType] = useState('')
  const [minScore, setMinScore] = useState('0')
  const [dismissed, setDismissed] = useState(() => new Set())
  const [busy, setBusy] = useState({})

  const { data, error, loading, reload } = useApi(
    () =>
      recommendationsApi.list({
        limit: Number(limit),
        include_ineligible: includeIneligible,
        funder_type: funderType,
        min_score: Number(minScore) || undefined,
      }),
    [limit, includeIneligible, funderType, minScore],
  )

  const items = (data?.items || []).filter((rec) => !dismissed.has(rec.funding?.id))

  const sendFeedback = (fundingId, action) => recommendationsApi.feedback(fundingId, action).catch(() => {})

  const save = async (rec) => {
    const id = rec.funding.id
    setBusy((prev) => ({ ...prev, [id]: 'save' }))
    try {
      await fundingApi.save(id, { status: 'interested' })
      sendFeedback(id, 'saved')
      toast.success('Added to your tracked opportunities.')
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setBusy((prev) => ({ ...prev, [id]: null }))
    }
  }

  const dismiss = async (rec) => {
    const id = rec.funding.id
    setBusy((prev) => ({ ...prev, [id]: 'dismiss' }))
    try {
      await recommendationsApi.feedback(id, 'dismissed')
      setDismissed((prev) => new Set(prev).add(id))
      toast.info('Thanks — we recorded that this was not relevant.')
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setBusy((prev) => ({ ...prev, [id]: null }))
    }
  }

  return (
    <div>
      <PageHeader
        icon={Sparkles}
        title="Personalized recommendations"
        description="Funding opportunities ranked by TF-IDF cosine similarity between your research profile and each opportunity, combined with rule-based eligibility checks."
        actions={
          <Button variant="secondary" icon={RefreshCw} onClick={() => reload()} loading={loading && Boolean(data)}>
            Refresh
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[18rem_1fr]">
        <aside className="space-y-4">
          <Card padded className="space-y-4">
            <Field label="Number of results">
              {(id) => <Select id={id} value={limit} onChange={(e) => setLimit(e.target.value)} options={LIMITS} />}
            </Field>
            <Field label="Funder type">
              {(id) => <Select id={id} value={funderType} onChange={(e) => setFunderType(e.target.value)} options={optionsFrom(FUNDER_TYPE_LABELS)} placeholder="All types" />}
            </Field>
            <Field label="Minimum match score">
              {(id) => <Select id={id} value={minScore} onChange={(e) => setMinScore(e.target.value)} options={MIN_SCORES} />}
            </Field>
            <Toggle
              checked={includeIneligible}
              onChange={setIncludeIneligible}
              label="Include ineligible"
              description="Show opportunities that fail an eligibility rule."
            />
          </Card>

          {data && (
            <Card padded className="space-y-3">
              <ProgressBar value={data.profile_completeness} label="Profile completeness" valueText={`${formatNumber(data.profile_completeness ?? 0)}%`} />
              {data.profile_terms?.length > 0 && (
                <div>
                  <p className="mb-1.5 text-xs font-medium text-slate-500">Profile terms used for matching</p>
                  <div className="flex flex-wrap gap-1">
                    {data.profile_terms.slice(0, 24).map((term) => (
                      <span key={term} className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600">
                        {term}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <Button as={Link} to="/app/profile" variant="subtle" size="sm" icon={UserRound} className="w-full">
                Improve my profile
              </Button>
              {data.generated_at && <p className="text-[11px] text-slate-400">Generated {formatDateTime(data.generated_at)}</p>}
            </Card>
          )}

          <Card padded className="text-xs text-slate-600">
            <p className="flex items-center gap-1.5 font-semibold text-slate-800">
              <Info className="h-3.5 w-3.5" /> How matching works
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-4">
              <li>Your domains, keywords, technology areas, bio and publications form a text profile.</li>
              <li>Each opportunity’s title, description, domains and keywords are vectorised with TF-IDF.</li>
              <li>Cosine similarity measures topical overlap; eligibility rules check applicant type, country, career stage and deadline.</li>
              <li>The match score blends both; matched terms explain the result.</li>
            </ul>
          </Card>
        </aside>

        <section className="min-w-0 space-y-4">
          {data?.notes?.length > 0 && (
            <Alert variant="info">
              <ul className="space-y-0.5">
                {data.notes.map((note, index) => (
                  <li key={index}>{note}</li>
                ))}
              </ul>
            </Alert>
          )}
          {error && !data ? (
            <ErrorState message={error} onRetry={reload} />
          ) : !data ? (
            <LoadingState label="Matching opportunities to your profile…" />
          ) : items.length === 0 ? (
            <EmptyState
              icon={Sparkles}
              title="No recommendations for these settings"
              description="Complete your research profile (domains and keywords), lower the minimum score or include ineligible opportunities."
              action={
                <Button as={Link} to="/app/profile" variant="secondary">
                  Complete profile
                </Button>
              }
            />
          ) : (
            <div className={loading ? 'space-y-4 opacity-60 transition-opacity' : 'space-y-4 transition-opacity'}>
              {items.map((rec, index) => (
                <RecommendationCard
                  key={rec.funding.id}
                  rec={rec}
                  rank={index + 1}
                  busy={busy[rec.funding.id]}
                  onSave={save}
                  onDismiss={dismiss}
                  onOpen={(funding) => sendFeedback(funding.id, 'clicked')}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
