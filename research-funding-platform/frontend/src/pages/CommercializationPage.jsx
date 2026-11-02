import { Link, useSearchParams } from 'react-router-dom'
import clsx from 'clsx'
import { AlertTriangle, Building2, CheckCircle2, Factory, Handshake, KeyRound, Lightbulb, Plus, Rocket, Scale, Sparkles } from 'lucide-react'
import {
  Alert,
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  Field,
  LoadingState,
  PageHeader,
  ProgressBar,
  ScoreGauge,
  Select,
  Table,
} from '../components/ui'
import RecommendationCard from '../components/domain/RecommendationCard'
import { BandBadge } from '../components/domain/Badges'
import { ContributionBar } from '../components/domain/ScoreBreakdown'
import { commercializationApi } from '../api/commercialization'
import { useApi } from '../utils/hooks'
import { formatDecimal, formatScore } from '../utils/format'
import { PATHWAY_LABELS, labelFor } from '../utils/labels'

const PATHWAY_ICONS = {
  licensing: KeyRound,
  startup: Rocket,
  productization: Factory,
  industry_partnership: Handshake,
  grant_research: Scale,
}

function PathwayCard({ pathway, rank }) {
  const Icon = PATHWAY_ICONS[pathway.key] || Lightbulb
  return (
    <Card className={clsx('flex flex-col', pathway.recommended && 'ring-2 ring-indigo-500')}>
      <div className="flex items-start gap-3 px-5 pt-5">
        <span className={clsx('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', pathway.recommended ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600')}>
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-900">
              {rank}. {pathway.title || labelFor(PATHWAY_LABELS, pathway.key)}
            </h3>
            {pathway.recommended && (
              <Badge color="indigo" icon={CheckCircle2}>
                Recommended
              </Badge>
            )}
          </div>
          <ProgressBar value={pathway.fit_score} label="Fit score" size="sm" className="mt-2" />
        </div>
      </div>
      <div className="grid flex-1 gap-4 px-5 pb-5 pt-4 sm:grid-cols-2">
        {pathway.rationale?.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Why</p>
            <ul className="mt-1.5 list-disc space-y-1 pl-4 text-xs text-slate-600">
              {pathway.rationale.map((line, index) => (
                <li key={index}>{line}</li>
              ))}
            </ul>
          </div>
        )}
        {pathway.next_steps?.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Next steps</p>
            <ol className="mt-1.5 list-decimal space-y-1 pl-4 text-xs text-slate-600">
              {pathway.next_steps.map((line, index) => (
                <li key={index}>{line}</li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </Card>
  )
}

function ProjectInsights({ projectId }) {
  const { data, error, loading, reload } = useApi(() => commercializationApi.project(projectId), [projectId])
  if (error && !data) return <ErrorState message={error} onRetry={reload} />
  if (!data || (loading && String(data.project?.id) !== String(projectId))) return <LoadingState label="Analysing commercialization pathways…" />
  const pathways = [...(data.pathways || [])].sort((a, b) => (b.fit_score || 0) - (a.fit_score || 0))
  const score = data.score

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title={data.project?.title}
            subtitle="Commercialization summary"
            actions={
              <Link to={`/app/innovation/${projectId}`} className="text-xs font-medium text-indigo-600 hover:text-indigo-800">
                Score breakdown →
              </Link>
            }
          />
          <div className="space-y-4 px-5 py-4">
            {data.summary && <p className="text-sm leading-relaxed text-slate-700">{data.summary}</p>}
            {score?.components?.length > 0 && <ContributionBar components={score.components} overall={score.overall} />}
          </div>
        </Card>
        <Card padded className="flex flex-col items-center justify-center gap-2">
          <ScoreGauge value={score?.overall} label="Innovation score" size={170} />
          <BandBadge band={score?.band} />
        </Card>
      </div>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Commercialization pathways</h2>
        {pathways.length ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {pathways.map((pathway, index) => (
              <PathwayCard key={pathway.key} pathway={pathway} rank={index + 1} />
            ))}
          </div>
        ) : (
          <EmptyState compact title="No pathways generated" />
        )}
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title="Productization ideas" icon={Lightbulb} />
          <div className="px-5 py-4">
            {data.productization_ideas?.length ? (
              <ul className="space-y-3">
                {data.productization_ideas.map((idea, index) => (
                  <li key={index} className="rounded-lg bg-slate-50 p-3">
                    <p className="text-sm font-medium text-slate-900">{idea.title}</p>
                    <p className="mt-0.5 text-xs text-slate-600">{idea.description}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState compact title="No productization ideas" />
            )}
          </div>
        </Card>
        <Card>
          <CardHeader title="Potential partners" icon={Handshake} />
          <div className="px-5 py-4">
            {data.partners?.length ? (
              <ul className="divide-y divide-slate-100">
                {data.partners.map((partner, index) => (
                  <li key={`${partner.name}-${index}`} className="flex items-start gap-3 py-2.5">
                    <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                    <div>
                      <p className="text-sm font-medium text-slate-900">
                        {partner.name} <Badge color={partner.type === 'industry' ? 'violet' : 'sky'} size="xs">{partner.type === 'industry' ? 'Industry' : 'Academic'}</Badge>
                      </p>
                      {partner.reason && <p className="text-xs text-slate-500">{partner.reason}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState compact title="No partner suggestions" />
            )}
          </div>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title="Licensing targets" subtitle="Organisations patenting in this space" icon={KeyRound} />
          <div className="px-2 py-2">
            <Table
              dense
              rows={data.licensing_targets || []}
              rowKey="assignee"
              empty="No licensing targets identified."
              columns={[
                { key: 'assignee', header: 'Organisation', render: (row) => <span className="font-medium text-slate-800">{row.assignee}</span> },
                { key: 'patents', header: 'Related patents', align: 'right' },
                { key: 'relevance', header: 'Relevance', align: 'right', render: (row) => (row.relevance <= 1 ? formatDecimal(row.relevance * 100, 0) : formatDecimal(row.relevance, 0)) },
              ]}
            />
          </div>
        </Card>
        <Card>
          <CardHeader title="Risks to manage" icon={AlertTriangle} />
          <div className="px-5 py-4">
            {data.risks?.length ? (
              <ul className="space-y-2">
                {data.risks.map((risk, index) => (
                  <li key={index} className="flex gap-2 text-sm text-slate-700">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" aria-hidden="true" />
                    {risk}
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState compact title="No specific risks flagged" />
            )}
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader title="Funding to support commercialization" icon={Sparkles} />
        <div className="space-y-3 px-5 py-4">
          {data.funding?.length ? (
            data.funding.map((rec, index) => <RecommendationCard key={rec.funding?.id ?? index} rec={rec} rank={index + 1} compact />)
          ) : (
            <EmptyState compact title="No matching funding found" />
          )}
        </div>
      </Card>
    </div>
  )
}

export default function CommercializationPage() {
  const [params, setParams] = useSearchParams()
  const { data, error, loading, reload } = useApi(() => commercializationApi.overview(), [])
  const items = data?.items || []
  const projectId = params.get('project') || (items[0] ? String(items[0].project_id) : '')

  return (
    <div>
      <PageHeader
        icon={Rocket}
        title="Commercialization recommendations"
        description="Licensing, startup creation, productization, industry partnership and grant-funded research pathways for each innovation project."
      />
      {error && !data ? (
        <ErrorState message={error} onRetry={reload} />
      ) : loading && !data ? (
        <LoadingState />
      ) : items.length === 0 ? (
        <EmptyState
          icon={Rocket}
          title="No innovation projects to analyse"
          description="Create an innovation project first; commercialization pathways are generated from its score and the patent and funding landscape."
          action={
            <Button as={Link} to="/app/innovation?new=1" icon={Plus}>
              Create a project
            </Button>
          }
        />
      ) : (
        <div className="space-y-6">
          <Card padded>
            <div className="grid gap-4 xl:grid-cols-[minmax(0,28rem)_1fr] xl:items-end">
              <Field label="Project">
                {(id) => (
                  <Select
                    id={id}
                    value={projectId}
                    onChange={(e) => setParams({ project: e.target.value }, { replace: true })}
                    options={items.map((item) => ({ value: String(item.project_id), label: item.title }))}
                  />
                )}
              </Field>
              <Alert variant="neutral">
                Recommendations are rule-based guidance derived from the innovation score, patent landscape and funding data — use
                them as a starting point for expert review.
              </Alert>
            </div>
          </Card>
          {projectId && <ProjectInsights projectId={projectId} />}
          <Card>
            <CardHeader title="All projects at a glance" />
            <div className="px-2 py-2">
              <Table
                rows={items}
                rowKey="project_id"
                onRowClick={(row) => setParams({ project: String(row.project_id) }, { replace: true })}
                columns={[
                  { key: 'title', header: 'Project', render: (row) => <span className="font-medium text-slate-800">{row.title}</span> },
                  { key: 'overall', header: 'Score', align: 'right', render: (row) => formatScore(row.overall) },
                  { key: 'band', header: 'Band', render: (row) => <BandBadge band={row.band} /> },
                  { key: 'top_pathway', header: 'Best pathway', render: (row) => row.top_pathway_title || labelFor(PATHWAY_LABELS, row.top_pathway) },
                  { key: 'fit_score', header: 'Fit', align: 'right', render: (row) => formatScore(row.fit_score, 0) },
                ]}
              />
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
