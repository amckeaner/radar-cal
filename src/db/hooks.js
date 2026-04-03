import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './database'

// ── EVENTS ────────────────────────────────────────────────────────────────────

export function useEvents() {
  return useLiveQuery(() => db.events.toArray(), []) ?? []
}

export function useUpcomingEvents(days = 365) {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() + days)
  return useLiveQuery(
    () => db.events
      .filter(e => new Date(e.start) >= new Date() && new Date(e.start) <= cutoff)
      .toArray(),
    [days]
  ) ?? []
}

export function useAllEventsInRange(startDate, endDate) {
  return useLiveQuery(
    () => db.events
      .filter(e => new Date(e.start) >= startDate && new Date(e.start) <= endDate)
      .toArray(),
    [startDate?.toISOString(), endDate?.toISOString()]
  ) ?? []
}

export async function addEvent(event) {
  return db.events.add({
    ...event,
    importance: event.importance ?? 3,
    allDay: event.allDay ?? false,
    calendarSource: event.calendarSource ?? 'manual',
    gcalId: event.gcalId ?? null,
    recurrenceType: event.recurrenceType ?? 'none',
    recurrenceEndDate: event.recurrenceEndDate ?? null,
  })
}

export async function updateEvent(id, changes) {
  return db.events.update(id, changes)
}

export async function deleteEvent(id) {
  return db.events.delete(id)
}

// ── RECURRING EVENT EXPANSION ─────────────────────────────────────────────────
// Pure helper — takes raw DB events, returns expanded list with virtual
// occurrences for recurring events within the given horizon (in days).

export function expandRecurringEvents(baseEvents, horizonDays) {
  const now = new Date()
  const cutoff = new Date(now.getTime() + horizonDays * 24 * 60 * 60 * 1000)
  const result = []

  for (const ev of baseEvents) {
    const recType = ev.recurrenceType || 'none'

    if (recType === 'none') {
      // Include if it falls within the horizon
      const evStart = new Date(ev.start + (!ev.start.includes('T') ? 'T00:00:00' : ''))
      if (evStart <= cutoff) result.push(ev)
      continue
    }

    // Recurring: generate occurrences from the base start date through cutoff
    const endLimit = ev.recurrenceEndDate ? new Date(ev.recurrenceEndDate) : cutoff
    const baseStart = new Date(ev.start + (!ev.start.includes('T') ? 'T00:00:00' : ''))

    let occurrence = new Date(baseStart)
    let count = 0
    const MAX = 500  // safety cap

    while (occurrence <= cutoff && occurrence <= endLimit && count < MAX) {
      const diffMs = occurrence - now
      const diffDays = diffMs / (1000 * 60 * 60 * 24)

      // Only include occurrences that haven't fully passed (allow same-day)
      if (diffDays >= -0.5) {
        const startStr = ev.allDay
          ? occurrence.toISOString().slice(0, 10)
          : occurrence.toISOString()

        result.push({
          ...ev,
          // Keep original id for the first occurrence so edits work; virtual id for rest
          id: count === 0 ? ev.id : `${ev.id}-r${count}`,
          _baseId: ev.id,          // always points to the real DB row
          start: startStr,
          end: startStr,
          isRecurrence: count > 0,
          recurrenceIndex: count,
        })
      }

      // Advance to next occurrence
      const next = new Date(occurrence)
      switch (recType) {
        case 'daily':     next.setDate(next.getDate() + 1);            break
        case 'weekly':    next.setDate(next.getDate() + 7);            break
        case 'biweekly':  next.setDate(next.getDate() + 14);           break
        case 'monthly':   next.setMonth(next.getMonth() + 1);          break
        case 'yearly':    next.setFullYear(next.getFullYear() + 1);    break
        default: count = MAX // unknown type → stop
      }
      occurrence = next
      count++
    }
  }

  // Sort by start ascending
  return result.sort((a, b) => new Date(a.start) - new Date(b.start))
}

// ── TASKS ─────────────────────────────────────────────────────────────────────

export function useTasks() {
  return useLiveQuery(() => db.tasks.orderBy('dueDate').toArray(), []) ?? []
}

export function usePendingTasks() {
  return useLiveQuery(
    () => db.tasks.filter(t => !t.completed).toArray(),
    []
  ) ?? []
}

export async function addTask(task) {
  return db.tasks.add({
    ...task,
    importance: task.importance ?? 3,
    completed: false,
    createdAt: new Date().toISOString(),
  })
}

export async function updateTask(id, changes) {
  return db.tasks.update(id, changes)
}

export async function toggleTask(id) {
  const task = await db.tasks.get(id)
  if (task) await db.tasks.update(id, { completed: !task.completed })
}

export async function deleteTask(id) {
  return db.tasks.delete(id)
}

// ── NOTES ─────────────────────────────────────────────────────────────────────

export function useNote(date) {
  return useLiveQuery(
    () => db.notes.where('date').equals(date).first(),
    [date]
  )
}

export function useNotesWithContent() {
  return useLiveQuery(
    () => db.notes.filter(n => n.content && n.content.trim().length > 0).toArray(),
    []
  ) ?? []
}

export async function saveNote(date, content) {
  const existing = await db.notes.where('date').equals(date).first()
  if (existing) {
    await db.notes.update(existing.id, { content, updatedAt: new Date().toISOString() })
    await saveTagLinks(existing.id, content)
    return existing.id
  } else {
    const id = await db.notes.add({ date, content, updatedAt: new Date().toISOString() })
    await saveTagLinks(id, content)
    return id
  }
}

// ── TAG LINKS ─────────────────────────────────────────────────────────────────

export function useTagLinksForNote(noteId) {
  return useLiveQuery(
    () => noteId ? db.tagLinks.where('noteId').equals(noteId).toArray() : [],
    [noteId]
  ) ?? []
}

export async function saveTagLinks(noteId, content) {
  await db.tagLinks.where('noteId').equals(noteId).delete()
  const atMatches   = [...(content?.matchAll(/@([\w][^\s@#]{0,40})/g) || [])]
  const hashMatches = [...(content?.matchAll(/#([\w][^\s@#]{0,40})/g) || [])]
  const links = [
    ...atMatches.map(m => ({ noteId, targetType: 'event', targetId: null, tagText: m[0] })),
    ...hashMatches.map(m => ({ noteId, targetType: 'task',  targetId: null, tagText: m[0] })),
  ]
  if (links.length > 0) await db.tagLinks.bulkAdd(links)
}

// ── REMINDERS ────────────────────────────────────────────────────────────────

export function useReminders() {
  return useLiveQuery(() => db.reminders.toArray(), []) ?? []
}

export async function addReminder(reminder) {
  return db.reminders.add({ ...reminder, sent: false })
}

export async function deleteReminder(id) {
  return db.reminders.delete(id)
}
