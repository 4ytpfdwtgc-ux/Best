import { useState, type ReactNode } from 'react'
import type { Block } from '../../types'
import { faviconURL, linkHost, monogramTint, normalizeURL } from '../../lib/links'
import { Icon } from '../ui/Icon'

/**
 * A saved address, shown the way iOS shows one: the site's icon, the title, and
 * the site underneath.
 *
 * The title is the block's own editable text, placed inside the card rather
 * than repeated beneath it, so it can be corrected in place — a title guessed
 * from an address is only ever a starting point — while every keyboard
 * behaviour an ordinary block has still works. Tapping anywhere else on the
 * card opens the link.
 */
export function LinkBlock({
  block,
  title,
  onSetURL,
}: {
  block: Block
  /** The block's editable element, used as the card's title. */
  title: ReactNode
  onSetURL: (url: string) => void
}) {
  const [draft, setDraft] = useState('')
  const [rejected, setRejected] = useState(false)

  if (!block.url) {
    return (
      <div className="link" contentEditable={false}>
        <form
          className={`link__entry${rejected ? ' is-error' : ''}`}
          onSubmit={(e) => {
            e.preventDefault()
            const url = normalizeURL(draft)
            if (!url) return setRejected(true)
            setDraft('')
            setRejected(false)
            onSetURL(url)
          }}
        >
          <Icon name="link" size={15} />
          <input
            className="link__input"
            value={draft}
            autoFocus
            inputMode="url"
            enterKeyHint="done"
            placeholder="Paste or type a web address"
            aria-label="Web address"
            aria-invalid={rejected}
            onChange={(e) => {
              setDraft(e.target.value)
              setRejected(false)
            }}
          />
          <button type="submit" className="btn btn--plain" disabled={!draft.trim()}>
            Add
          </button>
        </form>
        {rejected && <p className="link__error">That is not a web address.</p>}
      </div>
    )
  }

  const open = () => window.open(block.url, '_blank', 'noopener,noreferrer')

  return (
    <div className="link">
      <div
        className="link__card"
        onClick={(e) => {
          // The title is for editing; the rest of the card is for opening.
          if ((e.target as HTMLElement).closest('.blk__text')) return
          open()
        }}
      >
        <span contentEditable={false}>
          <Favicon url={block.url} />
        </span>

        <span className="link__meta">
          {title}
          <span className="link__host" contentEditable={false}>{linkHost(block.url)}</span>
        </span>

        <a
          className="link__open"
          href={block.url}
          target="_blank"
          rel="noopener noreferrer"
          contentEditable={false}
          aria-label={`Open ${linkHost(block.url)}`}
          onClick={(e) => e.stopPropagation()}
        >
          <Icon name="arrowUpRight" size={14} />
        </a>
      </div>
    </div>
  )
}

/**
 * The site's icon, falling back to its initial. Plenty of sites no longer serve
 * /favicon.ico, and asking an icon service instead would tell a third party
 * every link saved here.
 */
function Favicon({ url }: { url: string }) {
  const [failed, setFailed] = useState(false)
  const src = faviconURL(url)
  const host = linkHost(url)

  if (failed || !src) {
    return (
      <span className={`link__mono tint-${monogramTint(url)}`} aria-hidden="true">
        {host.charAt(0).toUpperCase()}
      </span>
    )
  }
  return (
    <img
      className="link__favicon"
      src={src}
      alt=""
      width={20}
      height={20}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  )
}
