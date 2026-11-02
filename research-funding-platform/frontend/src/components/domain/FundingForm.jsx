import { useState } from 'react'
import { Field, Input, Select, Textarea } from '../ui/Input'
import TagInput from '../ui/TagInput'
import Button from '../ui/Button'
import Alert from '../ui/Alert'
import { useTaxonomy } from '../../utils/taxonomy'
import {
  APPLICANT_TYPE_LABELS,
  CAREER_STAGE_LABELS,
  FUNDER_TYPE_LABELS,
  FUNDING_STATUS_LABELS,
  optionsFrom,
} from '../../utils/labels'

const EMPTY = {
  title: '',
  organization: '',
  funder_type: 'innovation_fund',
  description: '',
  domains: [],
  keywords: [],
  eligibility_text: '',
  applicant_types: [],
  eligible_countries: [],
  career_stages: [],
  min_amount: '',
  max_amount: '',
  currency: 'USD',
  open_date: '',
  deadline: '',
  status: 'open',
  source_name: '',
  source_url: '',
}

function toForm(funding) {
  if (!funding) return { ...EMPTY }
  const out = { ...EMPTY }
  Object.keys(EMPTY).forEach((key) => {
    const value = funding[key]
    out[key] = value === null || value === undefined ? EMPTY[key] : value
  })
  return out
}

function toPayload(form) {
  const num = (value) => (value === '' || value === null ? null : Number(value))
  return {
    ...form,
    title: form.title.trim(),
    organization: form.organization.trim(),
    description: form.description.trim(),
    eligibility_text: form.eligibility_text.trim() || null,
    min_amount: num(form.min_amount),
    max_amount: num(form.max_amount),
    currency: (form.currency || 'USD').toUpperCase().slice(0, 3),
    open_date: form.open_date || null,
    deadline: form.deadline || null,
    source_name: form.source_name.trim() || null,
    source_url: form.source_url.trim() || null,
  }
}

/** Create/edit form for internal funding programs (innovation managers and admins). */
export default function FundingForm({ initial, onSubmit, onCancel, submitting }) {
  const { domainOptions, countryOptions } = useTaxonomy()
  const [form, setForm] = useState(() => toForm(initial))
  const [error, setError] = useState(null)
  const set = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event?.target ? event.target.value : event }))

  const submit = (event) => {
    event.preventDefault()
    if (form.title.trim().length < 3) return setError('Title must be at least 3 characters.')
    if (!form.organization.trim()) return setError('Organization is required.')
    if (form.description.trim().length < 10) return setError('Description must be at least 10 characters.')
    if (form.min_amount !== '' && form.max_amount !== '' && Number(form.min_amount) > Number(form.max_amount)) {
      return setError('Minimum amount cannot exceed maximum amount.')
    }
    if (form.source_url && !/^https?:\/\//i.test(form.source_url.trim())) return setError('Source URL must start with http:// or https://')
    setError(null)
    onSubmit(toPayload(form))
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {!initial && (
        <Alert variant="info">
          Programs created here are saved as <strong>internal</strong> records (for example an institutional seed fund). Do not
          enter external grants unless you have verified them at the official source.
        </Alert>
      )}
      {error && <Alert variant="error">{error}</Alert>}
      <Field label="Title" required>
        {(id) => <Input id={id} value={form.title} onChange={set('title')} maxLength={300} />}
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Organization" required>
          {(id) => <Input id={id} value={form.organization} onChange={set('organization')} maxLength={200} />}
        </Field>
        <Field label="Funder type">
          {(id) => <Select id={id} value={form.funder_type} onChange={set('funder_type')} options={optionsFrom(FUNDER_TYPE_LABELS)} />}
        </Field>
      </div>
      <Field label="Description" required>
        {(id) => <Textarea id={id} rows={4} value={form.description} onChange={set('description')} />}
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Research domains">
          {(id) => <TagInput id={id} value={form.domains} onChange={set('domains')} suggestions={domainOptions} allowCustom={false} placeholder="Add domains" />}
        </Field>
        <Field label="Keywords">
          {(id) => <TagInput id={id} value={form.keywords} onChange={set('keywords')} placeholder="Add keywords" />}
        </Field>
      </div>
      <Field label="Eligibility description">
        {(id) => <Textarea id={id} rows={2} value={form.eligibility_text} onChange={set('eligibility_text')} />}
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Applicant types">
          {(id) => (
            <TagInput id={id} value={form.applicant_types} onChange={set('applicant_types')} suggestions={optionsFrom(APPLICANT_TYPE_LABELS)} allowCustom={false} placeholder="Any" />
          )}
        </Field>
        <Field label="Eligible countries" hint="Leave empty or add “Global” for no restriction.">
          {(id) => <TagInput id={id} value={form.eligible_countries} onChange={set('eligible_countries')} suggestions={countryOptions} placeholder="Any" />}
        </Field>
        <Field label="Career stages">
          {(id) => (
            <TagInput id={id} value={form.career_stages} onChange={set('career_stages')} suggestions={optionsFrom(CAREER_STAGE_LABELS)} allowCustom={false} placeholder="Any" />
          )}
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Minimum amount">
          {(id) => <Input id={id} type="number" min={0} value={form.min_amount} onChange={set('min_amount')} />}
        </Field>
        <Field label="Maximum amount">
          {(id) => <Input id={id} type="number" min={0} value={form.max_amount} onChange={set('max_amount')} />}
        </Field>
        <Field label="Currency">
          {(id) => <Input id={id} value={form.currency} onChange={set('currency')} maxLength={3} />}
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Opens">
          {(id) => <Input id={id} type="date" value={form.open_date || ''} onChange={set('open_date')} />}
        </Field>
        <Field label="Deadline">
          {(id) => <Input id={id} type="date" value={form.deadline || ''} onChange={set('deadline')} />}
        </Field>
        <Field label="Status">
          {(id) => <Select id={id} value={form.status} onChange={set('status')} options={optionsFrom(FUNDING_STATUS_LABELS)} />}
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Source name">
          {(id) => <Input id={id} value={form.source_name} onChange={set('source_name')} placeholder="e.g. University Innovation Office" />}
        </Field>
        <Field label="Source URL">
          {(id) => <Input id={id} type="url" value={form.source_url} onChange={set('source_url')} placeholder="https://" />}
        </Field>
      </div>
      <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
        <Button variant="secondary" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" loading={submitting}>
          {initial ? 'Save changes' : 'Create program'}
        </Button>
      </div>
    </form>
  )
}
