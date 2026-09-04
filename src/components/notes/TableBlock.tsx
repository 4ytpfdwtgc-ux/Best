import { useEffect, useRef } from 'react'
import type { Block } from '../../types'
import { Icon } from '../ui/Icon'

/** Every row is padded to this many columns, so the grid is never ragged. */
function normalise(rows: string[][]): string[][] {
  if (!rows.length) return [['', '']]
  const width = Math.max(1, ...rows.map((r) => r.length))
  return rows.map((row) => Array.from({ length: width }, (_, i) => row[i] ?? ''))
}

/**
 * Rows and columns of plain text.
 *
 * Cells are contentEditable rather than inputs so a long one wraps instead of
 * scrolling sideways, and React writes into one only when its text has
 * actually diverged — the same rule the rest of the editor follows, and the
 * only way a caret survives typing.
 */
export function TableBlock({
  block,
  onChange,
}: {
  block: Block
  onChange: (rows: string[][]) => void
}) {
  const rows = normalise(block.rows ?? [])
  const width = rows[0].length
  const gridRef = useRef<HTMLDivElement>(null)

  function setCell(r: number, c: number, value: string) {
    onChange(rows.map((row, i) => (i === r ? row.map((cell, j) => (j === c ? value : cell)) : row)))
  }

  const addRow = (at = rows.length) =>
    onChange([...rows.slice(0, at), Array(width).fill(''), ...rows.slice(at)])
  const addColumn = () => onChange(rows.map((row) => [...row, '']))
  const removeRow = (at: number) => rows.length > 1 && onChange(rows.filter((_, i) => i !== at))
  const removeColumn = (at: number) =>
    width > 1 && onChange(rows.map((row) => row.filter((_, i) => i !== at)))

  /** Move the caret to another cell, adding a row if it runs off the end. */
  function move(r: number, c: number, delta: number) {
    const flat = r * width + c + delta
    if (flat < 0) return
    if (flat >= rows.length * width) {
      addRow()
      // The new row is not in the DOM yet; focus it once React has drawn it.
      requestAnimationFrame(() => focusCell(gridRef.current, rows.length, 0))
      return
    }
    focusCell(gridRef.current, Math.floor(flat / width), flat % width)
  }

  return (
    <div className="tbl" contentEditable={false}>
      <div className="tbl__scroll">
        <div
          ref={gridRef}
          className="tbl__grid"
          role="table"
          style={{ gridTemplateColumns: `repeat(${width}, minmax(120px, 1fr))` }}
        >
          {rows.map((row, r) =>
            row.map((cell, c) => (
              <Cell
                key={`${r}-${c}`}
                value={cell}
                header={r === 0}
                row={r}
                column={c}
                onInput={(value) => setCell(r, c, value)}
                onMove={(delta) => move(r, c, delta)}
              />
            )),
          )}
        </div>

        {/* Column controls sit above their column, row controls beside their row. */}
        <div className="tbl__cols" style={{ gridTemplateColumns: `repeat(${width}, minmax(120px, 1fr))` }}>
          {rows[0].map((_, c) => (
            <button
              key={c}
              type="button"
              className="tbl__drop"
              onClick={() => removeColumn(c)}
              disabled={width <= 1}
              title="Remove this column"
              aria-label={`Remove column ${c + 1}`}
            >
              <Icon name="minus" size={12} strokeWidth={2.2} />
            </button>
          ))}
        </div>

        <div className="tbl__rows">
          {rows.map((_, r) => (
            <button
              key={r}
              type="button"
              className="tbl__drop"
              onClick={() => removeRow(r)}
              disabled={rows.length <= 1}
              title="Remove this row"
              aria-label={`Remove row ${r + 1}`}
            >
              <Icon name="minus" size={12} strokeWidth={2.2} />
            </button>
          ))}
        </div>
      </div>

      <div className="tbl__add">
        <button type="button" className="btn btn--plain" onClick={() => addRow()}>
          <Icon name="plus" size={12} strokeWidth={2.2} /> Row
        </button>
        <button type="button" className="btn btn--plain" onClick={addColumn}>
          <Icon name="plus" size={12} strokeWidth={2.2} /> Column
        </button>
      </div>
    </div>
  )
}

function Cell({
  value,
  header,
  row,
  column,
  onInput,
  onMove,
}: {
  value: string
  header: boolean
  row: number
  column: number
  onInput: (value: string) => void
  onMove: (delta: number) => void
}) {
  const ref = useRef<HTMLDivElement>(null)

  // Write into the cell only when it has genuinely diverged, or every
  // keystroke would reset the caret to the start.
  useEffect(() => {
    const el = ref.current
    if (el && el.textContent !== value) el.textContent = value
  }, [value])

  return (
    <div
      ref={ref}
      className={`tbl__cell${header ? ' tbl__cell--head' : ''}`}
      contentEditable
      suppressContentEditableWarning
      role={header ? 'columnheader' : 'cell'}
      data-row={row}
      data-col={column}
      onInput={(e) => onInput(e.currentTarget.textContent ?? '')}
      onKeyDown={(e) => {
        if (e.key === 'Tab') {
          e.preventDefault()
          onMove(e.shiftKey ? -1 : 1)
          return
        }
        // Enter would otherwise put a line break inside the cell.
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault()
          onMove(1)
        }
      }}
      // Keep pasted markup out of the cell.
      onPaste={(e) => {
        e.preventDefault()
        document.execCommand('insertText', false, e.clipboardData.getData('text/plain').replace(/\s+/g, ' '))
      }}
    />
  )
}

function focusCell(grid: HTMLElement | null, row: number, column: number) {
  const cell = grid?.querySelector<HTMLElement>(`[data-row="${row}"][data-col="${column}"]`)
  if (!cell) return
  cell.focus()
  const range = document.createRange()
  range.selectNodeContents(cell)
  range.collapse(false)
  const selection = window.getSelection()
  selection?.removeAllRanges()
  selection?.addRange(range)
}
