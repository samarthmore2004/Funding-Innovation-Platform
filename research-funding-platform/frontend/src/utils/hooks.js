import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getErrorMessage } from '../api/client'
import { SERIES_COLORS } from '../components/charts/palette'

/**
 * Runs an async loader and tracks `{data, error, loading}`. Previous data is kept while
 * reloading (so charts can dim instead of flashing), and stale responses are ignored.
 */
export function useApi(loader, deps = [], { immediate = true, initialData = null } = {}) {
  const [state, setState] = useState({ data: initialData, error: null, loading: immediate })
  const loaderRef = useRef(loader)
  loaderRef.current = loader
  const callId = useRef(0)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const run = useCallback(async (...args) => {
    const id = ++callId.current
    setState((prev) => ({ ...prev, loading: true, error: null }))
    try {
      const result = await loaderRef.current(...args)
      if (mounted.current && id === callId.current) setState({ data: result, error: null, loading: false })
      return result
    } catch (error) {
      if (mounted.current && id === callId.current) {
        setState((prev) => ({ ...prev, error: getErrorMessage(error), loading: false }))
      }
      return undefined
    }
  }, [])

  useEffect(() => {
    if (immediate) run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  const setData = useCallback(
    (updater) => setState((prev) => ({ ...prev, data: typeof updater === 'function' ? updater(prev.data) : updater })),
    [],
  )

  return { ...state, reload: run, setData }
}

export function useDebounce(value, delay = 350) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}

/**
 * Color follows the entity, never its rank: each key keeps its palette slot for as long as
 * it stays on screen, and newly added keys take the lowest free slot.
 */
export function useStableColors(keys) {
  const slotsRef = useRef({})
  const signature = keys.join('\u0001')
  return useMemo(() => {
    const previous = slotsRef.current
    const next = {}
    const used = new Set()
    keys.forEach((key) => {
      const slot = previous[key]
      if (slot !== undefined && !used.has(slot)) {
        next[key] = slot
        used.add(slot)
      }
    })
    keys.forEach((key) => {
      if (next[key] !== undefined) return
      let slot = 0
      while (used.has(slot)) slot += 1
      next[key] = slot
      used.add(slot)
    })
    slotsRef.current = next
    return Object.fromEntries(keys.map((key) => [key, SERIES_COLORS[next[key] % SERIES_COLORS.length]]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature])
}

export function useDocumentTitle(title) {
  useEffect(() => {
    const base = 'Research Funding & Innovation Intelligence'
    document.title = title ? `${title} · ${base}` : base
  }, [title])
}

/** Small helper for "busy" flags around async actions. */
export function useAsyncAction() {
  const [pending, setPending] = useState(null)
  const run = useCallback(async (key, fn) => {
    setPending(key)
    try {
      return await fn()
    } finally {
      setPending(null)
    }
  }, [])
  return [pending, run]
}
