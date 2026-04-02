import Dexie from 'dexie'

// ── Schema version ────────────────────────────────────────────────────────────
export const db = new Dexie('RadarCalDB')

db.version(1).stores({
  // gcalId: Google Calendar event ID (null for manually created events)
  events: '++id, gcalId, title, start, end, category, importance, calendarSource, allDay',

  // Tasks have a due date and completion state
  tasks: '++id, title, dueDate, category, importance, completed, createdAt',

  // Notes are tied to a date; linkedIds connect them to events/tasks
  notes: '++id, date, content, updatedAt',

  // Tag links: connects notes → events or tasks
  tagLinks: '++id, noteId, targetType, targetId, tagText',

  // Reminders per event or task
  reminders: '++id, eventId, taskId, reminderAt, sent',

  // App-wide key/value settings
  settings: 'key',
})

// ── Helper: get a setting ─────────────────────────────────────────────────────
export async function getSetting(key, defaultValue = null) {
  const row = await db.settings.get(key)
  return row ? row.value : defaultValue
}

export async function setSetting(key, value) {
  await db.settings.put({ key, value })
}

// ── Seed check ────────────────────────────────────────────────────────────────
export async function isSeeded() {
  return getSetting('seeded', false)
}

export async function markSeeded() {
  await setSetting('seeded', true)
}
