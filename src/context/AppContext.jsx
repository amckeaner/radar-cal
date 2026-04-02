import { createContext, useContext, useEffect, useState } from 'react'
import { db, isSeeded, markSeeded } from '../db/database'
import { SEED_EVENTS, SEED_TASKS, SEED_NOTES } from '../data/seedData'
import { saveNote } from '../db/hooks'

// ── Categories — mapped to Andrew's actual calendars ─────────────────────────
export const CATEGORIES = [
  {
    id: 'work',
    label: 'SAGE SCHOOL',
    color: '#00ff41',
    startAngle: -90,
    endAngle: 0,
    calendarSources: ['andrew@thesageschool.org', 'h11ehn66c363g8tuihcstsusj4@group.calendar.google.com'],
  },
  {
    id: 'professional',
    label: 'PROF DEV',
    color: '#a78bfa',
    startAngle: 0,
    endAngle: 90,
    calendarSources: ['c_fbebab6fef13b821098e63850c8184934a10d5e8dac7aacfcf111bf1d59ad69e@group.calendar.google.com'],
  },
  {
    id: 'community',
    label: 'COMMUNITY',
    color: '#fb923c',
    startAngle: 90,
    endAngle: 180,
    calendarSources: ['f539mml9tdev8rss0koh0sjr2o@group.calendar.google.com'],
  },
  {
    id: 'personal',
    label: 'PERSONAL',
    color: '#60a5fa',
    startAngle: 180,
    endAngle: 270,
    calendarSources: [],
  },
]

export function getCategoryById(id) {
  return CATEGORIES.find(c => c.id === id) || CATEGORIES[0]
}

export function getCategoryByCalendar(calendarSource) {
  return CATEGORIES.find(c => c.calendarSources.includes(calendarSource)) || CATEGORIES[3]
}

// ── Context ───────────────────────────────────────────────────────────────────
const AppContext = createContext(null)

export function AppProvider({ children }) {
  const [ready, setReady] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function init() {
      try {
        const seeded = await isSeeded()
        if (!seeded) {
          // Seed events
          if (SEED_EVENTS.length > 0) {
            await db.events.bulkAdd(SEED_EVENTS)
          }
          // Seed tasks
          if (SEED_TASKS.length > 0) {
            const tasks = SEED_TASKS.map(t => ({
              ...t,
              completed: false,
              createdAt: new Date().toISOString(),
            }))
            await db.tasks.bulkAdd(tasks)
          }
          // Seed notes
          for (const note of SEED_NOTES) {
            await saveNote(note.date, note.content)
          }
          await markSeeded()
        }
        setReady(true)
      } catch (e) {
        console.error('DB init error:', e)
        setError(e.message)
        setReady(true) // still render, just empty
      }
    }
    init()
  }, [])

  return (
    <AppContext.Provider value={{ ready, error }}>
      {!ready ? <LoadingScreen /> : children}
    </AppContext.Provider>
  )
}

export function useApp() {
  return useContext(AppContext)
}

// ── Loading screen ────────────────────────────────────────────────────────────
function LoadingScreen() {
  return (
    <div className="flex items-center justify-center h-screen bg-[#0a0f0a]">
      <div className="text-center font-mono">
        <div className="relative w-16 h-16 mx-auto mb-4">
          <div className="absolute inset-0 rounded-full border border-[#00ff4130]" />
          <div className="absolute inset-2 rounded-full border border-[#00ff4150]" />
          <div className="absolute inset-4 rounded-full border border-[#00ff4170]" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-2 h-2 rounded-full bg-[#00ff41] animate-pulse" />
          </div>
        </div>
        <p className="text-[#00ff41] text-xs tracking-widest animate-pulse">INITIALIZING</p>
      </div>
    </div>
  )
}
