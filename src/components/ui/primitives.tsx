import { useEffect, useRef, type ReactNode } from 'react'
import { Icon } from './Icon'
import { TINTS, type TintName } from '../../types'

/* ---------------------------------------------------------------- */
/* Toolbar button                                                    */
/* ---------------------------------------------------------------- */

export function ToolButton({
  icon,
  label,
  onClick,
  active,
  disabled,
  children,
}: {
  icon?: string
  label: string
  onClick?: () => void
  active?: boolean
  disabled?: boolean
  children?: ReactNode
}) {
  return (
    <button
      type="button"
      className={`tool-btn${active ? ' is-active' : ''}`}
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
    >
      {icon ? <Icon name={icon} size={17} /> : null}
      {children}
    </button>
  )
}

/* ---------------------------------------------------------------- */
/* Segmented control                                                 */
/* ---------------------------------------------------------------- */

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
  ariaLabel?: string
}) {
  return (
    <div className="segmented" role="tablist" aria-label={ariaLabel}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={value === o.value}
          className={`segmented__item${value === o.value ? ' is-on' : ''}`}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/* ---------------------------------------------------------------- */
/* Sheet / modal                                                     */
/* ---------------------------------------------------------------- */

export function Sheet({
  title,
  onClose,
  children,
  footer,
  width = 420,
}: {
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  width?: number
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    document.addEventListener('keydown', onKey, true)
    ref.current?.querySelector<HTMLElement>('input, textarea, button')?.focus()
    return () => document.removeEventListener('keydown', onKey, true)
  }, [onClose])

  return (
    <div className="scrim" onMouseDown={onClose} role="presentation">
      <div
        ref={ref}
        className="sheet"
        style={{ width }}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="sheet__head">
          <h2>{title}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="close" size={15} />
          </button>
        </header>
        <div className="sheet__body scroll">{children}</div>
        {footer ? <footer className="sheet__foot">{footer}</footer> : null}
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------- */
/* Form rows                                                         */
/* ---------------------------------------------------------------- */

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="field">
      <span className="field__label">{label}</span>
      <span className="field__control">{children}</span>
      {hint ? <span className="field__hint">{hint}</span> : null}
    </label>
  )
}

export function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="row">
      <span className="row__label">{label}</span>
      <div className="row__control">{children}</div>
    </div>
  )
}

export function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={`switch${checked ? ' is-on' : ''}`}
      onClick={() => onChange(!checked)}
    >
      <span className="switch__knob" />
    </button>
  )
}

/* ---------------------------------------------------------------- */
/* Tint picker                                                       */
/* ---------------------------------------------------------------- */

export function TintPicker({
  value,
  onChange,
}: {
  value: TintName
  onChange: (t: TintName) => void
}) {
  return (
    <div className="tint-picker" role="radiogroup" aria-label="Color">
      {TINTS.map((t) => (
        <button
          key={t}
          type="button"
          role="radio"
          aria-checked={value === t}
          aria-label={t}
          title={t}
          className={`tint-picker__dot tint-${t}${value === t ? ' is-on' : ''}`}
          onClick={() => onChange(t)}
        />
      ))}
    </div>
  )
}

/* ---------------------------------------------------------------- */
/* Empty state                                                       */
/* ---------------------------------------------------------------- */

export function EmptyState({
  icon,
  title,
  hint,
  action,
}: {
  icon: string
  title: string
  hint?: string
  action?: ReactNode
}) {
  return (
    <div className="empty">
      <Icon name={icon} size={44} strokeWidth={1.1} />
      <p className="empty__title">{title}</p>
      {hint ? <p className="empty__hint">{hint}</p> : null}
      {action}
    </div>
  )
}
