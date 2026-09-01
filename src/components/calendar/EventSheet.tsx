import { useState } from 'react'
import type { CalendarEvent, Recurrence } from '../../types'
import { useApp } from '../../state/store'
import { addEvent, deleteEvent, updateEvent } from '../../state/actions'
import { Field, Sheet } from '../ui/primitives'
import { RecurrenceEditor } from '../ui/RecurrenceEditor'
import { Icon } from '../ui/Icon'
import { buildICS, icsFilename } from '../../lib/ics'
import { shareOrDownload } from '../../lib/deliver'

const ALERTS = [
  { value: '', label: 'None' },
  { value: '0', label: 'At time of event' },
  { value: '5', label: '5 minutes before' },
  { value: '15', label: '15 minutes before' },
  { value: '30', label: '30 minutes before' },
  { value: '60', label: '1 hour before' },
  { value: '1440', label: '1 day before' },
]

export interface EventDraft {
  event?: CalendarEvent
  startDate: string
  startTime?: string
}

export function EventSheet({ draft, onClose }: { draft: EventDraft; onClose: () => void }) {
  const state = useApp()
  const existing = draft.event

  const [title, setTitle] = useState(existing?.title ?? '')
  const [calendarId, setCalendarId] = useState(existing?.calendarId ?? state.calendars[0]?.id ?? '')
  const [allDay, setAllDay] = useState(existing?.allDay ?? false)
  const [startDate, setStartDate] = useState(existing?.startDate ?? draft.startDate)
  const [endDate, setEndDate] = useState(existing?.endDate ?? draft.startDate)
  const [startTime, setStartTime] = useState(existing?.startTime ?? draft.startTime ?? '09:00')
  const [endTime, setEndTime] = useState(existing?.endTime ?? addHour(draft.startTime ?? '09:00'))
  const [location, setLocation] = useState(existing?.location ?? '')
  const [notes, setNotes] = useState(existing?.notes ?? '')
  const [url, setUrl] = useState(existing?.url ?? '')
  const [alert, setAlert] = useState(
    existing?.alertMinutesBefore == null ? '' : String(existing.alertMinutesBefore),
  )
  const [recurrence, setRecurrence] = useState<Recurrence | undefined>(existing?.recurrence)

  function save() {
    const safeEnd = endDate < startDate ? startDate : endDate
    const payload = {
      calendarId,
      title: title.trim() || 'New Event',
      allDay,
      startDate,
      endDate: safeEnd,
      startTime: allDay ? undefined : startTime,
      endTime: allDay ? undefined : (endTime > startTime || safeEnd > startDate ? endTime : addHour(startTime)),
      location: location.trim() || undefined,
      notes: notes.trim() || undefined,
      url: url.trim() || undefined,
      alertMinutesBefore: alert === '' ? null : Number(alert),
      recurrence,
    }
    if (existing) updateEvent(existing.id, payload)
    else addEvent(payload)
    onClose()
  }

  return (
    <Sheet
      title={existing ? 'Edit Event' : 'New Event'}
      onClose={onClose}
      width={440}
      footer={
        <>
          {existing && (
            <button
              type="button"
              className="btn btn--danger"
              onClick={() => {
                deleteEvent(existing.id)
                onClose()
              }}
            >
              Delete
            </button>
          )}
          {existing && (
            <button
              type="button"
              className="btn"
              title="Send this event to the system calendar"
              onClick={() => {
                void shareOrDownload(icsFilename(existing.title), buildICS([existing]))
              }}
            >
              <Icon name="calendar" size={14} /> Add to Calendar
            </button>
          )}
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn--primary" onClick={save}>{existing ? 'Save' : 'Add'}</button>
        </>
      }
    >
      <Field label="Title">
        <input
          className="input"
          value={title}
          placeholder="New Event"
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && save()}
          aria-label="Event title"
        />
      </Field>

      <Field label="Calendar">
        <select className="select" value={calendarId} onChange={(e) => setCalendarId(e.target.value)} aria-label="Calendar">
          {state.calendars.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </Field>

      <label className="check-row">
        <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} />
        All-day
      </label>

      <div className="split">
        <Field label="Starts">
          <input type="date" className="input" value={startDate} onChange={(e) => setStartDate(e.target.value)} aria-label="Start date" />
          {!allDay && (
            <input type="time" className="input" value={startTime} onChange={(e) => setStartTime(e.target.value)} aria-label="Start time" />
          )}
        </Field>
        <Field label="Ends">
          <input type="date" className="input" value={endDate} onChange={(e) => setEndDate(e.target.value)} aria-label="End date" />
          {!allDay && (
            <input type="time" className="input" value={endTime} onChange={(e) => setEndTime(e.target.value)} aria-label="End time" />
          )}
        </Field>
      </div>

      <Field label="Repeat">
        <div style={{ width: '100%' }}>
          <RecurrenceEditor value={recurrence} onChange={setRecurrence} />
        </div>
      </Field>

      <Field label="Alert">
        <select className="select" value={alert} onChange={(e) => setAlert(e.target.value)} aria-label="Alert">
          {ALERTS.map((a) => (
            <option key={a.label} value={a.value}>{a.label}</option>
          ))}
        </select>
      </Field>

      <Field label="Location">
        <input className="input" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Add location" aria-label="Location" />
      </Field>

      <Field label="URL">
        <input className="input" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" aria-label="URL" />
      </Field>

      <Field label="Notes">
        <textarea className="textarea" value={notes} onChange={(e) => setNotes(e.target.value)} aria-label="Notes" />
      </Field>
    </Sheet>
  )
}

function addHour(time: string): string {
  const [h, m] = time.split(':').map(Number)
  const total = Math.min(23 * 60 + 59, (h || 0) * 60 + (m || 0) + 60)
  return `${`${Math.floor(total / 60)}`.padStart(2, '0')}:${`${total % 60}`.padStart(2, '0')}`
}
