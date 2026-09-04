import type { AppState } from '../types.ts'
import { allImageIds, getImage, putStored, type StoredImage } from './assets.ts'

/**
 * A whole-library backup.
 *
 * Everything here lives in one browser: state in localStorage, pictures and
 * files in IndexedDB. Clearing website data, changing phone, or letting Safari
 * evict the storage takes all of it with no recovery. A backup is the only
 * answer a static app can give, so it has to be complete — state and assets in
 * one file, restorable on its own.
 */

export const BACKUP_KIND = 'cadence.backup'
export const BACKUP_VERSION = 1

export interface Backup {
  kind: typeof BACKUP_KIND
  /** The backup envelope's own version, not the app schema's. */
  backupVersion: number
  exportedAt: string
  state: AppState
  assets: BackupAsset[]
}

export interface BackupAsset {
  id: string
  type: string
  name?: string
  width: number
  height: number
  createdAt: string
  /** Base64, without a data: prefix. */
  data: string
}

export class BackupError extends Error {}

/* ------------------------------------------------------------------ */
/* Writing                                                             */
/* ------------------------------------------------------------------ */

/**
 * Everything, as one JSON file.
 *
 * Assets are base64 rather than a second file so a backup is one thing to keep
 * and one thing to hand back. That costs a third in size, which is the right
 * trade for something restored perhaps once.
 */
export async function buildBackup(state: AppState): Promise<string> {
  const assets: BackupAsset[] = []

  for (const id of await allImageIds().catch(() => [])) {
    const stored = await getImage(id).catch(() => undefined)
    if (!stored) continue
    assets.push({
      id: stored.id,
      type: stored.type,
      name: stored.name,
      width: stored.width,
      height: stored.height,
      createdAt: stored.createdAt,
      data: await blobToBase64(stored.blob),
    })
  }

  const backup: Backup = {
    kind: BACKUP_KIND,
    backupVersion: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    state,
    assets,
  }
  return JSON.stringify(backup)
}

/** `cadence-backup-2026-09-02.json` — sorts by date and says what it is. */
export function backupFilename(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `cadence-backup-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.json`
}

/* ------------------------------------------------------------------ */
/* Reading                                                             */
/* ------------------------------------------------------------------ */

export interface BackupSummary {
  exportedAt: string
  reminders: number
  events: number
  notes: number
  assets: number
}

/**
 * Check a file really is one of ours before touching anything.
 *
 * Restoring replaces a whole library, so a malformed or unrelated file has to
 * fail here rather than half-way through the write.
 */
export function readBackup(text: string): { backup: Backup; summary: BackupSummary } {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new BackupError('That file is not a Cadence backup.')
  }

  const backup = parsed as Partial<Backup>
  if (!backup || typeof backup !== 'object' || backup.kind !== BACKUP_KIND) {
    throw new BackupError('That file is not a Cadence backup.')
  }
  if (typeof backup.backupVersion !== 'number' || backup.backupVersion > BACKUP_VERSION) {
    throw new BackupError('That backup was written by a newer version of the app.')
  }

  const state = backup.state as Partial<AppState> | undefined
  if (!state || typeof state !== 'object' || !Array.isArray(state.notes) || !Array.isArray(state.reminders)) {
    throw new BackupError('That backup is missing its contents.')
  }

  const assets = Array.isArray(backup.assets) ? backup.assets : []
  return {
    backup: { ...(backup as Backup), assets },
    summary: {
      exportedAt: typeof backup.exportedAt === 'string' ? backup.exportedAt : 'an unknown date',
      reminders: state.reminders.length,
      events: Array.isArray(state.events) ? state.events.length : 0,
      notes: state.notes.length,
      assets: assets.length,
    },
  }
}

/**
 * Put the assets back. State is restored by the caller through the store, so
 * the schema migration runs over it the way it does for any older save.
 */
export async function restoreAssets(assets: BackupAsset[]): Promise<number> {
  let restored = 0
  for (const asset of assets) {
    try {
      const stored: StoredImage = {
        id: asset.id,
        blob: base64ToBlob(asset.data, asset.type),
        type: asset.type,
        name: asset.name,
        bytes: 0,
        width: asset.width ?? 0,
        height: asset.height ?? 0,
        createdAt: asset.createdAt ?? new Date().toISOString(),
      }
      stored.bytes = stored.blob.size
      await putStored(stored)
      restored++
    } catch {
      // One unreadable picture must not cost the rest of the restore.
    }
  }
  return restored
}

/* ------------------------------------------------------------------ */
/* Base64                                                              */
/* ------------------------------------------------------------------ */

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result)
      // Drop the `data:<type>;base64,` prefix; the type is stored separately.
      resolve(result.slice(result.indexOf(',') + 1))
    }
    reader.onerror = () => reject(new BackupError('A picture could not be read.'))
    reader.readAsDataURL(blob)
  })
}

function base64ToBlob(data: string, type: string): Blob {
  const binary = atob(data)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type: type || 'application/octet-stream' })
}
