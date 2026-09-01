import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parseCapture } from '../src/lib/capture.ts'

// A Tuesday, so weekday arithmetic is easy to reason about.
const TODAY = '2026-09-01'

test('a plain phrase is just a title', () => {
  const c = parseCapture('buy oat milk', TODAY)
  assert.equal(c.title, 'buy oat milk')
  assert.equal(c.dueDate, undefined)
  assert.equal(c.priority, 0)
})

test('relative days are lifted out of the title', () => {
  assert.deepEqual(
    { ...parseCapture('call the plumber tomorrow', TODAY) },
    { title: 'call the plumber', dueDate: '2026-09-02', dueTime: undefined, priority: 0, tags: [] },
  )
  assert.equal(parseCapture('water the plants today', TODAY).dueDate, TODAY)
  assert.equal(parseCapture('review the draft next week', TODAY).dueDate, '2026-09-08')
  assert.equal(parseCapture('pay rent in 3 days', TODAY).dueDate, '2026-09-04')
  assert.equal(parseCapture('renew passport in 2 weeks', TODAY).dueDate, '2026-09-15')
})

test('a weekday resolves to its next occurrence', () => {
  assert.equal(parseCapture('gym on friday', TODAY).dueDate, '2026-09-04')
  assert.equal(parseCapture('standup next monday', TODAY).dueDate, '2026-09-07')
  // Today is Tuesday, so "tuesday" means the one coming, not today.
  assert.equal(parseCapture('trash tuesday', TODAY).dueDate, '2026-09-08')
})

test('explicit times win, and bare hours take a sensible meridiem', () => {
  assert.equal(parseCapture('call mum at 5pm', TODAY).dueTime, '17:00')
  assert.equal(parseCapture('call mum at 5:30 pm', TODAY).dueTime, '17:30')
  assert.equal(parseCapture('standup at 9am', TODAY).dueTime, '09:00')
  assert.equal(parseCapture('meeting at 17:00', TODAY).dueTime, '17:00')
  // Bare hours: 1-7 read as afternoon, 8-11 as morning.
  assert.equal(parseCapture('call at 5', TODAY).dueTime, '17:00')
  assert.equal(parseCapture('call at 9', TODAY).dueTime, '09:00')
  assert.equal(parseCapture('lunch at noon', TODAY).dueTime, '12:00')
})

test('a time on its own implies today', () => {
  const c = parseCapture('take the pills at 8pm', TODAY)
  assert.equal(c.dueDate, TODAY)
  assert.equal(c.dueTime, '20:00')
  assert.equal(c.title, 'take the pills')
})

test('tonight sets both the day and a default evening time', () => {
  const c = parseCapture('bins tonight', TODAY)
  assert.equal(c.dueDate, TODAY)
  assert.equal(c.dueTime, '19:00')
  assert.equal(c.title, 'bins')
})

test('an explicit time overrides the default tonight gives', () => {
  assert.equal(parseCapture('bins tonight at 9pm', TODAY).dueTime, '21:00')
})

test('date and time combine, leaving a clean title', () => {
  const c = parseCapture('dentist appointment tomorrow at 11am', TODAY)
  assert.equal(c.title, 'dentist appointment')
  assert.equal(c.dueDate, '2026-09-02')
  assert.equal(c.dueTime, '11:00')
})

test('calendar dates parse in both spoken and numeric forms', () => {
  assert.equal(parseCapture('mums birthday on september 17', TODAY).dueDate, '2026-09-17')
  assert.equal(parseCapture('mums birthday sep 17', TODAY).dueDate, '2026-09-17')
  assert.equal(parseCapture('invoice due 12/15', TODAY).dueDate, '2026-12-15')
})

test('a date already past rolls to next year', () => {
  assert.equal(parseCapture('taxes on january 20', TODAY).dueDate, '2027-01-20')
})

test('tags and priority are extracted', () => {
  const c = parseCapture('ship the build #work #focus !!!', TODAY)
  assert.equal(c.title, 'ship the build')
  assert.deepEqual(c.tags, ['work', 'focus'])
  assert.equal(c.priority, 3)
})

test('spoken priority works too', () => {
  const c = parseCapture('fix the leak high priority', TODAY)
  assert.equal(c.priority, 3)
  assert.equal(c.title, 'fix the leak')
})

test('a dangling preposition is trimmed from the title', () => {
  assert.equal(parseCapture('post the letter on tomorrow', TODAY).title, 'post the letter')
})

test('unrecognised words are never silently dropped', () => {
  const c = parseCapture('email Priya about the September roadmap', TODAY)
  assert.equal(c.title, 'email Priya about the September roadmap')
  assert.equal(c.dueDate, undefined)
})

test('an empty capture still yields a usable task', () => {
  assert.equal(parseCapture('   ', TODAY).title, 'New task')
})
