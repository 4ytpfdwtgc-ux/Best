import { useEffect, useRef, useState } from 'react'
import type { Block } from '../../types'
import { useAssetURL } from '../../lib/useAssetURL'
import { Icon } from '../ui/Icon'

/**
 * The picture in an image block, or the button that puts one there.
 *
 * The caption is the block's own editable text, rendered by BlockRow beneath
 * this, so a picture keeps every keyboard behaviour an ordinary block has.
 */
export function ImageBlock({
  block,
  busy,
  error,
  onPick,
  onRetry,
}: {
  block: Block
  /** A picture is being read and shrunk for this block. */
  busy: boolean
  error?: string
  onPick: (files: File[]) => void
  /** Clear the failure so the block can be tried again. */
  onRetry: () => void
}) {
  const url = useAssetURL(block.assetId)
  const inputRef = useRef<HTMLInputElement>(null)
  const [zoomed, setZoomed] = useState(false)

  const choose = () => inputRef.current?.click()

  const picker = (
    <input
      ref={inputRef}
      type="file"
      accept="image/*"
      multiple
      className="sr-only"
      tabIndex={-1}
      aria-hidden="true"
      onChange={(e) => {
        const files = [...(e.target.files ?? [])]
        // Clear it, or picking the same photo twice in a row fires nothing.
        e.target.value = ''
        if (files.length) onPick(files)
      }}
    />
  )

  if (!block.assetId) {
    return (
      <div className="img" contentEditable={false}>
        {picker}
        <button
          type="button"
          className={`img__drop${error ? ' is-error' : ''}`}
          onClick={() => {
            if (error) onRetry()
            choose()
          }}
          disabled={busy}
        >
          <Icon name={error ? 'warning' : 'image'} size={17} />
          {busy ? 'Adding…' : (error ?? 'Add a picture')}
        </button>
      </div>
    )
  }

  return (
    <div className="img" contentEditable={false}>
      {picker}
      <div
        className="img__frame"
        // Hold the picture's shape before it loads so the page does not jump.
        style={
          block.imageWidth && block.imageHeight
            ? { aspectRatio: `${block.imageWidth} / ${block.imageHeight}` }
            : undefined
        }
      >
        {url === null ? (
          <button type="button" className="img__drop is-error" onClick={choose}>
            <Icon name="warning" size={17} />
            This picture is no longer on this device. Choose another.
          </button>
        ) : url ? (
          <img
            className="img__pic"
            src={url}
            alt={block.text || 'Picture'}
            onClick={() => setZoomed(true)}
            draggable={false}
          />
        ) : (
          <div className="img__pending" aria-label="Loading picture" />
        )}
        {busy && <div className="img__pending img__pending--over" aria-label="Replacing picture" />}
      </div>

      {zoomed && url && <Lightbox src={url} alt={block.text} onClose={() => setZoomed(false)} />}
    </div>
  )
}

/** Full-bleed view of one picture. */
function Lightbox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="lightbox" role="dialog" aria-modal="true" aria-label={alt || 'Picture'} onClick={onClose}>
      <button type="button" className="lightbox__close" onClick={onClose} aria-label="Close">
        <Icon name="close" size={19} />
      </button>
      <img className="lightbox__pic" src={src} alt={alt || 'Picture'} onClick={(e) => e.stopPropagation()} />
    </div>
  )
}
