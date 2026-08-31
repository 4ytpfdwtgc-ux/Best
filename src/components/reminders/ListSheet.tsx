import { useState } from 'react'
import type { ReminderList, TintName } from '../../types'
import { addList, updateList } from '../../state/actions'
import { Field, Sheet, TintPicker } from '../ui/primitives'

const SYMBOLS = ['📋', '💼', '🏡', '🛒', '🎯', '✈️', '📚', '💡', '🏋️', '🎁', '🐾', '🎵']

export function ListSheet({ list, onClose }: { list?: ReminderList; onClose: () => void }) {
  const [name, setName] = useState(list?.name ?? '')
  const [tint, setTint] = useState<TintName>(list?.tint ?? 'blue')
  const [symbol, setSymbol] = useState(list?.symbol ?? '📋')

  function save() {
    if (list) updateList(list.id, { name: name.trim() || list.name, tint, symbol })
    else addList(name, tint, symbol)
    onClose()
  }

  return (
    <Sheet
      title={list ? 'List Info' : 'New List'}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn--primary" onClick={save}>{list ? 'Save' : 'Create'}</button>
        </>
      }
    >
      <div className={`list-preview tint-${tint}`}>
        <span className="list-preview__glyph">{symbol}</span>
        <span className="list-preview__name">{name.trim() || 'List Name'}</span>
      </div>

      <Field label="Name">
        <input
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && save()}
          placeholder="List Name"
          aria-label="List name"
        />
      </Field>

      <Field label="Color">
        <TintPicker value={tint} onChange={setTint} />
      </Field>

      <Field label="Symbol">
        <div className="symbol-picker" role="radiogroup" aria-label="Symbol">
          {SYMBOLS.map((s) => (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={symbol === s}
              className={`symbol-picker__item${symbol === s ? ' is-on' : ''}`}
              onClick={() => setSymbol(s)}
            >
              {s}
            </button>
          ))}
        </div>
      </Field>
    </Sheet>
  )
}
