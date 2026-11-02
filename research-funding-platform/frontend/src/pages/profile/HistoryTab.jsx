import { useState } from 'react'
import { History, Pencil, Plus, Trash2 } from 'lucide-react'
import {
  Alert,
  Badge,
  Button,
  Card,
  CardHeader,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Field,
  Input,
  LoadingState,
  Modal,
  Select,
  Textarea,
  useToast,
} from '../../components/ui'
import { profileApi } from '../../api/profile'
import { getErrorMessage } from '../../api/client'
import { useApi } from '../../utils/hooks'
import { HISTORY_KIND_LABELS, labelFor, optionsFrom } from '../../utils/labels'

const KIND_COLORS = { position: 'indigo', project: 'violet', grant: 'green', education: 'sky', award: 'amber' }
const EMPTY = { kind: 'position', title: '', role: '', institution: '', start_year: '', end_year: '', description: '' }

function HistoryForm({ initial, onSubmit, onCancel, submitting }) {
  const [form, setForm] = useState(() => ({ ...EMPTY, ...(initial || {}) }))
  const [error, setError] = useState(null)
  const set = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }))
  const submit = (event) => {
    event.preventDefault()
    const start = form.start_year === '' || form.start_year === null ? null : parseInt(form.start_year, 10)
    const end = form.end_year === '' || form.end_year === null ? null : parseInt(form.end_year, 10)
    if (form.title.trim().length < 2) return setError('Enter a title.')
    if (start !== null && (start < 1950 || start > 2100)) return setError('Start year looks invalid.')
    if (end !== null && start !== null && end < start) return setError('End year cannot be before the start year.')
    setError(null)
    onSubmit({
      kind: form.kind,
      title: form.title.trim(),
      role: form.role?.trim() || null,
      institution: form.institution?.trim() || null,
      start_year: start,
      end_year: end,
      description: form.description?.trim() || null,
    })
  }
  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {error && <Alert variant="error">{error}</Alert>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Type">{(id) => <Select id={id} value={form.kind} onChange={set('kind')} options={optionsFrom(HISTORY_KIND_LABELS)} />}</Field>
        <Field label="Title" required>{(id) => <Input id={id} value={form.title} onChange={set('title')} placeholder="e.g. Postdoctoral researcher" />}</Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Role">{(id) => <Input id={id} value={form.role || ''} onChange={set('role')} placeholder="e.g. Principal investigator" />}</Field>
        <Field label="Institution">{(id) => <Input id={id} value={form.institution || ''} onChange={set('institution')} />}</Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Start year">{(id) => <Input id={id} type="number" value={form.start_year ?? ''} onChange={set('start_year')} />}</Field>
        <Field label="End year" hint="Leave empty if ongoing.">{(id) => <Input id={id} type="number" value={form.end_year ?? ''} onChange={set('end_year')} />}</Field>
      </div>
      <Field label="Description">{(id) => <Textarea id={id} rows={3} value={form.description || ''} onChange={set('description')} />}</Field>
      <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
        <Button variant="secondary" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" loading={submitting}>
          Save entry
        </Button>
      </div>
    </form>
  )
}

export default function HistoryTab({ onChanged }) {
  const toast = useToast()
  const { data, error, loading, reload } = useApi(() => profileApi.listHistory(), [])
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(null)
  const items = [...(data || [])].sort((a, b) => (b.start_year || 0) - (a.start_year || 0))

  const save = async (payload) => {
    setSaving(true)
    try {
      if (editing?.id) await profileApi.updateHistory(editing.id, payload)
      else await profileApi.createHistory(payload)
      toast.success('History entry saved.')
      setEditing(null)
      reload()
      onChanged?.()
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    try {
      await profileApi.deleteHistory(deleting.id)
      toast.success('Entry deleted.')
      setDeleting(null)
      reload()
      onChanged?.()
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  return (
    <Card>
      <CardHeader
        title="Research history"
        subtitle="Positions, projects, grants, education and awards."
        icon={History}
        actions={
          <Button size="sm" icon={Plus} onClick={() => setEditing({})}>
            Add entry
          </Button>
        }
      />
      <div className="px-5 py-4">
        {error ? (
          <ErrorState compact message={error} onRetry={reload} />
        ) : loading && !data ? (
          <LoadingState compact />
        ) : items.length === 0 ? (
          <EmptyState compact title="No history entries yet" description="Build your academic and professional timeline." />
        ) : (
          <ol className="relative space-y-5 border-l border-slate-200 pl-6">
            {items.map((item) => (
              <li key={item.id} className="relative">
                <span className="absolute -left-[1.85rem] top-1.5 h-3 w-3 rounded-full border-2 border-white bg-indigo-500 ring-1 ring-indigo-200" aria-hidden="true" />
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge color={KIND_COLORS[item.kind] || 'slate'}>{labelFor(HISTORY_KIND_LABELS, item.kind)}</Badge>
                      <span className="text-xs text-slate-500">
                        {item.start_year || '—'} – {item.end_year || 'present'}
                      </span>
                    </div>
                    <p className="mt-1 text-sm font-semibold text-slate-900">{item.title}</p>
                    <p className="text-xs text-slate-500">{[item.role, item.institution].filter(Boolean).join(' · ')}</p>
                    {item.description && <p className="mt-1 max-w-2xl text-sm text-slate-600">{item.description}</p>}
                  </div>
                  <div className="flex gap-1">
                    <Button size="icon-sm" variant="ghost" onClick={() => setEditing(item)} aria-label="Edit entry">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon-sm" variant="danger-ghost" onClick={() => setDeleting(item)} aria-label="Delete entry">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
      <Modal open={Boolean(editing)} onClose={() => setEditing(null)} title={editing?.id ? 'Edit history entry' : 'Add history entry'}>
        {editing && <HistoryForm key={editing.id || 'new'} initial={editing.id ? editing : null} onSubmit={save} onCancel={() => setEditing(null)} submitting={saving} />}
      </Modal>
      <ConfirmDialog
        open={Boolean(deleting)}
        danger
        title="Delete entry?"
        message={`“${deleting?.title}” will be removed from your research history.`}
        confirmLabel="Delete"
        onConfirm={remove}
        onCancel={() => setDeleting(null)}
      />
    </Card>
  )
}
