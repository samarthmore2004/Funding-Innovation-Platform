import { useState } from 'react'
import { ExternalLink, FileText, Pencil, Plus, Trash2 } from 'lucide-react'
import {
  Alert,
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
  Table,
  TagInput,
  Textarea,
  useToast,
} from '../../components/ui'
import { PatentStatusBadge } from '../../components/domain/Badges'
import { profileApi } from '../../api/profile'
import { getErrorMessage } from '../../api/client'
import { useApi } from '../../utils/hooks'
import { useTaxonomy } from '../../utils/taxonomy'
import { formatDate, formatNumber } from '../../utils/format'
import { PATENT_STATUS_LABELS, optionsFrom } from '../../utils/labels'

const EMPTY = {
  patent_number: '',
  title: '',
  abstract: '',
  assignee: '',
  inventors: [],
  filing_date: '',
  grant_date: '',
  status: 'pending',
  classification: '',
  technology_domain: '',
  citation_count: 0,
  jurisdiction: '',
  url: '',
}

function toForm(patent) {
  const form = { ...EMPTY }
  if (!patent) return form
  Object.keys(EMPTY).forEach((key) => {
    if (patent[key] !== undefined && patent[key] !== null) form[key] = patent[key]
  })
  return form
}

function toPayload(form) {
  const blank = (v) => (typeof v === 'string' ? v.trim() || null : v ?? null)
  return {
    patent_number: blank(form.patent_number),
    title: form.title.trim(),
    abstract: blank(form.abstract),
    assignee: blank(form.assignee),
    inventors: form.inventors,
    filing_date: form.filing_date || null,
    grant_date: form.grant_date || null,
    status: form.status || null,
    classification: blank(form.classification),
    technology_domain: form.technology_domain || null,
    citation_count: parseInt(form.citation_count, 10) || 0,
    jurisdiction: blank(form.jurisdiction),
    url: blank(form.url),
  }
}

function PatentForm({ initial, onSubmit, onCancel, submitting }) {
  const { domainOptions } = useTaxonomy()
  const [form, setForm] = useState(() => toForm(initial))
  const [error, setError] = useState(null)
  const set = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event?.target ? event.target.value : event }))
  const submit = (event) => {
    event.preventDefault()
    if (form.title.trim().length < 3) return setError('Title must be at least 3 characters.')
    if (form.filing_date && form.grant_date && form.grant_date < form.filing_date) return setError('Grant date cannot be before the filing date.')
    if (form.url && !/^https?:\/\//i.test(form.url.trim())) return setError('URL must start with http:// or https://')
    setError(null)
    onSubmit(toPayload(form))
  }
  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {error && <Alert variant="error">{error}</Alert>}
      <Field label="Title" required>{(id) => <Input id={id} value={form.title} onChange={set('title')} />}</Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Patent / application number">{(id) => <Input id={id} value={form.patent_number} onChange={set('patent_number')} />}</Field>
        <Field label="Status">{(id) => <Select id={id} value={form.status} onChange={set('status')} options={optionsFrom(PATENT_STATUS_LABELS)} />}</Field>
        <Field label="Jurisdiction">{(id) => <Input id={id} value={form.jurisdiction} onChange={set('jurisdiction')} placeholder="e.g. IN, US, EP" />}</Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Assignee">{(id) => <Input id={id} value={form.assignee} onChange={set('assignee')} />}</Field>
        <Field label="Inventors">{(id) => <TagInput id={id} value={form.inventors} onChange={set('inventors')} placeholder="Add inventor" />}</Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Filing date">{(id) => <Input id={id} type="date" value={form.filing_date || ''} onChange={set('filing_date')} />}</Field>
        <Field label="Grant date">{(id) => <Input id={id} type="date" value={form.grant_date || ''} onChange={set('grant_date')} />}</Field>
        <Field label="Citations">{(id) => <Input id={id} type="number" min={0} value={form.citation_count} onChange={set('citation_count')} />}</Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Classification (CPC/IPC)">{(id) => <Input id={id} value={form.classification} onChange={set('classification')} placeholder="e.g. G06N 3/08" />}</Field>
        <Field label="Technology domain">
          {(id) => <Select id={id} value={form.technology_domain || ''} onChange={set('technology_domain')} options={domainOptions} placeholder="Select a domain" />}
        </Field>
      </div>
      <Field label="URL">{(id) => <Input id={id} type="url" value={form.url} onChange={set('url')} placeholder="https://" />}</Field>
      <Field label="Abstract">{(id) => <Textarea id={id} rows={4} value={form.abstract || ''} onChange={set('abstract')} />}</Field>
      <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
        <Button variant="secondary" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" loading={submitting}>
          Save patent
        </Button>
      </div>
    </form>
  )
}

export default function PatentsTab({ onChanged }) {
  const toast = useToast()
  const { domainName } = useTaxonomy()
  const { data, error, loading, reload } = useApi(() => profileApi.listPatents(), [])
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(null)
  const items = data || []

  const save = async (payload) => {
    setSaving(true)
    try {
      if (editing?.id) await profileApi.updatePatent(editing.id, payload)
      else await profileApi.createPatent(payload)
      toast.success('Patent saved.')
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
      await profileApi.deletePatent(deleting.id)
      toast.success('Patent removed.')
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
        title="Your patents"
        subtitle="Patents you hold or have filed; used for patent strength in innovation scoring."
        icon={FileText}
        actions={
          <Button size="sm" icon={Plus} onClick={() => setEditing({})}>
            Add patent
          </Button>
        }
      />
      <div className="px-2 py-2">
        {error ? (
          <ErrorState compact message={error} onRetry={reload} />
        ) : loading && !data ? (
          <LoadingState compact />
        ) : items.length === 0 ? (
          <EmptyState compact title="No patents yet" description="Add granted patents or pending applications." />
        ) : (
          <Table
            rows={items}
            columns={[
              {
                key: 'title',
                header: 'Patent',
                className: 'min-w-[16rem]',
                render: (row) => (
                  <div>
                    <p className="font-medium text-slate-800">{row.title}</p>
                    <p className="text-xs text-slate-500">
                      {row.patent_number || 'No number'} {row.jurisdiction ? `· ${row.jurisdiction}` : ''}
                    </p>
                    {row.url && (
                      <a href={row.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:underline">
                        Source <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                ),
              },
              { key: 'status', header: 'Status', render: (row) => <PatentStatusBadge status={row.status} /> },
              { key: 'filing_date', header: 'Filed', render: (row) => formatDate(row.filing_date) },
              { key: 'technology_domain', header: 'Domain', render: (row) => (row.technology_domain ? domainName(row.technology_domain) : '—') },
              { key: 'citation_count', header: 'Citations', align: 'right', render: (row) => formatNumber(row.citation_count) },
              {
                key: 'actions',
                header: <span className="sr-only">Actions</span>,
                align: 'right',
                render: (row) => (
                  <div className="flex justify-end gap-1">
                    <Button size="icon-sm" variant="ghost" onClick={() => setEditing(row)} aria-label="Edit patent">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon-sm" variant="danger-ghost" onClick={() => setDeleting(row)} aria-label="Delete patent">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ),
              },
            ]}
          />
        )}
      </div>
      <Modal open={Boolean(editing)} onClose={() => setEditing(null)} title={editing?.id ? 'Edit patent' : 'Add patent'} size="lg">
        {editing && <PatentForm key={editing.id || 'new'} initial={editing.id ? editing : null} onSubmit={save} onCancel={() => setEditing(null)} submitting={saving} />}
      </Modal>
      <ConfirmDialog
        open={Boolean(deleting)}
        danger
        title="Remove patent?"
        message={`“${deleting?.title}” will be removed from your profile.`}
        confirmLabel="Remove"
        onConfirm={remove}
        onCancel={() => setDeleting(null)}
      />
    </Card>
  )
}
