import { addDays, todayISO, weekdayOf } from './date.ts'

/**
 * Turn a dictated phrase into a task.
 *
 * Siri hands over one run-on string — "buy oat milk tomorrow at 5pm" — so the
 * date, time, tags and priority are pulled out of it and the remainder becomes
 * the title. Matching is deliberately conservative: a phrase is only consumed
 * when it is recognised, so nothing is silently dropped from the title.
 */

export interface Capture {
  title: string
  dueDate?: string
  dueTime?: string
  priority: 0 | 1 | 2 | 3
  tags: string[]
}

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
const MONTHS = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
]

/** The next occurrence of `weekday` strictly after `from`. */
function nextWeekday(from: string, weekday: number): string {
  const delta = (weekday - weekdayOf(from) + 7) % 7
  return addDays(from, delta === 0 ? 7 : delta)
}

/**
 * A bare hour is ambiguous when dictated. Treat 1–7 as afternoon and 8–11 as
 * morning, which is how people actually speak about their day.
 */
function assumeMeridiem(hour: number): number {
  if (hour === 12) return 12
  return hour >= 1 && hour <= 7 ? hour + 12 : hour
}

function toTime(hour: number, minute: number, meridiem?: string): string {
  let h = hour
  if (meridiem === 'pm') h = hour === 12 ? 12 : hour + 12
  else if (meridiem === 'am') h = hour === 12 ? 0 : hour
  else h = assumeMeridiem(hour)
  if (h > 23) h = 23
  return `${String(h).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

export function parseCapture(input: string, today = todayISO()): Capture {
  let text = input.replace(/\s+/g, ' ').trim()
  const tags: string[] = []
  let priority: Capture['priority'] = 0
  let dueDate: string | undefined
  let dueTime: string | undefined

  /* Tags ------------------------------------------------------------ */
  text = text.replace(/#([\w-]+)/g, (_, tag: string) => {
    tags.push(tag.toLowerCase())
    return ''
  })

  /* Priority — trailing bangs, or the spoken form ------------------- */
  const bangs = text.match(/\s(!{1,3})$/)
  if (bangs) {
    priority = bangs[1].length as 1 | 2 | 3
    text = text.slice(0, bangs.index)
  } else {
    const spoken = text.match(/\b(high|medium|low) priority\b/i)
    if (spoken) {
      priority = ({ high: 3, medium: 2, low: 1 } as const)[spoken[1].toLowerCase() as 'high']
      text = text.replace(spoken[0], '')
    }
  }

  /* Time ------------------------------------------------------------ */
  const at = text.match(/\bat (\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i)
  if (at) {
    dueTime = toTime(Number(at[1]), Number(at[2] ?? 0), at[3]?.toLowerCase())
    text = text.replace(at[0], '')
  } else if (/\bnoon\b/i.test(text)) {
    dueTime = '12:00'
    text = text.replace(/\bnoon\b/i, '')
  } else if (/\bmidnight\b/i.test(text)) {
    dueTime = '00:00'
    text = text.replace(/\bmidnight\b/i, '')
  }

  /* Date ------------------------------------------------------------ */
  const consume = (match: RegExpMatchArray | null, value: string) => {
    if (!match) return false
    dueDate = value
    text = text.replace(match[0], '')
    return true
  }

  const inDays = text.match(/\bin (\d{1,3}) (day|days|week|weeks)\b/i)
  const onDate = text.match(
    new RegExp(`\\b(?:on )?(${MONTHS.join('|')}|${MONTHS.map((m) => m.slice(0, 3)).join('|')})\\.? (\\d{1,2})\\b`, 'i'),
  )
  const numeric = text.match(/\b(\d{1,2})\/(\d{1,2})\b/)
  const weekday = text.match(new RegExp(`\\b(?:on |this |next )?(${WEEKDAYS.join('|')})\\b`, 'i'))

  if (/\btonight\b/i.test(text)) {
    dueDate = today
    if (!dueTime) dueTime = '19:00'
    text = text.replace(/\btonight\b/i, '')
  } else if (/\btomorrow\b/i.test(text)) {
    consume(text.match(/\btomorrow\b/i), addDays(today, 1))
  } else if (/\btoday\b/i.test(text)) {
    consume(text.match(/\btoday\b/i), today)
  } else if (/\bnext week\b/i.test(text)) {
    consume(text.match(/\bnext week\b/i), addDays(today, 7))
  } else if (inDays) {
    const n = Number(inDays[1])
    consume(inDays, addDays(today, inDays[2].toLowerCase().startsWith('week') ? n * 7 : n))
  } else if (onDate) {
    const name = onDate[1].toLowerCase()
    const month = MONTHS.findIndex((m) => m.startsWith(name.slice(0, 3)))
    const day = Number(onDate[2])
    if (month >= 0 && day >= 1 && day <= 31) {
      const year = Number(today.slice(0, 4))
      const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      // A date already past this year means they mean next year.
      consume(onDate, iso < today ? `${year + 1}${iso.slice(4)}` : iso)
    }
  } else if (numeric) {
    const month = Number(numeric[1])
    const day = Number(numeric[2])
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const year = Number(today.slice(0, 4))
      const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      consume(numeric, iso < today ? `${year + 1}${iso.slice(4)}` : iso)
    }
  } else if (weekday) {
    const index = WEEKDAYS.indexOf(weekday[1].toLowerCase())
    consume(weekday, nextWeekday(today, index))
  }

  // A time with no date means the soonest day that time still makes sense.
  if (dueTime && !dueDate) dueDate = today

  /* Tidy up what is left ------------------------------------------- */
  const title = text
    .replace(/\s+/g, ' ')
    .replace(/\s*[,;]\s*$/, '')
    .replace(/\b(on|at|by|due)\s*$/i, '')
    .trim()

  return { title: title || 'New task', dueDate, dueTime, priority, tags }
}
