import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { AppState, DatabaseView, FieldRef, FilterOp } from '../../types'
import { BUILTIN_FIELDS, fieldName } from '../../state/selectors'
import { addFilter, removeFilter, updateFilter, updateView } from '../../state/actions'
import { Icon } from '../ui/Icon'

const OPS: { value: FilterOp; label: string }[] = [
  { value: 'is', label: 'is' },
  { value: 'isNot', label: 'is not' },
  { value: 'contains', label: 'contains' },
  { value: 'isEmpty', label: 'is empty' },
  { value: 'isNotEmpty', label: 'is not empty' },
  { value: 'before', label: 'is before' },
  { value: 'after', label: 'is after' },
]

/** Notion's Filter / Sort / Group controls for the active view. */
export function ViewControls({ state, view }: { state: AppState; view: DatabaseView }) {
  const fields: FieldRef[] = [
    ...BUILTIN_FIELDS.map((f) => f.id),
    ...state.properties.map((p) => p.id),
  ]

  return (
    <div className="viewbar">
      <Popover
        label="Filter"
        icon="list"
        badge={view.filters.length || undefined}
        active={view.filters.length > 0}
      >
        {(close) => (
          <>
            {view.filters.length === 0 && <div className="menu__label">No filters yet</div>}
            {view.filters.map((filter) => (
              <div key={filter.id} className="filter-row">
                <select
                  className="select input--sm"
                  value={filter.field}
                  onChange={(e) => updateFilter(view.id, filter.id, { field: e.target.value })}
                  aria-label="Filter field"
                >
                  {fields.map((f) => (
                    <option key={f} value={f}>{fieldName(state, f)}</option>
                  ))}
                </select>
                <select
                  className="select input--sm"
                  value={filter.op}
                  onChange={(e) => updateFilter(view.id, filter.id, { op: e.target.value as FilterOp })}
                  aria-label="Filter condition"
                >
                  {OPS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                {filter.op !== 'isEmpty' && filter.op !== 'isNotEmpty' && (
                  <input
                    className="input input--sm"
                    value={filter.value ?? ''}
                    placeholder="Value"
                    onChange={(e) => updateFilter(view.id, filter.id, { value: e.target.value })}
                    aria-label="Filter value"
                  />
                )}
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => removeFilter(view.id, filter.id)}
                  aria-label="Remove filter"
                >
                  <Icon name="close" size={12} />
                </button>
              </div>
            ))}
            <button
              type="button"
              className="menu__item"
              onClick={() => addFilter(view.id, { field: 'title', op: 'contains', value: '' })}
            >
              <Icon name="plus" size={13} strokeWidth={2.2} /> Add a filter
            </button>
            <div className="menu__sep" />
            <button
              type="button"
              className="menu__item"
              onClick={() => {
                updateView(view.id, { hideCompleted: !view.hideCompleted })
                close()
              }}
            >
              <span className="menu__text">Hide completed</span>
              {view.hideCompleted && <Icon name="check" size={14} strokeWidth={2.4} />}
            </button>
          </>
        )}
      </Popover>

      <Popover label="Sort" icon="arrowRight" active={view.sortBy !== 'due' || view.sortDir !== 'asc'}>
        {(close) => (
          <>
            <div className="menu__label">Sort by</div>
            {fields.map((f) => (
              <button
                key={f}
                type="button"
                className="menu__item"
                onClick={() => {
                  updateView(view.id, { sortBy: f })
                  close()
                }}
              >
                <span className="menu__text">{fieldName(state, f)}</span>
                {view.sortBy === f && <Icon name="check" size={14} strokeWidth={2.4} />}
              </button>
            ))}
            <div className="menu__sep" />
            <button
              type="button"
              className="menu__item"
              onClick={() => updateView(view.id, { sortDir: view.sortDir === 'asc' ? 'desc' : 'asc' })}
            >
              <span className="menu__text">{view.sortDir === 'asc' ? 'Ascending' : 'Descending'}</span>
              <Icon name="repeat" size={13} />
            </button>
          </>
        )}
      </Popover>

      <Popover label="Group" icon="grid" active={!!view.groupBy}>
        {(close) => (
          <>
            <div className="menu__label">Group by</div>
            <button
              type="button"
              className="menu__item"
              onClick={() => {
                updateView(view.id, { groupBy: null })
                close()
              }}
            >
              <span className="menu__text">None</span>
              {!view.groupBy && <Icon name="check" size={14} strokeWidth={2.4} />}
            </button>
            {fields.map((f) => (
              <button
                key={f}
                type="button"
                className="menu__item"
                onClick={() => {
                  updateView(view.id, { groupBy: f })
                  close()
                }}
              >
                <span className="menu__text">{fieldName(state, f)}</span>
                {view.groupBy === f && <Icon name="check" size={14} strokeWidth={2.4} />}
              </button>
            ))}
          </>
        )}
      </Popover>
    </div>
  )
}

/** A toolbar button that opens a menu anchored beneath it. */
function Popover({
  label,
  icon,
  active,
  badge,
  children,
}: {
  label: string
  icon: string
  active?: boolean
  badge?: number
  children: (close: () => void) => ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [anchor, setAnchor] = useState<DOMRect | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node) && !buttonRef.current?.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={`tool-btn${active ? ' is-active' : ''}`}
        onClick={() => {
          setAnchor(buttonRef.current?.getBoundingClientRect() ?? null)
          setOpen((v) => !v)
        }}
        aria-expanded={open}
      >
        <Icon name={icon} size={14} />
        {label}
        {badge ? <span className="viewbar__badge">{badge}</span> : null}
      </button>
      {open && anchor && (
        <div
          ref={menuRef}
          className="menu viewbar__menu"
          style={{ top: anchor.bottom + 4, left: Math.min(anchor.left, window.innerWidth - 320) }}
          role="dialog"
          aria-label={label}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </>
  )
}
