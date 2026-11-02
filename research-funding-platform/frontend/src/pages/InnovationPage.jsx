import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Calculator, FlaskConical, Gauge, Pencil, Plus, Rocket, Trash2, Zap } from 'lucide-react'
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
  ScoreGauge,
  SegmentedControl,
  Select,
  useToast,
} from '../components/ui'
import ProjectForm from '../components/domain/ProjectForm'
import ScoreBreakdown from '../components/domain/ScoreBreakdown'
import FormulaCard from '../components/domain/FormulaCard'
import { BandBadge } from '../components/domain/Badges'
import { innovationApi } from '../api/innovation'
import { getErrorMessage } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { useApi } from '../utils/hooks'
import { useTaxonomy } from '../utils/taxonomy'
import { formatDateTime } from '../utils/format'
import { MARKET_SIZE_LABELS, STAGE_LABELS, labelFor } from '../utils/labels'

function ProjectCard({ project, showOwner, onScore, onEdit, onDelete, scoring }) {
  const { domainName } = useTaxonomy()
  const score = project.latest_score
  return (
    <Card className="flex flex-col">
      <div className="flex items-start gap-4 p-5">
        <div className="min-w-0 flex-1">
          <Link to={`/app/innovation/${project.id}`} className="text-sm font-semibold text-slate-900 hover:text-indigo-700">
            {project.title}
          </Link>
          <p className="mt-0.5 text-xs text-slate-500">
            {domainName(project.domain)} · {labelFor(STAGE_LABELS, project.stage)} · TRL {project.trl} · {labelFor(MARKET_SIZE_LABELS, project.market_size)} market
          </p>
          {showOwner && project.owner_name && <p className="mt-0.5 text-xs text-slate-400">Owner: {project.owner_name}</p>}
          <p className="mt-2 line-clamp-3 text-sm text-slate-600">{project.description}</p>
        </div>
        <div className="flex shrink-0 flex-col items-center">
          <ScoreGauge value={score?.overall} size={104} label={null} />
          {score ? <BandBadge band={score.band} /> : <span className="text-[11px] text-slate-400">Not scored</span>}
        </div>
      </div>
      <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-slate-100 px-5 py-3">
        <Button size="xs" icon={Zap} onClick={() => onScore(project)} loading={scoring}>
          {score ? 'Re-score' : 'Score now'}
        </Button>
        <Button size="xs" variant="secondary" as={Link} to={`/app/innovation/${project.id}`}>
          Breakdown
        </Button>
        <Button size="xs" variant="ghost" icon={Rocket} as={Link} to={`/app/commercialization?project=${project.id}`}>
          Commercialize
        </Button>
        <span className="ml-auto flex gap-1">
          {onEdit && (
            <Button size="icon-sm" variant="ghost" onClick={() => onEdit(project)} aria-label="Edit project">
              <Pencil className="h-4 w-4" />
            </Button>
          )}
          {onDelete && (
            <Button size="icon-sm" variant="danger-ghost" onClick={() => onDelete(project)} aria-label="Delete project">
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </span>
      </div>
      {score?.created_at && <p className="px-5 pb-3 text-[11px] text-slate-400">Last scored {formatDateTime(score.created_at)}</p>}
    </Card>
  )
}

function WhatIfPanel({ projects }) {
  const toast = useToast()
  const [baseId, setBaseId] = useState('')
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState(false)
  const base = projects.find((p) => String(p.id) === baseId) || null

  const preview = async (payload) => {
    setBusy(true)
    try {
      setResult(await innovationApi.scorePreview(payload))
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <Card>
        <CardHeader
          title="What-if analysis"
          subtitle="Change inputs and preview the score without saving anything."
          icon={Calculator}
          actions={
            projects.length > 0 ? (
              <Select
                aria-label="Start from project"
                value={baseId}
                onChange={(e) => {
                  setBaseId(e.target.value)
                  setResult(null)
                }}
                options={projects.map((p) => ({ value: String(p.id), label: p.title }))}
                placeholder="Start from scratch"
                className="h-9 w-56"
              />
            ) : null
          }
        />
        <div className="px-5 py-4">
          <ProjectForm key={baseId || 'blank'} initial={base} onSubmit={preview} submitLabel="Preview score" submitting={busy} />
        </div>
      </Card>
      <Card>
        <CardHeader title="Preview result" subtitle="Not saved" icon={Gauge} />
        <div className="px-5 py-4">
          {result ? (
            <ScoreBreakdown score={result} title="Preview score" />
          ) : (
            <EmptyState compact icon={FlaskConical} title="No preview yet" description="Fill in the form and choose “Preview score”." />
          )}
        </div>
      </Card>
    </div>
  )
}

export default function InnovationPage() {
  const toast = useToast()
  const navigate = useNavigate()
  const { user, hasRole } = useAuth()
  const [params, setParams] = useSearchParams()
  const canSeeAll = hasRole('innovation_manager', 'admin')
  const [scope, setScope] = useState('mine')
  const [view, setView] = useState('projects')
  const { data, error, loading, reload } = useApi(() => innovationApi.projects(scope), [scope])
  const [modal, setModal] = useState(null) // { project } | { project: null }
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(null)
  const [scoringId, setScoringId] = useState(null)

  useEffect(() => {
    if (params.get('new') === '1') {
      setModal({ project: null })
      const next = new URLSearchParams(params)
      next.delete('new')
      setParams(next, { replace: true })
    }
  }, [params, setParams])

  const projects = data || []
  const canModify = (project) => project.owner_id === user?.id || hasRole('admin')

  const save = async (payload) => {
    setSaving(true)
    try {
      if (modal?.project?.id) {
        await innovationApi.updateProject(modal.project.id, payload)
        toast.success('Project updated.')
        setModal(null)
        reload()
      } else {
        const created = await innovationApi.createProject(payload)
        toast.success('Project created. Scoring it now…')
        setModal(null)
        if (created?.id) {
          try {
            await innovationApi.score(created.id)
          } catch {
            /* the detail page offers manual scoring */
          }
          navigate(`/app/innovation/${created.id}`)
        } else reload()
      }
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const score = async (project) => {
    setScoringId(project.id)
    try {
      const result = await innovationApi.score(project.id)
      toast.success(`Innovation score: ${Number(result?.overall ?? 0).toFixed(1)} (${result?.band || 'scored'})`)
      reload()
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setScoringId(null)
    }
  }

  const remove = async () => {
    try {
      await innovationApi.deleteProject(deleting.id)
      toast.success('Project deleted.')
      setDeleting(null)
      reload()
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  return (
    <div>
      <PageHeader
        icon={Gauge}
        title="Innovation scoring"
        description="Score innovation projects on research novelty, patent strength, technology maturity, market potential and funding relevance."
        actions={
          <Button icon={Plus} onClick={() => setModal({ project: null })}>
            New project
          </Button>
        }
      />
      <div className="mb-6">
        <FormulaCard />
      </div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <SegmentedControl
          ariaLabel="Section"
          value={view}
          onChange={setView}
          options={[
            { value: 'projects', label: 'Projects' },
            { value: 'whatif', label: 'What-if preview' },
          ]}
        />
        {canSeeAll && view === 'projects' && (
          <SegmentedControl
            ariaLabel="Project scope"
            value={scope}
            onChange={setScope}
            options={[
              { value: 'mine', label: 'My projects' },
              { value: 'all', label: 'All projects' },
            ]}
          />
        )}
      </div>

      {view === 'whatif' ? (
        <WhatIfPanel projects={projects} />
      ) : error && !data ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !data ? (
        <LoadingState />
      ) : projects.length === 0 ? (
        <EmptyState
          icon={Gauge}
          title="No innovation projects yet"
          description="Describe a research output, technology or startup idea to receive an explainable innovation score."
          action={
            <Button icon={Plus} onClick={() => setModal({ project: null })}>
              Create your first project
            </Button>
          }
        />
      ) : (
        <div className={loading ? 'grid gap-4 opacity-60 lg:grid-cols-2' : 'grid gap-4 lg:grid-cols-2'}>
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              showOwner={scope === 'all'}
              scoring={scoringId === project.id}
              onScore={score}
              onEdit={canModify(project) ? (p) => setModal({ project: p }) : null}
              onDelete={canModify(project) ? setDeleting : null}
            />
          ))}
        </div>
      )}

      <Modal open={Boolean(modal)} onClose={() => setModal(null)} title={modal?.project?.id ? 'Edit project' : 'New innovation project'} size="lg">
        {modal && (
          <ProjectForm
            key={modal.project?.id || 'new'}
            initial={modal.project}
            onSubmit={save}
            submitting={saving}
            onCancel={() => setModal(null)}
            submitLabel={modal.project?.id ? 'Save changes' : 'Create & score'}
          />
        )}
      </Modal>
      <ConfirmDialog
        open={Boolean(deleting)}
        danger
        title="Delete project?"
        message={`“${deleting?.title}” and its score history will be permanently removed.`}
        confirmLabel="Delete"
        onConfirm={remove}
        onCancel={() => setDeleting(null)}
      />
    </div>
  )
}
