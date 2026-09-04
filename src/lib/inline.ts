/**
 * Inline marks for block text.
 *
 * The markers stay in the text and are rendered dimmed beside the styled run,
 * so the element's textContent always equals the stored string. That keeps
 * caret offsets meaningful and avoids a parallel rich-text model.
 */

import { normalizeURL } from './links.ts'

/*
 * Wiki links are matched before ordinary ones, or `[[Page]]` would be read as
 * a link labelled `[Page`.
 */
const PATTERN =
  /(\[\[[^\]\n]+\]\]|\[[^\]\n]*\]\([^)\s\n]+\)|\*\*[^*\n]+\*\*|\*[^*\n]+\*|`[^`\n]+`|~~[^~\n]+~~)/g

const WIKI = /^\[\[([^\]\n]+)\]\]$/
const LINK = /^\[([^\]\n]*)\]\(([^)\s\n]+)\)$/

function escapeAttr(text: string): string {
  return escapeHtml(text).replace(/"/g, '&quot;')
}

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

      const wiki = part.match(WIKI)
      if (wiki) {
        // Resolved against page titles when clicked, not here: a page can be
        // renamed, and a link written before its page exists still points at it.
        return (
          `<span class="mk">[[</span>` +
          `<a class="ln ln--wiki" data-wiki="${escapeAttr(wiki[1])}">${escapeHtml(wiki[1])}</a>` +
          `<span class="mk">]]</span>`
        )
      }

      const link = part.match(LINK)
      if (link) {
        // Only http and https ever reach an href; anything else stays as text,
        // so `[click](javascript:...)` is inert rather than armed.
        const href = normalizeURL(link[2])
        if (!href) return escapeHtml(part)
        return (
          `<span class="mk">[</span>` +
          `<a class="ln" data-href="${escapeAttr(href)}">${escapeHtml(link[1] || href)}</a>` +
          `<span class="mk">](${escapeHtml(link[2])})</span>`
        )
      }

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
