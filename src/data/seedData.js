// ── Real events seeded from Andrew's Google Calendar ──────────────────────────
// Source calendars:
//   primary        → andrew@thesageschool.org  (category: work)
//   Sage Faculty   → h11ehn66c363g8tuihcstsusj4 (category: work)
//   Prof Dev       → c_fbebab6fe...             (category: professional)
//   Community      → f539mml9tdev8rss0koh0sjr2o (category: community)

export const SEED_EVENTS = [
  // ── Upcoming: April / May 2026 ────────────────────────────────────────────
  {
    gcalId: 'vk975usn1tq7akklfurtvmqsks_20260402',
    title: 'Office',
    start: '2026-04-02',
    end: '2026-04-03',
    category: 'work',
    importance: 2,
    allDay: true,
    calendarSource: 'andrew@thesageschool.org',
  },
  {
    gcalId: 'dr40j2bbcvhonblmktea9gkdp4_20260403',
    title: 'Office',
    start: '2026-04-03',
    end: '2026-04-04',
    category: 'work',
    importance: 2,
    allDay: true,
    calendarSource: 'andrew@thesageschool.org',
  },
  {
    gcalId: 'op2hjooc65qs0ld8c9cgkefc54_20260406',
    title: 'Office',
    start: '2026-04-06',
    end: '2026-04-07',
    category: 'work',
    importance: 2,
    allDay: true,
    calendarSource: 'andrew@thesageschool.org',
  },
  {
    gcalId: 'op2hjooc65qs0ld8c9cgkefc54_20260413',
    title: 'Office',
    start: '2026-04-13',
    end: '2026-04-14',
    category: 'work',
    importance: 2,
    allDay: true,
    calendarSource: 'andrew@thesageschool.org',
  },
  {
    gcalId: 'op2hjooc65qs0ld8c9cgkefc54_20260420',
    title: 'Office',
    start: '2026-04-20',
    end: '2026-04-21',
    category: 'work',
    importance: 2,
    allDay: true,
    calendarSource: 'andrew@thesageschool.org',
  },
  {
    gcalId: 'op2hjooc65qs0ld8c9cgkefc54_20260427',
    title: 'Office',
    start: '2026-04-27',
    end: '2026-04-28',
    category: 'work',
    importance: 2,
    allDay: true,
    calendarSource: 'andrew@thesageschool.org',
  },
  {
    gcalId: 'nwais-may-1',
    title: 'NWAIS Self Study Orientation Planning',
    start: '2026-05-01T16:00:00',
    end: '2026-05-01T18:00:00',
    category: 'professional',
    importance: 4,
    allDay: false,
    location: 'Zoom',
    calendarSource: 'andrew@thesageschool.org',
  },
  {
    gcalId: 'nwais-may-14',
    title: 'Self Study Orientation Final Review',
    start: '2026-05-14T10:00:00',
    end: '2026-05-14T10:45:00',
    category: 'professional',
    importance: 4,
    allDay: false,
    location: 'Zoom',
    calendarSource: 'andrew@thesageschool.org',
  },
  {
    gcalId: 'op2hjooc65qs0ld8c9cgkefc54_20260504',
    title: 'Office',
    start: '2026-05-04',
    end: '2026-05-05',
    category: 'work',
    importance: 2,
    allDay: true,
    calendarSource: 'andrew@thesageschool.org',
  },
  {
    gcalId: 'op2hjooc65qs0ld8c9cgkefc54_20260511',
    title: 'Office',
    start: '2026-05-11',
    end: '2026-05-12',
    category: 'work',
    importance: 2,
    allDay: true,
    calendarSource: 'andrew@thesageschool.org',
  },
  {
    gcalId: 'op2hjooc65qs0ld8c9cgkefc54_20260518',
    title: 'Office',
    start: '2026-05-18',
    end: '2026-05-19',
    category: 'work',
    importance: 2,
    allDay: true,
    calendarSource: 'andrew@thesageschool.org',
  },
]

// ── Seed tasks ────────────────────────────────────────────────────────────────
export const SEED_TASKS = [
  {
    title: 'Prepare NWAIS Self Study materials',
    dueDate: '2026-04-25',
    category: 'professional',
    importance: 5,
    completed: false,
  },
  {
    title: 'Review faculty calendar for end of year',
    dueDate: '2026-04-15',
    category: 'work',
    importance: 3,
    completed: false,
  },
  {
    title: 'Update professional development log',
    dueDate: '2026-04-10',
    category: 'professional',
    importance: 3,
    completed: false,
  },
]

// ── Seed notes ────────────────────────────────────────────────────────────────
const today = new Date().toISOString().split('T')[0]

export const SEED_NOTES = [
  {
    date: today,
    content: `Welcome to Radar Cal! This is today's note.\n\nYour Google Calendar events from The Sage School have been loaded.\n\nTry tagging events like @NWAIS Self Study or tasks like #Prepare NWAIS materials to link this note to them.`,
  },
]
