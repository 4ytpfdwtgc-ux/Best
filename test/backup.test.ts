import assert from 'node:assert/strict'
import { test } from 'node:test'
import { BACKUP_KIND, BACKUP_VERSION, BackupError, backupFilename, readBackup } from '../src/lib/backup.ts'

const good = {
  kind: BACKUP_KIND,
  backupVersion: BACKUP_VERSION,
  exportedAt: '2026-09-04T10:00:00.000Z',
  state: { notes: [{ id: 'n1' }, { id: 'n2' }], reminders: [{ id: 'r1' }], events: [] },
  assets: [{ id: 'img_1', type: 'image/jpeg', width: 10, height: 10, createdAt: '', data: 'AA==' }],
}

test('a good backup is read and summarised', () => {
  const { backup, summary } = readBackup(JSON.stringify(good))
  assert.equal(backup.kind, BACKUP_KIND)
  assert.deepEqual(summary, {
    exportedAt: '2026-09-04T10:00:00.000Z',
    reminders: 1,
    events: 0,
    notes: 2,
    assets: 1,
  })
})

test('a file that is not a backup is refused before anything is written', () => {
  // Restoring replaces a whole library, so every one of these has to fail here
  // rather than half-way through the write.
  const cases: [string, string][] = [
    ['not json at all', 'not a Cadence backup'],
    ['{"hello":"world"}', 'not a Cadence backup'],
    ['[1,2,3]', 'not a Cadence backup'],
    ['null', 'not a Cadence backup'],
    [JSON.stringify({ ...good, kind: 'something.else' }), 'not a Cadence backup'],
  ]
  for (const [input, expected] of cases) {
    assert.throws(() => readBackup(input), (error: unknown) => {
      assert.ok(error instanceof BackupError)
      assert.match(error.message, new RegExp(expected))
      return true
    }, `expected ${input.slice(0, 24)} to be refused`)
  }
})

test('a backup from a newer version says so rather than half-restoring', () => {
  const newer = JSON.stringify({ ...good, backupVersion: BACKUP_VERSION + 1 })
  assert.throws(() => readBackup(newer), /newer version/)
})

test('a backup missing its contents is refused', () => {
  assert.throws(() => readBackup(JSON.stringify({ ...good, state: {} })), /missing its contents/)
  assert.throws(() => readBackup(JSON.stringify({ ...good, state: undefined })), /missing its contents/)
})

test('a backup with no assets is still valid', () => {
  const { summary } = readBackup(JSON.stringify({ ...good, assets: undefined }))
  assert.equal(summary.assets, 0)
})

test('the filename sorts by date and says what it is', () => {
  assert.equal(backupFilename(new Date(2026, 8, 4)), 'cadence-backup-2026-09-04.json')
  assert.equal(backupFilename(new Date(2026, 0, 31)), 'cadence-backup-2026-01-31.json')
})
