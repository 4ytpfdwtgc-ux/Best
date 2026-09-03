import { uid } from './id.ts'

/**
 * Picture storage.
 *
 * Everything else in the app persists as one JSON blob in localStorage, which
 * caps out around 5MB — less than a single photo off an iPhone, before base64
 * inflates it by a third. Pictures therefore live in IndexedDB as binary and a
 * block holds only the key, so no picture ever reaches the state JSON.
 */

const DB_NAME = 'cadence.assets'
const DB_VERSION = 1
const STORE = 'images'

/** Long edge a stored picture is reduced to. A phone photo is ~4000px. */
export const MAX_EDGE = 1600
/** Below this a picture is kept exactly as it came in, rather than re-encoded. */
const KEEP_ORIGINAL_BYTES = 600 * 1024
const JPEG_QUALITY = 0.82

/** Re-encoding these would lose something: animation, or resolution-independence. */
const NEVER_REENCODE = ['image/gif', 'image/svg+xml']

export interface StoredImage {
  id: string
  blob: Blob
  type: string
  bytes: number
  /** 0 when the browser could not decode the picture to measure it. */
  width: number
  height: number
  createdAt: string
}

export class AssetError extends Error {}

let dbPromise: Promise<IDBDatabase> | undefined

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new AssetError('This browser has no storage for pictures.'))
      return
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) {
        request.result.createObjectStore(STORE, { keyPath: 'id' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new AssetError('Could not open picture storage.'))
    // Private mode and a blocked upgrade both hang rather than fail; do not wait forever.
    request.onblocked = () => reject(new AssetError('Picture storage is busy in another tab.'))
  })
  // A failed open must not be cached, or every later attempt inherits it.
  dbPromise.catch(() => void (dbPromise = undefined))
  return dbPromise
}

function run<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDB().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode)
        const request = work(tx.objectStore(STORE))
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error ?? new AssetError('Picture storage failed.'))
        tx.onabort = () => reject(tx.error ?? new AssetError('Picture storage is full.'))
      }),
  )
}

/* ------------------------------------------------------------------ */
/* Reading and writing                                                 */
/* ------------------------------------------------------------------ */

/** Shrink a picture if it is worth shrinking, then store it. */
export async function putImage(file: Blob): Promise<StoredImage> {
  if (!file.type.startsWith('image/')) {
    throw new AssetError('That file is not a picture.')
  }

  const prepared = await prepare(file)
  const stored: StoredImage = {
    id: uid('img'),
    blob: prepared.blob,
    type: prepared.blob.type || file.type,
    bytes: prepared.blob.size,
    width: prepared.width,
    height: prepared.height,
    createdAt: new Date().toISOString(),
  }

  try {
    await run('readwrite', (store) => store.add(stored))
  } catch (error) {
    // A quota failure is the likely one, and it needs to say so plainly.
    throw new AssetError(
      error instanceof Error && /quota|full/i.test(error.message)
        ? 'There is no room left on this device for another picture.'
        : 'That picture could not be saved.',
    )
  }
  return stored
}

export function getImage(id: string): Promise<StoredImage | undefined> {
  return run<StoredImage | undefined>('readonly', (store) => store.get(id))
}

export async function deleteImage(id: string): Promise<void> {
  revokeURL(id)
  await run('readwrite', (store) => store.delete(id))
}

export function allImageIds(): Promise<string[]> {
  return run<IDBValidKey[]>('readonly', (store) => store.getAllKeys()).then((keys) => keys.map(String))
}

/**
 * Drop pictures no page refers to any more. Deleting a block or a page leaves
 * its bytes behind, and only the note list knows what is still in use.
 */
export async function sweepOrphans(keep: ReadonlySet<string>): Promise<number> {
  let dropped = 0
  try {
    for (const id of await allImageIds()) {
      if (keep.has(id)) continue
      await deleteImage(id)
      dropped++
    }
  } catch {
    // Reclaiming space is housekeeping; never let it break the app.
  }
  return dropped
}

export async function usage(): Promise<{ count: number; bytes: number }> {
  try {
    const all = await run<StoredImage[]>('readonly', (store) => store.getAll())
    return { count: all.length, bytes: all.reduce((sum, a) => sum + a.bytes, 0) }
  } catch {
    return { count: 0, bytes: 0 }
  }
}

/* ------------------------------------------------------------------ */
/* Object URLs                                                         */
/* ------------------------------------------------------------------ */

const urls = new Map<string, string>()
const pending = new Map<string, Promise<string | undefined>>()

/** A displayable URL for a stored picture, made once and reused. */
export function imageURL(id: string): Promise<string | undefined> {
  const ready = urls.get(id)
  if (ready) return Promise.resolve(ready)

  const inflight = pending.get(id)
  if (inflight) return inflight

  const load = getImage(id)
    .then((asset) => {
      if (!asset) return undefined
      // Another caller may have won the race while this one was reading.
      const won = urls.get(id)
      if (won) return won
      const url = URL.createObjectURL(asset.blob)
      urls.set(id, url)
      return url
    })
    .catch(() => undefined)
    .finally(() => void pending.delete(id))

  pending.set(id, load)
  return load
}

function revokeURL(id: string) {
  const url = urls.get(id)
  if (!url) return
  URL.revokeObjectURL(url)
  urls.delete(id)
}

/* ------------------------------------------------------------------ */
/* Decoding and downscaling                                            */
/* ------------------------------------------------------------------ */

interface Prepared {
  blob: Blob
  width: number
  height: number
}

async function prepare(file: Blob): Promise<Prepared> {
  if (NEVER_REENCODE.includes(file.type)) {
    const size = await measure(file).catch(() => null)
    return { blob: file, width: size?.width ?? 0, height: size?.height ?? 0 }
  }

  let image: HTMLImageElement
  try {
    image = await decode(file)
  } catch {
    // Something the browser cannot render — keep the bytes rather than lose them.
    return { blob: file, width: 0, height: 0 }
  }

  const { naturalWidth: w, naturalHeight: h } = image
  const scale = Math.min(1, MAX_EDGE / Math.max(w, h))

  // Already small enough, and small enough on disk: re-encoding would only lose.
  if (scale === 1 && file.size <= KEEP_ORIGINAL_BYTES) {
    return { blob: file, width: w, height: h }
  }

  const width = Math.max(1, Math.round(w * scale))
  const height = Math.max(1, Math.round(h * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return { blob: file, width: w, height: h }

  // PNG keeps its transparency; anything else is a photo and goes to JPEG.
  const keepAlpha = file.type === 'image/png'
  if (!keepAlpha) {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, width, height)
  }
  ctx.drawImage(image, 0, 0, width, height)

  const encoded = await toBlob(canvas, keepAlpha ? 'image/png' : 'image/jpeg', JPEG_QUALITY)
  // Re-encoding a small graphic can make it bigger; keep whichever is smaller.
  if (!encoded || (scale === 1 && encoded.size >= file.size)) {
    return { blob: file, width: w, height: h }
  }
  return { blob: encoded, width, height }
}

function decode(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    // Browsers apply EXIF orientation by default, so a phone photo lands upright.
    image.onload = () => {
      URL.revokeObjectURL(url)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new AssetError('That picture could not be read.'))
    }
    image.src = url
  })
}

function measure(file: Blob): Promise<{ width: number; height: number }> {
  return decode(file).then((image) => ({ width: image.naturalWidth, height: image.naturalHeight }))
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality))
}

/** Human-readable size, for the Settings readout. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
