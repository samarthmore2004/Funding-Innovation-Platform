import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Gauge, Pencil, Rocket, Sparkles, Trash2, Zap } from 'lucide-react'
import {
  Button,
  Card,
  CardHeader,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  LoadingState,
  Modal,
  PageHeader,
  Select,
  Table,
  useToast,
} from '../components/ui'
import ChartFrame from '../components/charts/ChartFrame'
import TrendLineChart from '../components/charts/TrendLineChart'
import ProjectForm, { TRL_DESCRIPTIONS } from '../components/domain/ProjectForm'
import ScoreBreakdown from '../components/domain/ScoreBreakdown'
import RecommendationCard from '../components/domain/RecommendationCard'
import { BandBadge } from '../components/domain/Badges'
import { innovationApi } from '../api/innovation'
import { recommendationsApi } from '../api/recommendations'
import { getErrorMessage } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { useApi } from '../utils/hooks'
import { useTaxonomy } from '../utils/taxonomy'
import { formatDate, formatDateTime, formatScore } from '../utils/format'
import { MARKET_SIZE_LABELS, STAGE_LABELS, STAGES, labelFor } from '../utils/labels'

function Detail({ label, children }) {
  return (
    <div>
      <dt className="text-xs font-medium text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-slate-800">{children ?? '—'}</dd>
    </div>
  )
}

function MatchedFunding({ projectId }) {
  const { data, error, loading, reload } = useApi(() => recommendationsApi.forProject(projectId, { limit: 5 }), [projectId])
  const items = data?.items || []
  return (
    <Card>
      <CardHeader title="Funding matched to this project" subtitle="TF-IDF similarity between the project and open opportunities" icon={Sparkles} />
      <div className="space-y-3 px-5 py-4">
        {error ? (
          <p className="text-sm text-rose-600">
            {error}{' '}
            <button type="button" className="underline" onClick={() => reload()}>
              Retry
            </button>
          </p>
        ) : loading && !data ? (
          <LoadingState compact />
        ) : items.length === 0 ? (
          <EmptyState compact title="No matching opportunities" description="Add keywords or a richer description to improve matching." />
        ) : (
          items.map((rec, index) => <RecommendationCard key={rec.funding?.id ?? index} rec={rec} rank={index + 1} compact />)
        )}
      </div>
    </Card>
  )
}

export default function ProjectDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const { user, hasRole } = useAuth()
  const { domainName } = useTaxonomy()
  const { data: project, error, loading, reload } = useApi(() => innovationApi.getProject(id), [id])
  const [scoring, setScoring] = useState(false)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  if (error && !project) return <ErrorState message={error} onRetry={reload} />
  if (!project || (loading && String(project.id) !== String(id))) return <LoadingState />

  const isOwner = project.owner_id === user?.id
  const canEdit = isOwner || hasRole('admin')
  const canScore = isOwner || hasRole('innovation_manager', 'admin')
  const history = [...(project.score_history || [])].sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))
  const historyRows = history.map((s, index) => ({ ...s, run: index + 1, when: formatDate(s.created_at, { day: 'numeric', month: 'short' }) }))

  const score = async () => {
    setScoring(true)
    try {
      const result = await innovationApi.score(project.id)
      toast.success(`Innovation score: ${Number(result?.overall ?? 0).toFixed(1)}`)
      reload()
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setScoring(false)
    }
  }

  const changeStage = async (stage) => {
    try {
      await innovationApi.setStage(project.id, stage)
      toast.success(`Moved to ${labelFor(STAGE_LABELS, stage)}.`)
      reload()
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  const save = async (payload) => {
    setSaving(true)
    try {
      await innovationApi.updateProject(project.id, payload)
      toast.success('Project updated. Re-score to refresh the breakdown.')
      setEditing(false)
      reload()
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    try {
      await innovationApi.deleteProject(project.id)
      toast.success('Project deleted.')
      navigate('/app/innovation', { replace: true })
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  return (
    <div>
      <PageHeader
        icon={Gauge}
        breadcrumbs={[{ label: 'Innovation scoring', to: '/app/innovation' }, { label: project.title }]}
        title={project.title}
        description={`${domainName(project.domain)} · ${labelFor(STAGE_LABELS, project.stage)}${project.owner_name ? ` · ${project.owner_name}` : ''}`}
        actions={
          <>
            {canScore && (
              <Button icon={Zap} onClick={score} loading={scoring}>
                {project.latest_score ? 'Re-score' : 'Score now'}
              </Button>
            )}
            <Button variant="secondary" icon={Rocket} as={Link} to={`/app/commercialization?project=${project.id}`}>
              Commercialization
            </Button>
            {canEdit && (
              <Button variant="secondary" icon={Pencil} onClick={() => setEditing(true)}>
                Edit
              </Button>
            )}
            {canEdit && (
              <Button variant="danger-ghost" icon={Trash2} onClick={() => setDeleting(true)}>
                Delete
              </Button>
            )}
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card>
            <CardHeader title="Score breakdown" subtitle={project.latest_score ? undefined : 'This project has not been scored yet.'} />
            <div className="px-5 py-5">
              {project.latest_score ? (
                <ScoreBreakdown score={project.latest_score} />
              ) : (
                <EmptyState
                  compact
                  icon={Gauge}
                  title="Not scored yet"
                  description="Run the scoring engine to get the five-component breakdown."
                  action={
                    canScore ? (
                      <Button icon={Zap} onClick={score} loading={scoring}>
                        Score now
                      </Button>
                    ) : null
                  }
                />
              )}
            </div>
          </Card>
          {historyRows.length > 1 && (
            <ChartFrame
              title="Score history"
              subtitle="Overall score each time the project was scored"
              table={{
                columns: [
                  { key: 'created_at', label: 'Scored', format: (v) => formatDateTime(v) },
                  { key: 'overall', label: 'Overall', align: 'right', format: (v) => formatScore(v) },
                  { key: 'band', label: 'Band' },
                ],
                rows: historyRows,
              }}
            >
              <TrendLineChart
                data={historyRows}
                series={[{ key: 'overall', name: 'Overall score' }]}
                xKey="run"
                xFormatter={(run) => historyRows[run - 1]?.when || run}
                valueFormatter={(v) => formatScore(v)}
                height={220}
              />
            </ChartFrame>
          )}
          <MatchedFunding projectId={project.id} />
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Project details" />
            <div className="space-y-4 px-5 py-4">
              <p className="whitespace-pre-line text-sm text-slate-700">{project.description}</p>
              <dl className="grid grid-cols-2 gap-4">
                <Detail label="Domain">{domainName(project.domain)}</Detail>
                <Detail label="Stage">
                  {canScore || canEdit ? (
                    <Select
                      aria-label="Pipeline stage"
                      value={project.stage}
                      onChange={(e) => changeStage(e.target.value)}
                      options={STAGES.map((s) => ({ value: s, label: STAGE_LABELS[s] }))}
                      className="h-8 text-xs"
                    />
                  ) : (
                    labelFor(STAGE_LABELS, project.stage)
                  )}
                </Detail>
                <Detail label="Technology readiness">
                  TRL {project.trl}
                  <span className="block text-xs text-slate-500">{TRL_DESCRIPTIONS[project.trl]}</span>
                </Detail>
                <Detail label="Market size">{labelFor(MARKET_SIZE_LABELS, project.market_size)}</Detail>
                <Detail label="Target market">{project.target_market || '—'}</Detail>
                <Detail label="Team size">{project.team_size ?? '—'}</Detail>
                <Detail label="Patents filed / granted">
                  {project.patents_filed ?? 0} / {project.patents_granted ?? 0}
                </Detail>
                <Detail label="Industry partner">{project.has_industry_partner ? 'Yes' : 'No'}</Detail>
              </dl>
              {project.keywords?.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {project.keywords.map((keyword) => (
                    <span key={keyword} className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600">
                      {keyword}
                    </span>
                  ))}
                </div>
              )}
              <p className="text-[11px] text-slate-400">
                Created {formatDateTime(project.created_at)} · updated {formatDateTime(project.updated_at)}
              </p>
            </div>
          </Card>
          {history.length > 0 && (
            <Card>
              <CardHeader title="Scoring runs" />
              <div className="px-2 py-2">
                <Table
                  dense
                  rows={[...history].reverse()}
                  rowKey={(row, index) => row.id ?? index}
                  columns={[
                    { key: 'created_at', header: 'When', render: (row) => formatDateTime(row.created_at) },
                    { key: 'overall', header: 'Score', align: 'right', render: (row) => formatScore(row.overall) },
                    { key: 'band', header: 'Band', render: (row) => <BandBadge band={row.band} /> },
                  ]}
                />
              </div>
            </Card>
          )}
        </div>
      </div>

      <Modal open={editing} onClose={() => setEditing(false)} title="Edit project" size="lg">
        {editing && <ProjectForm initial={project} onSubmit={save} submitting={saving} onCancel={() => setEditing(false)} submitLabel="Save changes" />}
      </Modal>
      <ConfirmDialog
        open={deleting}
        danger
        title="Delete project?"
        message="The project and its score history will be permanently removed."
        confirmLabel="Delete"
        onConfirm={remove}
        onCancel={() => setDeleting(false)}
      />
    </div>
  )
}
