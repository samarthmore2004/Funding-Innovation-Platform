import { useEffect, useState } from 'react'
import { Save } from 'lucide-react'
import { Button, Card, CardHeader, Field, Input, Select, TagInput, Textarea, useToast } from '../../components/ui'
import { profileApi } from '../../api/profile'
import { getErrorMessage } from '../../api/client'
import { useTaxonomy } from '../../utils/taxonomy'

const FIELDS = [
  'headline',
  'bio',
  'department',
  'organization_name',
  'organization_type',
  'country',
  'career_stage',
  'research_domains',
  'keywords',
  'technology_areas',
  'orcid',
  'website',
  'google_scholar_url',
]
const LIST_FIELDS = ['research_domains', 'keywords', 'technology_areas']

function toForm(profile) {
  const form = {}
  FIELDS.forEach((key) => {
    const value = profile?.[key]
    form[key] = LIST_FIELDS.includes(key) ? value || [] : value ?? ''
  })
  return form
}

function toPayload(form) {
  const payload = {}
  FIELDS.forEach((key) => {
    const value = form[key]
    payload[key] = LIST_FIELDS.includes(key) ? value : typeof value === 'string' ? value.trim() || null : value
  })
  return payload
}

export default function ProfileForm({ profile, onSaved }) {
  const toast = useToast()
  const { domainOptions, techOptions, orgTypeOptions, careerStageOptions, countryOptions } = useTaxonomy()
  const [form, setForm] = useState(() => toForm(profile))
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState({})

  useEffect(() => {
    setForm(toForm(profile))
  }, [profile])

  const set = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event?.target ? event.target.value : event }))

  const submit = async (event) => {
    event.preventDefault()
    const found = {}
    ;['website', 'google_scholar_url'].forEach((key) => {
      if (form[key] && !/^https?:\/\//i.test(form[key].trim())) found[key] = 'Must start with http:// or https://'
    })
    if (form.orcid && !/^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/i.test(form.orcid.trim())) found.orcid = 'Format: 0000-0000-0000-0000'
    setErrors(found)
    if (Object.keys(found).length) return
    setSaving(true)
    try {
      const saved = await profileApi.update(toPayload(form))
      toast.success('Research profile saved.')
      onSaved?.(saved)
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6" noValidate>
      <Card>
        <CardHeader title="Research interests" subtitle="These drive funding recommendations, alerts and trend views." />
        <div className="grid gap-5 px-5 py-5">
          <Field label="Research domains" hint="Pick from the platform taxonomy.">
            {(id) => (
              <TagInput
                id={id}
                value={form.research_domains}
                onChange={set('research_domains')}
                suggestions={domainOptions}
                allowCustom={false}
                placeholder="e.g. Artificial Intelligence"
                max={8}
              />
            )}
          </Field>
          <Field label="Technology areas">
            {(id) => (
              <TagInput
                id={id}
                value={form.technology_areas}
                onChange={set('technology_areas')}
                suggestions={techOptions}
                allowCustom={false}
                placeholder="e.g. Digital Health"
                max={8}
              />
            )}
          </Field>
          <Field label="Keywords" hint="Specific methods, problems and applications. Press Enter after each keyword.">
            {(id) => (
              <TagInput id={id} value={form.keywords} onChange={set('keywords')} placeholder="e.g. federated learning" max={30} />
            )}
          </Field>
        </div>
      </Card>

      <Card>
        <CardHeader title="Profile information" />
        <div className="grid gap-5 px-5 py-5 md:grid-cols-2">
          <Field label="Headline" className="md:col-span-2">
            {(id) => (
              <Input id={id} value={form.headline} onChange={set('headline')} maxLength={200} placeholder="e.g. Associate Professor, Machine Learning for Health" />
            )}
          </Field>
          <Field label="Bio" className="md:col-span-2">
            {(id) => <Textarea id={id} rows={4} value={form.bio} onChange={set('bio')} maxLength={4000} />}
          </Field>
          <Field label="Career stage">
            {(id) => <Select id={id} value={form.career_stage} onChange={set('career_stage')} options={careerStageOptions} placeholder="Select…" />}
          </Field>
          <Field label="Country" hint="Used for eligibility matching.">
            {(id) => (
              <>
                <Input id={id} list="country-options" value={form.country} onChange={set('country')} placeholder="e.g. India" />
                <datalist id="country-options">
                  {countryOptions.map((option) => (
                    <option key={option.value} value={option.value} />
                  ))}
                </datalist>
              </>
            )}
          </Field>
          <Field label="ORCID iD" error={errors.orcid}>
            {(id) => <Input id={id} value={form.orcid} onChange={set('orcid')} placeholder="0000-0000-0000-0000" />}
          </Field>
          <Field label="Website" error={errors.website}>
            {(id) => <Input id={id} type="url" value={form.website} onChange={set('website')} placeholder="https://" />}
          </Field>
          <Field label="Google Scholar profile" className="md:col-span-2" error={errors.google_scholar_url}>
            {(id) => <Input id={id} type="url" value={form.google_scholar_url} onChange={set('google_scholar_url')} placeholder="https://scholar.google.com/…" />}
          </Field>
        </div>
      </Card>

      <Card>
        <CardHeader title="Organization information" subtitle="Applicant type and organization drive eligibility checks." />
        <div className="grid gap-5 px-5 py-5 md:grid-cols-3">
          <Field label="Organization">
            {(id) => <Input id={id} value={form.organization_name} onChange={set('organization_name')} maxLength={200} />}
          </Field>
          <Field label="Organization type">
            {(id) => (
              <Select id={id} value={form.organization_type} onChange={set('organization_type')} options={orgTypeOptions} placeholder="Select…" />
            )}
          </Field>
          <Field label="Department / unit">
            {(id) => <Input id={id} value={form.department} onChange={set('department')} maxLength={200} />}
          </Field>
        </div>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" icon={Save} loading={saving} size="lg">
          Save profile
        </Button>
      </div>
    </form>
  )
}
