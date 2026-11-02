import { useState } from 'react'
import { BookOpen, Download, ExternalLink, Pencil, Plus, Search, Trash2 } from 'lucide-react'
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
import { profileApi } from '../../api/profile'
import { getErrorMessage } from '../../api/client'
import { useApi } from '../../utils/hooks'
import { useTaxonomy } from '../../utils/taxonomy'
import { formatNumber, humanize } from '../../utils/format'

const PUB_TYPES = ['journal-article', 'proceedings-article', 'preprint', 'book-chapter', 'book', 'dataset', 'other'].map((v) => ({
  value: v,
  label: humanize(v),
}))

const EMPTY = {
  title: '',
  abstract: '',
  authors: [],
  venue: '',
  year: '',
  publication_date: '',
  doi: '',
  url: '',
  citation_count: 0,
  domain: '',
  keywords: [],
  pub_type: 'journal-article',
}

function toForm(pub) {
  const form = { ...EMPTY }
  if (!pub) return form
  Object.keys(EMPTY).forEach((key) => {
    if (pub[key] !== undefined && pub[key] !== null) form[key] = pub[key]
  })
  return form
}

function toPayload(form) {
  const int = (v) => (v === '' || v === null || v === undefined ? null : parseInt(v, 10))
  return {
    title: form.title.trim(),
    abstract: form.abstract?.trim() || null,
    authors: form.authors,
    venue: form.venue?.trim() || null,
    year: int(form.year),
    publication_date: form.publication_date || null,
    doi: form.doi?.trim() || null,
    url: form.url?.trim() || null,
    citation_count: int(form.citation_count) ?? 0,
    domain: form.domain || null,
    keywords: form.keywords,
    pub_type: form.pub_type || null,
  }
}

function PublicationForm({ initial, note, onSubmit, onCancel, submitting }) {
  const { domainOptions } = useTaxonomy()
  const [form, setForm] = useState(() => toForm(initial))
  const [error, setError] = useState(null)
  const set = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event?.target ? event.target.value : event }))
  const submit = (event) => {
    event.preventDefault()
    if (form.title.trim().length < 3) return setError('Title must be at least 3 characters.')
    const year = parseInt(form.year, 10)
    if (form.year !== '' && (Number.isNaN(year) || year < 1900 || year > new Date().getFullYear() + 1)) return setError('Enter a valid year.')
    setError(null)
    onSubmit(toPayload(form))
  }
  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {note && <Alert variant="success">{note}</Alert>}
      {error && <Alert variant="error">{error}</Alert>}
      <Field label="Title" required>
        {(id) => <Input id={id} value={form.title} onChange={set('title')} />}
      </Field>
      <Field label="Authors" hint="Press Enter after each author.">
        {(id) => <TagInput id={id} value={form.authors} onChange={set('authors')} placeholder="Add author" />}
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Venue">{(id) => <Input id={id} value={form.venue} onChange={set('venue')} placeholder="Journal or conference" />}</Field>
        <Field label="Type">{(id) => <Select id={id} value={form.pub_type} onChange={set('pub_type')} options={PUB_TYPES} />}</Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Year">{(id) => <Input id={id} type="number" value={form.year} onChange={set('year')} />}</Field>
        <Field label="Publication date">{(id) => <Input id={id} type="date" value={form.publication_date || ''} onChange={set('publication_date')} />}</Field>
        <Field label="Citations">{(id) => <Input id={id} type="number" min={0} value={form.citation_count} onChange={set('citation_count')} />}</Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="DOI">{(id) => <Input id={id} value={form.doi} onChange={set('doi')} placeholder="10.xxxx/xxxxx" />}</Field>
        <Field label="URL">{(id) => <Input id={id} type="url" value={form.url} onChange={set('url')} placeholder="https://" />}</Field>
      </div>
      <Field label="Domain">
        {(id) => <Select id={id} value={form.domain || ''} onChange={set('domain')} options={domainOptions} placeholder="Select a domain" />}
      </Field>
      <Field label="Keywords">{(id) => <TagInput id={id} value={form.keywords} onChange={set('keywords')} />}</Field>
      <Field label="Abstract">{(id) => <Textarea id={id} rows={4} value={form.abstract || ''} onChange={set('abstract')} />}</Field>
      <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
        <Button variant="secondary" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" loading={submitting}>
          Save publication
        </Button>
      </div>
    </form>
  )
}

export default function PublicationsTab({ onChanged }) {
  const toast = useToast()
  const { domainName } = useTaxonomy()
  const { data, error, loading, reload } = useApi(() => profileApi.listPublications(), [])
  const [editing, setEditing] = useState(null) // { initial, note } | null
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(null)
  const [doi, setDoi] = useState('')
  const [lookup, setLookup] = useState({ loading: false, error: null })

  const items = data || []

  const save = async (payload) => {
    setSaving(true)
    try {
      if (editing?.initial?.id) await profileApi.updatePublication(editing.initial.id, payload)
      else await profileApi.createPublication(payload)
      toast.success('Publication saved.')
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
      await profileApi.deletePublication(deleting.id)
      toast.success('Publication deleted.')
      setDeleting(null)
      reload()
      onChanged?.()
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  const runLookup = async (event) => {
    event.preventDefault()
    const value = doi.trim().replace(/^https?:\/\/(dx\.)?doi\.org\//i, '')
    if (!/^10\.\d{4,9}\/\S+$/.test(value)) {
      setLookup({ loading: false, error: 'Enter a DOI such as 10.1038/s41586-020-2649-2.' })
      return
    }
    setLookup({ loading: true, error: null })
    try {
      const result = await profileApi.lookupDoi(value)
      if (result?.found && result.publication) {
        setEditing({ initial: { ...result.publication, doi: result.publication.doi || value }, note: `Metadata retrieved from ${humanize(result.source || 'external source')}. Review and save.` })
        setDoi('')
        setLookup({ loading: false, error: null })
      } else {
        setLookup({ loading: false, error: 'No record was found for this DOI.' })
      }
    } catch (err) {
      const status = err?.response?.status
      const message =
        status === 404
          ? 'No record was found for this DOI in Crossref or OpenAlex.'
          : status === 503
            ? `${getErrorMessage(err)} You can still add the publication manually.`
            : getErrorMessage(err)
      setLookup({ loading: false, error: message, doi: value, manual: status === 503 })
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Import a publication by DOI" subtitle="Looks up Crossref (and OpenAlex as fallback) and pre-fills the form." icon={Download} />
        <form onSubmit={runLookup} className="flex flex-col gap-3 px-5 py-4 sm:flex-row">
          <Input icon={Search} value={doi} onChange={(event) => setDoi(event.target.value)} placeholder="10.xxxx/xxxxx or https://doi.org/…" className="flex-1" aria-label="DOI" />
          <Button type="submit" loading={lookup.loading} variant="secondary">
            Look up DOI
          </Button>
        </form>
        {lookup.error && (
          <div className="px-5 pb-4">
            <Alert
              variant="warning"
              action={
                lookup.manual ? (
                  <Button size="xs" variant="secondary" onClick={() => setEditing({ initial: { doi: lookup.doi } })}>
                    Add manually
                  </Button>
                ) : null
              }
            >
              {lookup.error}
            </Alert>
          </div>
        )}
      </Card>

      <Card>
        <CardHeader
          title="Your publications"
          subtitle={`${formatNumber(items.length)} publication${items.length === 1 ? '' : 's'}`}
          icon={BookOpen}
          actions={
            <Button size="sm" icon={Plus} onClick={() => setEditing({ initial: null })}>
              Add publication
            </Button>
          }
        />
        <div className="px-2 py-2">
          {error ? (
            <ErrorState compact message={error} onRetry={reload} />
          ) : loading && !data ? (
            <LoadingState compact />
          ) : items.length === 0 ? (
            <EmptyState compact title="No publications yet" description="Add publications manually or import them by DOI." />
          ) : (
            <Table
              rows={items}
              columns={[
                {
                  key: 'title',
                  header: 'Title',
                  className: 'min-w-[16rem]',
                  render: (row) => (
                    <div>
                      <p className="font-medium text-slate-800">{row.title}</p>
                      <p className="text-xs text-slate-500">{(row.authors || []).slice(0, 4).join(', ')}{(row.authors || []).length > 4 ? ' et al.' : ''}</p>
                      {row.doi && (
                        <a href={row.url || `https://doi.org/${row.doi}`} target="_blank" rel="noreferrer" className="mt-0.5 inline-flex items-center gap-1 text-xs text-indigo-600 hover:underline">
                          {row.doi} <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  ),
                },
                { key: 'venue', header: 'Venue', render: (row) => row.venue || '—' },
                { key: 'year', header: 'Year', align: 'right' },
                { key: 'citation_count', header: 'Citations', align: 'right', render: (row) => formatNumber(row.citation_count) },
                { key: 'domain', header: 'Domain', render: (row) => (row.domain ? domainName(row.domain) : '—') },
                {
                  key: 'actions',
                  header: <span className="sr-only">Actions</span>,
                  align: 'right',
                  render: (row) => (
                    <div className="flex justify-end gap-1">
                      <Button size="icon-sm" variant="ghost" onClick={() => setEditing({ initial: row })} aria-label="Edit publication">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon-sm" variant="danger-ghost" onClick={() => setDeleting(row)} aria-label="Delete publication">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ),
                },
              ]}
            />
          )}
        </div>
      </Card>

      <Modal open={Boolean(editing)} onClose={() => setEditing(null)} title={editing?.initial?.id ? 'Edit publication' : 'Add publication'} size="lg">
        {editing && (
          <PublicationForm
            key={editing.initial?.id || editing.initial?.doi || 'new'}
            initial={editing.initial}
            note={editing.note}
            onSubmit={save}
            onCancel={() => setEditing(null)}
            submitting={saving}
          />
        )}
      </Modal>
      <ConfirmDialog
        open={Boolean(deleting)}
        danger
        title="Delete publication?"
        message={`“${deleting?.title}” will be removed from your profile.`}
        confirmLabel="Delete"
        onConfirm={remove}
        onCancel={() => setDeleting(null)}
      />
    </div>
  )
}
