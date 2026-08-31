import type { ReactNode } from 'react'

/**
 * A deliberately small markup dialect — enough for the things Apple Notes
 * gives you buttons for: titles, headings, checklists, bullets, numbers,
 * quotes, bold, italic and code.
 */

const INLINE = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g

function inline(text: string, keyPrefix: string): ReactNode[] {
  return text.split(INLINE).filter(Boolean).map((part, i) => {
    const key = `${keyPrefix}-${i}`
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={key}>{part.slice(2, -2)}</strong>
    if (part.startsWith('`') && part.endsWith('`')) return <code key={key}>{part.slice(1, -1)}</code>
    if (part.startsWith('*') && part.endsWith('*')) return <em key={key}>{part.slice(1, -1)}</em>
    return <span key={key}>{part}</span>
  })
}

export function RenderedNote({
  body,
  onToggleCheck,
}: {
  body: string
  onToggleCheck: (lineIndex: number) => void
}) {
  const lines = body.split('\n')
  const out: ReactNode[] = []
  let listBuffer: ReactNode[] = []
  let listKind: 'ul' | 'ol' | null = null

  const flush = () => {
    if (!listBuffer.length) return
    out.push(
      listKind === 'ol'
        ? <ol key={`l${out.length}`} className="note-render__ol">{listBuffer}</ol>
        : <ul key={`l${out.length}`} className="note-render__ul">{listBuffer}</ul>,
    )
    listBuffer = []
    listKind = null
  }

  lines.forEach((line, i) => {
    const checkbox = line.match(/^\s*[-*]\s+\[([ xX])\]\s?(.*)$/)
    if (checkbox) {
      if (listKind !== 'ul') flush()
      listKind = 'ul'
      const done = checkbox[1].toLowerCase() === 'x'
      listBuffer.push(
        <li key={i} className="note-render__check">
          <button
            type="button"
            className={`rem__check rem__check--sm${done ? ' is-on' : ''}`}
            onClick={() => onToggleCheck(i)}
            aria-pressed={done}
            aria-label={checkbox[2] || 'Item'}
          >
            {done ? <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12.5l5 5L20 6.5" /></svg> : null}
          </button>
          <span className={done ? 'is-struck' : ''}>{inline(checkbox[2], `c${i}`)}</span>
        </li>,
      )
      return
    }

    const bullet = line.match(/^\s*[-*]\s+(.*)$/)
    if (bullet) {
      if (listKind !== 'ul') flush()
      listKind = 'ul'
      listBuffer.push(<li key={i}>{inline(bullet[1], `b${i}`)}</li>)
      return
    }

    const numbered = line.match(/^\s*\d+[.)]\s+(.*)$/)
    if (numbered) {
      if (listKind !== 'ol') flush()
      listKind = 'ol'
      listBuffer.push(<li key={i}>{inline(numbered[1], `n${i}`)}</li>)
      return
    }

    flush()

    const heading = line.match(/^(#{1,3})\s+(.*)$/)
    if (heading) {
      const level = heading[1].length
      const content = inline(heading[2], `h${i}`)
      out.push(
        level === 1 ? <h1 key={i} className="note-render__h1">{content}</h1>
        : level === 2 ? <h2 key={i} className="note-render__h2">{content}</h2>
        : <h3 key={i} className="note-render__h3">{content}</h3>,
      )
      return
    }

    const quote = line.match(/^>\s?(.*)$/)
    if (quote) {
      out.push(<blockquote key={i} className="note-render__quote">{inline(quote[1], `q${i}`)}</blockquote>)
      return
    }

    if (!line.trim()) {
      out.push(<div key={i} className="note-render__space" />)
      return
    }

    out.push(<p key={i} className="note-render__p">{inline(line, `p${i}`)}</p>)
  })

  flush()
  return <div className="note-render">{out}</div>
}

/** Flip the `[ ]` / `[x]` marker on a single line of the note body. */
export function toggleCheckLine(body: string, lineIndex: number): string {
  const lines = body.split('\n')
  const line = lines[lineIndex]
  if (line === undefined) return body
  lines[lineIndex] = /\[ \]/.test(line)
    ? line.replace('[ ]', '[x]')
    : line.replace(/\[[xX]\]/, '[ ]')
  return lines.join('\n')
}
