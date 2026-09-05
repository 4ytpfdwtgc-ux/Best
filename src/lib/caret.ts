/**
 * Caret helpers for the contentEditable blocks.
 *
 * Offsets are counted in characters across the element's text, so they stay
 * valid when the element is re-rendered with different inline markup as long
 * as its textContent is unchanged.
 */

export function getCaretOffset(el: HTMLElement): number {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) return 0
  const range = selection.getRangeAt(0)
  const pre = range.cloneRange()
  pre.selectNodeContents(el)
  pre.setEnd(range.endContainer, range.endOffset)
  return pre.toString().length
}

export function setCaretOffset(el: HTMLElement, offset: number): void {
  const selection = window.getSelection()
  if (!selection) return
  const range = document.createRange()
  let remaining = Math.max(0, offset)
  let placed = false

  const walk = (node: Node): boolean => {
    if (node.nodeType === Node.TEXT_NODE) {
      const len = node.textContent?.length ?? 0
      if (remaining <= len) {
        range.setStart(node, remaining)
        placed = true
        return true
      }
      remaining -= len
      return false
    }
    for (const child of Array.from(node.childNodes)) if (walk(child)) return true
    return false
  }

  walk(el)
  if (!placed) range.selectNodeContents(el)
  range.collapse(true)
  selection.removeAllRanges()
  selection.addRange(range)
}

export function isCaretAtStart(el: HTMLElement): boolean {
  return getCaretOffset(el) === 0
}

export function isCaretAtEnd(el: HTMLElement): boolean {
  return getCaretOffset(el) >= (el.textContent?.length ?? 0)
}

/**
 * Focus a block's editable element and put the caret at `offset`.
 *
 * A block created in the same tick is not in the DOM yet — React has not
 * committed the render — so this retries across a few frames rather than
 * silently doing nothing.
 */
export function focusBlock(blockId: string, offset: number | 'end' = 'end', attempt = 0): void {
  requestAnimationFrame(() => {
    // Scope to the editable text: the gutter carries contenteditable="false".
    const el = document.querySelector<HTMLElement>(`[data-block-id="${blockId}"] .blk__text`)
    if (!el) {
      if (attempt < 8) focusBlock(blockId, offset, attempt + 1)
      return
    }
    el.focus()
    setCaretOffset(el, offset === 'end' ? (el.textContent?.length ?? 0) : offset)
  })
}

/**
 * The selected range inside `el`, in character offsets.
 *
 * `getCaretOffset` answers where the caret is, which is the end of a forward
 * selection and the start of a backward one. The format bar needs both ends
 * whichever way the selection was made, so this measures them separately.
 * Returns null when the selection is somewhere else entirely.
 */
export function selectionRange(el: HTMLElement): { start: number; end: number } | null {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) return null
  const range = selection.getRangeAt(0)
  if (!el.contains(range.commonAncestorContainer)) return null

  const measure = (node: Node, offset: number) => {
    const pre = range.cloneRange()
    pre.selectNodeContents(el)
    pre.setEnd(node, offset)
    return pre.toString().length
  }
  return { start: measure(range.startContainer, range.startOffset), end: measure(range.endContainer, range.endOffset) }
}

/**
 * Focus a block and select `start`..`end` of its text.
 *
 * Formatting keeps the selection rather than collapsing it, so bold and then
 * italic apply to the same words -- which is how anyone uses a format bar.
 */
export function selectBlockRange(blockId: string, start: number, end: number, attempt = 0): void {
  requestAnimationFrame(() => {
    const el = document.querySelector<HTMLElement>(`[data-block-id="${blockId}"] .blk__text`)
    if (!el) {
      if (attempt < 8) selectBlockRange(blockId, start, end, attempt + 1)
      return
    }
    el.focus()
    setCaretOffset(el, start)
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) return
    const range = selection.getRangeAt(0)
    // Extend from the collapsed caret rather than walking the tree twice.
    const from = { node: range.startContainer, offset: range.startOffset }
    setCaretOffset(el, end)
    const to = selection.getRangeAt(0)
    const full = document.createRange()
    full.setStart(from.node, from.offset)
    full.setEnd(to.startContainer, to.startOffset)
    selection.removeAllRanges()
    selection.addRange(full)
  })
}
