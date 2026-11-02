import { useState } from 'react'
import { Field, Input, Select, Textarea, Toggle } from '../ui/Input'
import TagInput from '../ui/TagInput'
import Button from '../ui/Button'
import { useTaxonomy } from '../../utils/taxonomy'
import { MARKET_SIZE_LABELS, STAGE_LABELS, STAGES, optionsFrom } from '../../utils/labels'

export const TRL_DESCRIPTIONS = {
  1: 'Basic principles observed',
  2: 'Technology concept formulated',
  3: 'Experimental proof of concept',
  4: 'Technology validated in the lab',
  5: 'Technology validated in a relevant environment',
  6: 'Technology demonstrated in a relevant environment',
  7: 'System prototype demonstrated in an operational environment',
  8: 'System complete and qualified',
  9: 'Actual system proven in an operational environment',
}

export const EMPTY_PROJECT = {
  title: '',
  description: '',
  domain: '',
  keywords: [],
  stage: 'research',
  trl: 3,
  market_size: 'medium',
  target_market: '',
  patents_filed: 0,
  patents_granted: 0,
  team_size: '',
  has_industry_partner: false,
}

export function projectToForm(project) {
  if (!project) return { ...EMPTY_PROJECT }
  return {
    title: project.title || '',
    description: project.description || '',
    domain: project.domain || '',
    keywords: project.keywords || [],
    stage: project.stage || 'research',
    trl: project.trl ?? 3,
    market_size: project.market_size || 'medium',
    target_market: project.target_market || '',
    patents_filed: project.patents_filed ?? 0,
    patents_granted: project.patents_granted ?? 0,
    team_size: project.team_size ?? '',
    has_industry_partner: Boolean(project.has_industry_partner),
  }
}

/** Converts form state to the API payload (numbers coerced, empty optionals dropped to null). */
export function formToPayload(form) {
  const toInt = (value, fallback = 0) => {
    const num = parseInt(value, 10)
    return Number.isNaN(num) ? fallback : num
  }
  return {
    title: form.title.trim(),
    description: form.description.trim(),
    domain: form.domain,
    keywords: form.keywords,
    stage: form.stage,
    trl: toInt(form.trl, 1),
    market_size: form.market_size,
    target_market: form.target_market?.trim() || null,
    patents_filed: Math.max(0, toInt(form.patents_filed)),
    patents_granted: Math.max(0, toInt(form.patents_granted)),
    team_size: form.team_size === '' || form.team_size === null ? null : Math.max(1, toInt(form.team_size, 1)),
    has_industry_partner: Boolean(form.has_industry_partner),
  }
}

function validate(form) {
  const errors = {}
  if (!form.title.trim() || form.title.trim().length < 3) errors.title = 'Enter a title of at least 3 characters.'
  if (!form.description.trim() || form.description.trim().length < 20)
    errors.description = 'Describe the innovation in at least 20 characters — the text drives novelty and funding matching.'
  if (!form.domain) errors.domain = 'Choose the primary technology domain.'
  const filed = parseInt(form.patents_filed, 10) || 0
  const granted = parseInt(form.patents_granted, 10) || 0
  if (granted > filed) errors.patents_granted = 'Granted patents cannot exceed patents filed.'
  return errors
}

/**
 * Innovation project form shared by "create", "edit" and the what-if preview.
 * `secondaryAction` renders an extra button (e.g. "Preview score") that receives the payload.
 */
export default function ProjectForm({ initial, onSubmit, submitLabel = 'Save project', submitting = false, secondaryAction, onCancel }) {
  const { domainOptions } = useTaxonomy()
  const [form, setForm] = useState(() => projectToForm(initial))
  const [errors, setErrors] = useState({})
  const set = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event?.target ? event.target.value : event }))

  const handle = (callback) => (event) => {
    event?.preventDefault?.()
    const found = validate(form)
    setErrors(found)
    if (Object.keys(found).length) return
    callback(formToPayload(form))
  }

  return (
    <form onSubmit={handle(onSubmit)} className="space-y-4" noValidate>
      <Field label="Project title" required error={errors.title}>
        {(id) => <Input id={id} value={form.title} onChange={set('title')} maxLength={200} placeholder="e.g. Federated learning for rural diagnostics" />}
      </Field>
      <Field
        label="Description"
        required
        error={errors.description}
        hint="Problem, approach and what is new. Used for novelty analysis against publications and for funding matching."
      >
        {(id) => <Textarea id={id} rows={4} value={form.description} onChange={set('description')} maxLength={5000} />}
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Primary technology domain" required error={errors.domain}>
          {(id) => <Select id={id} value={form.domain} onChange={set('domain')} options={domainOptions} placeholder="Select a domain" />}
        </Field>
        <Field label="Development stage">
          {(id) => <Select id={id} value={form.stage} onChange={set('stage')} options={STAGES.map((s) => ({ value: s, label: STAGE_LABELS[s] }))} />}
        </Field>
      </div>
      <Field label="Keywords" hint="Press Enter after each keyword.">
        {(id) => <TagInput id={id} value={form.keywords} onChange={set('keywords')} max={15} placeholder="e.g. edge AI, diagnostics" />}
      </Field>
      <Field label={`Technology readiness level (TRL ${form.trl})`} hint={TRL_DESCRIPTIONS[form.trl]}>
        {(id) => (
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500">1</span>
            <input
              id={id}
              type="range"
              min={1}
              max={9}
              step={1}
              value={form.trl}
              onChange={(event) => setForm((prev) => ({ ...prev, trl: Number(event.target.value) }))}
              className="w-full"
            />
            <span className="text-xs text-slate-500">9</span>
          </div>
        )}
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Addressable market size">
          {(id) => <Select id={id} value={form.market_size} onChange={set('market_size')} options={optionsFrom(MARKET_SIZE_LABELS)} />}
        </Field>
        <Field label="Target market" hint="Optional, e.g. hospitals in tier-2 cities">
          {(id) => <Input id={id} value={form.target_market} onChange={set('target_market')} maxLength={200} />}
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Patents filed">
          {(id) => <Input id={id} type="number" min={0} value={form.patents_filed} onChange={set('patents_filed')} />}
        </Field>
        <Field label="Patents granted" error={errors.patents_granted}>
          {(id) => <Input id={id} type="number" min={0} value={form.patents_granted} onChange={set('patents_granted')} />}
        </Field>
        <Field label="Team size">
          {(id) => <Input id={id} type="number" min={1} value={form.team_size} onChange={set('team_size')} placeholder="Optional" />}
        </Field>
      </div>
      <Toggle
        checked={form.has_industry_partner}
        onChange={(value) => setForm((prev) => ({ ...prev, has_industry_partner: value }))}
        label="Industry partner involved"
        description="An existing industry collaborator or pilot customer."
      />
      <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
        {onCancel && (
          <Button variant="secondary" onClick={onCancel} disabled={submitting}>
            Cancel
          </Button>
        )}
        {secondaryAction && (
          <Button
            variant="secondary"
            icon={secondaryAction.icon}
            loading={secondaryAction.loading}
            onClick={handle(secondaryAction.onClick)}
          >
            {secondaryAction.label}
          </Button>
        )}
        <Button type="submit" loading={submitting}>
          {submitLabel}
        </Button>
      </div>
    </form>
  )
}
