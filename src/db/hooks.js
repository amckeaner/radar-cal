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
  })
}

export async function updateEvent(id, changes) {
  return db.events.update(id, changes)
}

export async function deleteEvent(id) {
  return db.events.delete(id)
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
    // Re-parse and save tag links
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
  // Remove old links for this note
  await db.tagLinks.where('noteId').equals(noteId).delete()

  // Extract @EventName and #TaskName tags
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
