import { useCallback, useEffect, useMemo, useState } from 'react'
import { profileApi } from '../api/profile'
import { humanize } from './format'
import {
  APPLICANT_TYPE_LABELS,
  CAREER_STAGE_LABELS,
  ORG_TYPE_LABELS,
  normalizeOptions,
} from './labels'

/*
 * The research-domain / technology-area taxonomy comes from GET /api/profile/options.
 * It is identical for every user, so it is fetched once and cached for the session.
 */
let cache = null
let inflight = null

export function loadTaxonomy() {
  if (cache) return Promise.resolve(cache)
  if (!inflight) {
    inflight = profileApi
      .options()
      .then((options) => {
        cache = options || {}
        return cache
      })
      .catch((error) => {
        inflight = null
        throw error
      })
  }
  return inflight
}

export function useTaxonomy() {
  const [options, setOptions] = useState(cache)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (cache) return
    let active = true
    loadTaxonomy()
      .then((result) => active && setOptions(result))
      .catch(() => active && setError('Could not load taxonomy options'))
    return () => {
      active = false
    }
  }, [])

  const domainOptions = useMemo(() => normalizeOptions(options?.domains), [options])
  const techOptions = useMemo(() => {
    const list = normalizeOptions(options?.technology_areas)
    return list.length ? list : domainOptions
  }, [options, domainOptions])

  const nameMap = useMemo(() => {
    const map = {}
    ;[...domainOptions, ...techOptions].forEach((option) => {
      if (!map[option.value]) map[option.value] = option.label
    })
    return map
  }, [domainOptions, techOptions])

  const domainName = useCallback((key) => (key ? nameMap[key] || humanize(key) : '—'), [nameMap])

  return {
    options,
    error,
    loading: !options && !error,
    domainOptions,
    techOptions,
    domainName,
    orgTypeOptions: normalizeOptions(options?.organization_types, ORG_TYPE_LABELS),
    careerStageOptions: normalizeOptions(options?.career_stages, CAREER_STAGE_LABELS),
    countryOptions: normalizeOptions(options?.countries),
    applicantTypeOptions: normalizeOptions(options?.applicant_types, APPLICANT_TYPE_LABELS),
  }
}
