/**
 * Inline marks for block text.
 *
 * The markers stay in the text and are rendered dimmed beside the styled run,
 * so the element's textContent always equals the stored string. That keeps
 * caret offsets meaningful and avoids a parallel rich-text model.
 */

const PATTERN = /(\*\*[^*\n]+\*\*|\*[^*\n]+\*|`[^`\n]+`|~~[^~\n]+~~)/g

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/** Decorated HTML for a run of block text. */
export function decorateInline(text: string): string {
  if (!text) return ''
  return text
    .split(PATTERN)
    .filter((part) => part !== undefined && part !== '')
    .map((part) => {
      const mark = (n: number, tag: string) =>
        `<span class="mk">${escapeHtml(part.slice(0, n))}</span>` +
        `<${tag}>${escapeHtml(part.slice(n, -n))}</${tag}>` +
        `<span class="mk">${escapeHtml(part.slice(-n))}</span>`

      if (/^\*\*[^*\n]+\*\*$/.test(part)) return mark(2, 'strong')
      if (/^~~[^~\n]+~~$/.test(part)) return mark(2, 's')
      if (/^\*[^*\n]+\*$/.test(part)) return mark(1, 'em')
      if (/^`[^`\n]+`$/.test(part)) return mark(1, 'code')
      return escapeHtml(part)
    })
    .join('')
}

/** Wrap the given range of `text` in a marker, or unwrap it if already marked. */
export function toggleMark(text: string, start: number, end: number, marker: string): {
  text: string
  start: number
  end: number
} {
  if (start === end) return { text, start, end }
  const selected = text.slice(start, end)
  const len = marker.length

  if (selected.startsWith(marker) && selected.endsWith(marker) && selected.length > len * 2) {
    const inner = selected.slice(len, -len)
    return { text: text.slice(0, start) + inner + text.slice(end), start, end: start + inner.length }
  }

  const before = text.slice(Math.max(0, start - len), start)
  const after = text.slice(end, end + len)
  if (before === marker && after === marker) {
    return {
      text: text.slice(0, start - len) + selected + text.slice(end + len),
      start: start - len,
      end: end - len,
    }
  }

  const wrapped = marker + selected + marker
  return { text: text.slice(0, start) + wrapped + text.slice(end), start: start + len, end: end + len }
}
