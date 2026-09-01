import { useEffect, useMemo, useRef, useState } from 'react'
import type { PropertyDef, PropertyValue, Reminder, TintName } from '../../types'
import { addPropertyOption, setProperty } from '../../state/actions'
import { friendlyDate } from '../../lib/date'
import { Icon } from '../ui/Icon'

const OPTION_TINTS: TintName[] = ['gray', 'brown', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'red']

/** Read-only rendering of one property value, as Notion shows it in a cell. */
export function PropertyValueView({
  property,
  value,
  placeholder = 'Empty',
}: {
  property: PropertyDef
  value: PropertyValue | undefined
  placeholder?: string
}) {
  if (property.type === 'select' || property.type === 'multiSelect') {
    const ids = Array.isArray(value) ? value : value == null || value === '' ? [] : [String(value)]
    const options = ids
      .map((id) => property.options?.find((o) => o.id === id))
      .filter((o): o is NonNullable<typeof o> => !!o)
    if (!options.length) return <span className="prop__empty">{placeholder}</span>
    return (
      <span className="prop__tags">
        {options.map((o) => (
          <span key={o.id} className={`pill tint-${o.tint}`}>{o.name}</span>
        ))}
      </span>
    )
  }

  if (value == null || value === '') return <span className="prop__empty">{placeholder}</span>

  if (property.type === 'checkbox') {
    return (
      <span className={`prop__check${value ? ' is-on' : ''}`}>
        {value ? <Icon name="check" size={11} strokeWidth={3} /> : null}
      </span>
    )
  }
  if (property.type === 'date') return <span>{friendlyDate(String(value))}</span>
  if (property.type === 'number') return <span className="prop__num">{String(value)}</span>
  if (property.type === 'url') {
    return (
      <a className="prop__url" href={String(value)} target="_blank" rel="noreferrer noopener">
        {String(value)}
      </a>
    )
  }
  return <span>{String(value)}</span>
}

/** A cell that opens an editor when clicked. */
export function PropertyCell({
  reminder,
  property,
  compact,
}: {
  reminder: Reminder
  property: PropertyDef
  compact?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [anchor, setAnchor] = useState<DOMRect | null>(null)
  const ref = useRef<HTMLButtonElement>(null)
  const value = reminder.props[property.id]

  if (property.type === 'checkbox') {
    return (
      <button
        type="button"
        className={`prop__check${value ? ' is-on' : ''}`}
        onClick={() => setProperty(reminder.id, property.id, !value)}
        aria-pressed={!!value}
        aria-label={property.name}
      >
        {value ? <Icon name="check" size={11} strokeWidth={3} /> : null}
      </button>
    )
  }

  return (
    <>
      <button
        ref={ref}
        type="button"
        className={`prop__cell${compact ? ' prop__cell--compact' : ''}`}
        onClick={() => {
          setAnchor(ref.current?.getBoundingClientRect() ?? null)
          setOpen(true)
        }}
        aria-label={`${property.name}: ${value ?? 'empty'}`}
      >
        <PropertyValueView property={property} value={value} placeholder={compact ? '' : 'Empty'} />
      </button>
      {open && anchor && (
        <PropertyEditor
          reminder={reminder}
          property={property}
          anchor={anchor}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}

/** The popover for changing one property's value. */
export function PropertyEditor({
  reminder,
  property,
  anchor,
  onClose,
}: {
  reminder: Reminder
  property: PropertyDef
  anchor: DOMRect
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [query, setQuery] = useState('')
  const value = reminder.props[property.id]

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  const selected = useMemo(
    () => (Array.isArray(value) ? value : value == null || value === '' ? [] : [String(value)]),
    [value],
  )

  const style = { top: anchor.bottom + 4, left: Math.min(anchor.left, window.innerWidth - 260) }

  if (property.type === 'select' || property.type === 'multiSelect') {
    const q = query.trim().toLowerCase()
    const options = (property.options ?? []).filter((o) => !q || o.name.toLowerCase().includes(q))
    const exact = (property.options ?? []).some((o) => o.name.toLowerCase() === q)

    const pick = (optionId: string) => {
      if (property.type === 'multiSelect') {
        const next = selected.includes(optionId)
          ? selected.filter((id) => id !== optionId)
          : [...selected, optionId]
        setProperty(reminder.id, property.id, next)
      } else {
        setProperty(reminder.id, property.id, selected.includes(optionId) ? null : optionId)
        onClose()
      }
    }

    return (
      <div ref={ref} className="menu prop__menu" style={style} role="dialog" aria-label={property.name}>
        <input
          className="prop__search"
          autoFocus
          value={query}
          placeholder="Search or create…"
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && q && !exact) {
              const option = addPropertyOption(
                property.id,
                query,
                OPTION_TINTS[(property.options?.length ?? 0) % OPTION_TINTS.length],
              )
              if (option) pick(option.id)
              setQuery('')
            }
          }}
          aria-label={`Search ${property.name}`}
        />
        <div className="menu__label">Select an option</div>
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            className="menu__item prop__option"
            onClick={() => pick(option.id)}
          >
            <span className={`pill tint-${option.tint}`}>{option.name}</span>
            {selected.includes(option.id) && <Icon name="check" size={14} strokeWidth={2.4} />}
          </button>
        ))}
        {q && !exact && (
          <button
            type="button"
            className="menu__item"
            onClick={() => {
              const option = addPropertyOption(
                property.id,
                query,
                OPTION_TINTS[(property.options?.length ?? 0) % OPTION_TINTS.length],
              )
              if (option) pick(option.id)
              setQuery('')
            }}
          >
            <Icon name="plus" size={13} strokeWidth={2.2} />
            <span className="menu__text">Create “{query}”</span>
          </button>
        )}
      </div>
    )
  }

  return (
    <div ref={ref} className="menu prop__menu" style={style} role="dialog" aria-label={property.name}>
      <input
        className="prop__search"
        autoFocus
        type={property.type === 'number' ? 'number' : property.type === 'date' ? 'date' : 'text'}
        defaultValue={value == null ? '' : String(value)}
        placeholder={property.name}
        onKeyDown={(e) => {
          if (e.key !== 'Enter') return
          const raw = (e.target as HTMLInputElement).value
          setProperty(
            reminder.id,
            property.id,
            raw === '' ? null : property.type === 'number' ? Number(raw) : raw,
          )
          onClose()
        }}
        onBlur={(e) => {
          const raw = e.target.value
          setProperty(
            reminder.id,
            property.id,
            raw === '' ? null : property.type === 'number' ? Number(raw) : raw,
          )
        }}
        aria-label={property.name}
      />
    </div>
  )
}
