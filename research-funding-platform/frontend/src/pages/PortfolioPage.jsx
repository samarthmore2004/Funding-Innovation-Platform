import { useState } from 'react'
import { Link } from 'react-router-dom'
import clsx from 'clsx'
import { Activity, ChevronLeft, ChevronRight, Database, FolderKanban, Gauge, RefreshCw } from 'lucide-react'
import { Button, Card, CardHeader, ErrorState, LoadingState, PageHeader, StatCard, Table, useToast } from '../components/ui'
import ChartFrame from '../components/charts/ChartFrame'
import BarChartBasic from '../components/charts/BarChartBasic'
import { BandBadge } from '../components/domain/Badges'
import { innovationApi } from '../api/innovation'
import { getErrorMessage } from '../api/client'
import { useApi } from '../utils/hooks'
import { useTaxonomy } from '../utils/taxonomy'
import { formatDecimal, formatNumber, formatScore } from '../utils/format'
import { STAGE_LABELS, STAGES, labelFor } from '../utils/labels'

function PipelineCard({ project, onMove, moving }) {
  const { domainName } = useTaxonomy()
  const index = STAGES.indexOf(project.stage)
  return (
    <li className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <Link to={`/app/innovation/${project.id}`} className="text-sm font-medium leading-snug text-slate-800 hover:text-indigo-700">
        {project.title}
      </Link>
      <p className="mt-0.5 text-[11px] text-slate-500">
        {domainName(project.domain)} · TRL {project.trl}
        {project.owner_name ? ` · ${project.owner_name}` : ''}
      </p>
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-xs text-slate-600">
          {project.latest_score ? (
            <>
              <span className="font-semibold text-slate-900">{formatScore(project.latest_score.overall)}</span> <BandBadge band={project.latest_score.band} />
            </>
          ) : (
            'Not scored'
          )}
        </span>
        <span className="flex gap-0.5">
          <button
            type="button"
            disabled={index <= 0 || moving}
            onClick={() => onMove(project, STAGES[index - 1])}
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30"
            aria-label={index > 0
              ? `Move ${project.title} back to ${STAGE_LABELS[STAGES[index - 1]]}`
              : `${project.title} is already at the first stage`}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            disabled={index >= STAGES.length - 1 || moving}
            onClick={() => onMove(project, STAGES[index + 1])}
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30"
            aria-label={index < STAGES.length - 1
              ? `Advance ${project.title} to ${STAGE_LABELS[STAGES[index + 1]]}`
              : `${project.title} is already at the final stage`}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </span>
      </div>
    </li>
  )
}

export default function PortfolioPage() {
  const toast = useToast()
  const { domainName } = useTaxonomy()
  const { data, error, loading, reload } = useApi(() => innovationApi.portfolio(), [])
  const [movingId, setMovingId] = useState(null)

  const move = async (project, stage) => {
    setMovingId(project.id)
    try {
      await innovationApi.setStage(project.id, stage)
      toast.success(`“${project.title}” moved to ${labelFor(STAGE_LABELS, stage)}.`)
      await reload()
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setMovingId(null)
    }
  }

  if (error && !data) return <ErrorState message={error} onRetry={reload} />
  if (!data) return <LoadingState label="Loading portfolio…" />

  const byStage = STAGES.map((stage) => {
    const row = (data.by_stage || []).find((r) => r.stage === stage) || {}
    return { stage, label: STAGE_LABELS[stage], count: row.count || 0, avg_score: row.avg_score }
  })
  const byDomain = (data.by_domain || []).map((row) => ({ ...row, label: row.name || domainName(row.domain) }))
  const distribution = data.score_distribution || []
  const pipeline = data.pipeline || {}

  return (
    <div>
      <PageHeader
        icon={FolderKanban}
        title="Portfolio & innovation pipeline"
        description="Portfolio analytics, pipeline tracking and score distribution across all innovation projects."
        actions={
          <Button variant="secondary" icon={RefreshCw} onClick={() => reload()} loading={loading}>
            Refresh
          </Button>
        }
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Projects" value={formatNumber(data.projects_count)} icon={Database} tone="indigo" />
        <StatCard label="Scored projects" value={formatNumber(data.scored_count)} icon={Activity} tone="violet" />
        <StatCard label="Average innovation score" value={formatScore(data.avg_score)} icon={Gauge} tone="sky" />
      </div>

      <Card className="mb-6">
        <CardHeader title="Pipeline board" subtitle="Use the arrows to move a project between stages." />
        <div className="overflow-x-auto p-4 scrollbar-thin">
          <div className="grid min-w-[60rem] grid-cols-5 gap-3">
            {STAGES.map((stage) => {
              const projects = pipeline[stage] || []
              return (
                <section key={stage} className="flex flex-col rounded-xl bg-slate-50 p-3" aria-label={`${STAGE_LABELS[stage]} stage`}>
                  <header className="mb-2 flex items-center justify-between">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-600">{STAGE_LABELS[stage]}</h3>
                    <span className="rounded-full bg-white px-2 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">{projects.length}</span>
                  </header>
                  <ul className={clsx('space-y-2', !projects.length && 'flex flex-1 items-center justify-center')}>
                    {projects.length ? (
                      projects.map((project) => <PipelineCard key={project.id} project={project} onMove={move} moving={movingId === project.id} />)
                    ) : (
                      <li className="py-6 text-xs text-slate-400">No projects</li>
                    )}
                  </ul>
                </section>
              )
            })}
          </div>
        </div>
      </Card>

      <div className="mb-6 grid gap-6 xl:grid-cols-3">
        <ChartFrame
          title="Projects by stage"
          table={{
            columns: [
              { key: 'label', label: 'Stage' },
              { key: 'count', label: 'Projects', align: 'right' },
              { key: 'avg_score', label: 'Avg score', align: 'right', format: (v) => formatScore(v) },
            ],
            rows: byStage,
          }}
        >
          <BarChartBasic data={byStage} categoryKey="label" bars={[{ key: 'count', name: 'Projects' }]} showValues height={240} />
        </ChartFrame>
        <ChartFrame
          title="Projects by technology domain"
          empty={!byDomain.length}
          table={{
            columns: [
              { key: 'label', label: 'Domain' },
              { key: 'count', label: 'Projects', align: 'right' },
              { key: 'avg_score', label: 'Avg score', align: 'right', format: (v) => formatScore(v) },
            ],
            rows: byDomain,
          }}
        >
          <BarChartBasic data={byDomain} categoryKey="label" bars={[{ key: 'count', name: 'Projects' }]} horizontal showValues />
        </ChartFrame>
        <ChartFrame
          title="Score distribution"
          empty={!distribution.length}
          table={{ columns: [{ key: 'bucket', label: 'Score range' }, { key: 'count', label: 'Projects', align: 'right' }], rows: distribution }}
        >
          <BarChartBasic data={distribution} categoryKey="bucket" bars={[{ key: 'count', name: 'Projects' }]} showValues height={240} />
        </ChartFrame>
      </div>

      <Card>
        <CardHeader title="Top-scoring projects" />
        <div className="px-2 py-2">
          <Table
            rows={data.top_projects || []}
            empty="No scored projects yet."
            columns={[
              {
                key: 'title',
                header: 'Project',
                render: (row) => (
                  <Link to={`/app/innovation/${row.id}`} className="font-medium text-slate-800 hover:text-indigo-700">
                    {row.title}
                  </Link>
                ),
              },
              { key: 'owner_name', header: 'Owner', render: (row) => row.owner_name || '—' },
              { key: 'domain', header: 'Domain', render: (row) => domainName(row.domain) },
              { key: 'stage', header: 'Stage', render: (row) => labelFor(STAGE_LABELS, row.stage) },
              { key: 'trl', header: 'TRL', align: 'right' },
              { key: 'score', header: 'Score', align: 'right', render: (row) => formatScore(row.latest_score?.overall) },
              { key: 'band', header: 'Band', render: (row) => <BandBadge band={row.latest_score?.band} /> },
            ]}
          />
        </div>
      </Card>
      <p className="mt-3 text-xs text-slate-500">Average scores use each project’s latest scoring run ({formatDecimal(data.scored_count, 0)} scored).</p>
    </div>
  )
}
