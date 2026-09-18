import { useEffect, useRef, useState } from 'react'

interface Props {
  value: string
  onCommit: (value: string) => void
  disabled?: boolean
  placeholder?: string
  bold?: boolean
  ariaLabel: string
  /** Commit sooner or later after typing stops. */
  delayMs?: number
}

/**
 * A sheet cell that autosaves. Typing is debounced; blurring or pressing Enter
 * flushes immediately. While the cell has focus it ignores incoming values so
 * a background refetch can't yank text out from under the person typing.
 */
export function EditableCell({
  value,
  onCommit,
  disabled = false,
  placeholder,
  bold = false,
  ariaLabel,
  delayMs = 600,
}: Props) {
  const [local, setLocal] = useState(value)
  const timer = useRef<number | undefined>(undefined)
  const focused = useRef(false)
  const committed = useRef(value)

  useEffect(() => {
    if (!focused.current) {
      setLocal(value)
      committed.current = value
    }
  }, [value])

  useEffect(() => () => window.clearTimeout(timer.current), [])

  const flush = (next: string) => {
    window.clearTimeout(timer.current)
    if (next === committed.current) return
    committed.current = next
    onCommit(next)
  }

  if (disabled) {
    return (
      <span className={`block truncate ${bold ? 'font-semibold' : ''}`}>
        {value || <span className="text-neutral-300">—</span>}
      </span>
    )
  }

  return (
    <input
      className={`sheet-input ${bold ? 'font-semibold' : ''}`}
      value={local}
      aria-label={ariaLabel}
      placeholder={placeholder}
      onFocus={() => {
        focused.current = true
      }}
      onChange={(e) => {
        const next = e.target.value
        setLocal(next)
        window.clearTimeout(timer.current)
        timer.current = window.setTimeout(() => flush(next), delayMs)
      }}
      onBlur={() => {
        focused.current = false
        flush(local)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.currentTarget.blur()
        }
        if (e.key === 'Escape') {
          setLocal(committed.current)
          window.clearTimeout(timer.current)
          e.currentTarget.blur()
        }
      }}
    />
  )
}
