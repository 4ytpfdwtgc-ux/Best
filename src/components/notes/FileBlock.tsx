import { useEffect, useRef, useState } from 'react'
import type { Block } from '../../types'
import { formatBytes, getImage } from '../../lib/assets'
import { shareOrDownloadBlob } from '../../lib/deliver'
import { Icon } from '../ui/Icon'

/** Enough to tell a spreadsheet from a slide deck at a glance. */
function kindOf(type: string, name: string): { label: string; icon: string } {
  const ext = name.includes('.') ? name.slice(name.lastIndexOf('.') + 1).toUpperCase() : ''
  if (type === 'application/pdf') return { label: 'PDF', icon: 'note' }
  if (type.startsWith('audio/')) return { label: ext || 'Audio', icon: 'music' }
  if (type.startsWith('video/')) return { label: ext || 'Video', icon: 'image' }
  if (type.startsWith('text/')) return { label: ext || 'Text', icon: 'note' }
  if (/sheet|excel|csv/.test(type)) return { label: ext || 'Sheet', icon: 'checklist' }
  if (/zip|compressed|tar/.test(type)) return { label: ext || 'Archive', icon: 'inbox' }
  return { label: ext || 'File', icon: 'clipboard' }
}

/**
 * An attached file: what it is, how big, and the two things anyone wants to do
 * with one. A picture is shown; anything else can only be named and handed
 * back, so that is what this does.
 */
export function FileBlock({
  block,
  busy,
  error,
  onPick,
  onRetry,
}: {
  block: Block
  busy: boolean
  error?: string
  onPick: (files: File[]) => void
  onRetry: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [meta, setMeta] = useState<{ name: string; type: string; bytes: number } | null>(null)
  const [missing, setMissing] = useState(false)

  useEffect(() => {
    if (!block.assetId) return
    let live = true
    getImage(block.assetId)
      .then((stored) => {
        if (!live) return
        if (!stored) return setMissing(true)
        setMeta({ name: stored.name ?? 'Attachment', type: stored.type, bytes: stored.bytes })
      })
      .catch(() => live && setMissing(true))
    return () => void (live = false)
  }, [block.assetId])

  const choose = () => inputRef.current?.click()

  const picker = (
    <input
      ref={inputRef}
      type="file"
      multiple
      className="sr-only"
      tabIndex={-1}
      aria-hidden="true"
      onChange={(e) => {
        const files = [...(e.target.files ?? [])]
        e.target.value = ''
        if (files.length) onPick(files)
      }}
    />
  )

  if (!block.assetId || missing) {
    return (
      <div className="file" contentEditable={false}>
        {picker}
        <button
          type="button"
          className={`img__drop${error || missing ? ' is-error' : ''}`}
          disabled={busy}
          onClick={() => {
            if (error) onRetry()
            setMissing(false)
            choose()
          }}
        >
          <Icon name={error || missing ? 'warning' : 'download'} size={17} />
          {busy
            ? 'Adding…'
            : (error ?? (missing ? 'This file is no longer on this device. Choose another.' : 'Attach a file'))}
        </button>
      </div>
    )
  }

  const name = block.text || meta?.name || 'Attachment'
  const kind = kindOf(meta?.type ?? '', meta?.name ?? name)

  return (
    <div className="file" contentEditable={false}>
      {picker}
      <div className="file__card">
        <span className="file__glyph"><Icon name={kind.icon} size={16} /></span>
        <span className="file__meta">
          <span className="file__name">{name}</span>
          <span className="file__sub">
            {kind.label}
            {meta ? ` · ${formatBytes(meta.bytes)}` : ''}
          </span>
        </span>
        <button
          type="button"
          className="link__open"
          title="Save or share"
          aria-label={`Save ${name}`}
          onClick={async () => {
            if (!block.assetId) return
            const stored = await getImage(block.assetId).catch(() => undefined)
            if (!stored) return setMissing(true)
            await shareOrDownloadBlob(stored.name ?? name, stored.blob)
          }}
        >
          <Icon name="download" size={14} />
        </button>
      </div>
    </div>
  )
}
