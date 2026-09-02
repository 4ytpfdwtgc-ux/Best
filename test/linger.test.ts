import assert from 'node:assert/strict'
import { test, mock } from 'node:test'
import {
  LINGER_MS, getLingering, isLingering, lingerReminder, releaseAll, releaseReminder,
} from '../src/state/linger.ts'

/** Every test starts with nothing held. */
function reset() {
  releaseAll()
  assert.equal(getLingering().size, 0)
}

test('a completed reminder is held, then let go on its own', () => {
  reset()
  mock.timers.enable({ apis: ['setTimeout'] })
  try {
    lingerReminder('rem_1')
    assert.ok(isLingering('rem_1'))

    // Still on screen a moment before the window closes.
    mock.timers.tick(LINGER_MS - 1)
    assert.ok(isLingering('rem_1'))

    mock.timers.tick(1)
    assert.equal(isLingering('rem_1'), false)
  } finally {
    mock.timers.reset()
  }
})

test('un-completing inside the window lets it go at once', () => {
  reset()
  mock.timers.enable({ apis: ['setTimeout'] })
  try {
    lingerReminder('rem_1')
    mock.timers.tick(500)
    releaseReminder('rem_1')
    assert.equal(isLingering('rem_1'), false)

    // The cancelled timer must not fire later and disturb a fresh hold.
    lingerReminder('rem_1')
    mock.timers.tick(LINGER_MS - 1)
    assert.ok(isLingering('rem_1'))
  } finally {
    mock.timers.reset()
  }
})

test('completing again restarts the window rather than stacking timers', () => {
  reset()
  mock.timers.enable({ apis: ['setTimeout'] })
  try {
    lingerReminder('rem_1')
    mock.timers.tick(LINGER_MS - 100)
    lingerReminder('rem_1')

    // The first timer would have fired here; the restart must have cancelled it.
    mock.timers.tick(200)
    assert.ok(isLingering('rem_1'))

    mock.timers.tick(LINGER_MS)
    assert.equal(isLingering('rem_1'), false)
  } finally {
    mock.timers.reset()
  }
})

test('reminders are held independently', () => {
  reset()
  mock.timers.enable({ apis: ['setTimeout'] })
  try {
    lingerReminder('rem_1')
    mock.timers.tick(1000)
    lingerReminder('rem_2')

    mock.timers.tick(1000)
    assert.equal(isLingering('rem_1'), false)
    assert.ok(isLingering('rem_2'))

    mock.timers.tick(1000)
    assert.equal(getLingering().size, 0)
  } finally {
    mock.timers.reset()
  }
})

test('the snapshot is a new set only when the contents change', () => {
  reset()
  mock.timers.enable({ apis: ['setTimeout'] })
  try {
    lingerReminder('rem_1')
    const first = getLingering()

    // Re-holding the same id restarts the timer without a new snapshot, so
    // useSyncExternalStore does not see a change that is not one.
    lingerReminder('rem_1')
    assert.equal(getLingering(), first)

    // Releasing something never held is likewise not a change.
    releaseReminder('rem_missing')
    assert.equal(getLingering(), first)

    lingerReminder('rem_2')
    assert.notEqual(getLingering(), first)
  } finally {
    mock.timers.reset()
  }
})

