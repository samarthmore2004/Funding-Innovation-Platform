import { useId, useMemo, useRef, useState } from 'react'
import clsx from 'clsx'
import { X } from 'lucide-react'

/**
 * Multi-value input rendered as removable chips.
 * - `suggestions`: [{value, label}] offered in a filtered dropdown.
 * - `allowCustom`: when false only suggestion values can be added (e.g. taxonomy keys).
 * - `value` is an array of raw values; labels are resolved through `suggestions`.
 */
export default function TagInput({
  value = [],
  onChange,
  suggestions = [],
  allowCustom = true,
  placeholder = 'Type and press Enter',
  max,
  id: providedId,
  disabled,
  className,
}) {
  const generated = useId()
  const id = providedId || generated
  const [text, setText] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const inputRef = useRef(null)

  const labelOf = useMemo(() => {
    const map = new Map(suggestions.map((s) => [String(s.value), s.label]))
    return (v) => map.get(String(v)) || v
  }, [suggestions])

  const selected = new Set(value.map((v) => String(v).toLowerCase()))
  const query = text.trim().toLowerCase()
  const filtered = suggestions
    .filter((s) => !selected.has(String(s.value).toLowerCase()))
    .filter((s) => !query || s.label.toLowerCase().includes(query) || String(s.value).toLowerCase().includes(query))
    .slice(0, 8)

  const atMax = max !== undefined && value.length >= max

  const add = (raw) => {
    const candidate = String(raw ?? '').trim()
    if (!candidate || atMax) return
    let toAdd = candidate
    if (!allowCustom) {
      const match = suggestions.find(
        (s) => String(s.value).toLowerCase() === candidate.toLowerCase() || s.label.toLowerCase() === candidate.toLowerCase(),
      )
      if (!match) return
      toAdd = match.value
    }
    if (selected.has(String(toAdd).toLowerCase())) {
      setText('')
      return
    }
    onChange?.([...value, toAdd])
    setText('')
    setActive(0)
  }

  const remove = (item) => onChange?.(value.filter((v) => v !== item))

  const onKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ',' || event.key === 'Tab') {
      if (event.key === 'Tab' && !text) return
      if (open && filtered[active] && (event.key !== ',' || !allowCustom)) {
        event.preventDefault()
        add(filtered[active].value)
        return
      }
      if (text.trim()) {
        event.preventDefault()
        add(text)
      }
    } else if (event.key === 'Backspace' && !text && value.length) {
      remove(value[value.length - 1])
    } else if (event.key === 'ArrowDown') {
      event.preventDefault()
      setOpen(true)
      setActive((i) => Math.min(i + 1, Math.max(filtered.length - 1, 0)))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActive((i) => Math.max(i - 1, 0))
    } else if (event.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div className={clsx('relative', className)}>
      <div
        className={clsx(
          'flex min-h-10 w-full flex-wrap items-center gap-1.5 rounded-lg bg-white px-2 py-1.5 shadow-sm ring-1 ring-inset ring-slate-300 focus-within:ring-2 focus-within:ring-indigo-500',
          disabled && 'cursor-not-allowed bg-slate-50',
        )}
        onClick={() => inputRef.current?.focus()}
      >
        {value.map((item) => (
          <span
            key={item}
            className="inline-flex items-center gap-1 rounded-md bg-indigo-50 py-0.5 pl-2 pr-1 text-xs font-medium text-indigo-700 ring-1 ring-inset ring-indigo-200"
          >
            {labelOf(item)}
            {!disabled && (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  remove(item)
                }}
                className="rounded p-0.5 text-indigo-500 hover:bg-indigo-100 hover:text-indigo-700"
                aria-label={`Remove ${labelOf(item)}`}
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </span>
        ))}
        <input
          id={id}
          ref={inputRef}
          value={text}
          disabled={disabled || atMax}
          onChange={(event) => {
            setText(event.target.value)
            setOpen(true)
            setActive(0)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={onKeyDown}
          placeholder={atMax ? `Maximum ${max} reached` : value.length ? '' : placeholder}
          className="min-w-[8rem] flex-1 border-0 bg-transparent px-1 py-0.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
          role="combobox"
          aria-expanded={open && filtered.length > 0}
          aria-autocomplete="list"
          autoComplete="off"
        />
      </div>
      {open && filtered.length > 0 && !disabled && !atMax && (
        <ul
          role="listbox"
          className="absolute z-30 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-slate-200 bg-white py-1 text-sm shadow-lg"
        >
          {filtered.map((s, index) => (
            <li
              key={s.value}
              role="option"
              aria-selected={index === active}
              onMouseDown={(event) => {
                event.preventDefault()
                add(s.value)
              }}
              onMouseEnter={() => setActive(index)}
              className={clsx('cursor-pointer px-3 py-1.5', index === active ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700')}
            >
              {s.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
