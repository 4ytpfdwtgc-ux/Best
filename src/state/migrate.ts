import type { AppState, Note, Reminder } from '../types'
import { markdownToBlocks } from '../lib/blocks'
import { createInitialState, defaultProperties, defaultViews, PROP, SCHEMA_VERSION, STATUS } from './seed'

/** The v1 note shape: one markdown-ish string, with the title as its first line. */
interface LegacyNote extends Omit<Note, 'title' | 'blocks' | 'icon'> {
  body?: string
}

/**
 * Bring saved state up to the current schema. Callers get back state they can
 * use directly; anything unrecognisable falls back to fresh sample content
 * rather than throwing away a half-understood save silently.
 */
export function migrate(saved: Partial<AppState> & { version?: number }): AppState {
  const base = createInitialState()
  if (!saved || typeof saved !== 'object') return base

  let state = { ...base, ...saved } as AppState

  if ((saved.version ?? 0) < 2) state = migrateV1toV2(state, saved)
  if ((saved.version ?? 0) < 3) state = migrateV2toV3(state)

  return {
    ...state,
    version: SCHEMA_VERSION,
    // The split Home view is the front door on every launch.
    module: 'home',
    prefs: { ...base.prefs, ...(saved.prefs ?? {}) },
  }
}

function migrateV1toV2(state: AppState, saved: Partial<AppState>): AppState {
  const properties = state.properties?.length ? state.properties : defaultProperties()
  const views = state.views?.length ? state.views : defaultViews()

  // Notes: split the markdown body into a title and a list of blocks.
  const notes: Note[] = ((saved.notes ?? []) as unknown as LegacyNote[]).map((note) => {
    if (!note.body && (note as unknown as Note).blocks) return note as unknown as Note
    const lines = (note.body ?? '').split('\n')
    const firstIndex = lines.findIndex((l) => l.trim().length > 0)
    const rawTitle = firstIndex === -1 ? '' : lines[firstIndex]
    const isHeading = /^#{1,3}\s/.test(rawTitle.trim())
    const isListItem = /^([-*]\s|\d+[.)]\s)/.test(rawTitle.trim())
    // A leading heading was how the old editor expressed a title. A leading
    // list item was not, so that stays in the body and the note goes untitled.
    const title = isListItem
      ? ''
      : rawTitle.replace(/^#{1,3}\s*/, '').replace(/^>\s*/, '').trim()
    const rest = isListItem ? lines : lines.slice(firstIndex + 1)
    void isHeading
    return {
      ...(note as unknown as Note),
      title,
      blocks: markdownToBlocks(rest.join('\n')),
    }
  })

  // Reminders: give every row the property bag, with Status seeded from
  // whether it was already complete.
  const reminders: Reminder[] = (saved.reminders ?? []).map((reminder) => ({
    ...reminder,
    props: reminder.props ?? {
      [PROP.status]: reminder.completed ? STATUS.done : STATUS.todo,
    },
  }))

  return {
    ...state,
    properties,
    views,
    activeViewId: state.activeViewId ?? views[0].id,
    notes,
    reminders,
  }
}

/**
 * List symbols were emoji before the icon set covered them. Map the ones the
 * app itself could have produced onto their icon, and leave anything else
 * alone — an emoji still renders, so a symbol from elsewhere is not lost.
 */
const EMOJI_TO_ICON: Record<string, string> = {
  '📥': 'inbox',
  '📋': 'clipboard',
  '💼': 'briefcase',
  '🏡': 'home',
  '🛒': 'cart',
  '🎯': 'target',
  '✈': 'plane',
  '📚': 'book',
  '💡': 'bulb',
  '🏋': 'dumbbell',
  '🎁': 'gift',
  '🐾': 'heart',
  '🎵': 'music',
}

function migrateV2toV3(state: AppState): AppState {
  return {
    ...state,
    lists: state.lists.map((list) => {
      // Emoji may carry a variation selector; match on the base character.
      const base = (list.symbol ?? '').replace(/\uFE0F/g, '')
      const icon = EMOJI_TO_ICON[base]
      return icon ? { ...list, symbol: icon } : list
    }),
  }
}
