import { createContext, useContext, useEffect, useState } from 'react'
import { db, isSeeded, markSeeded, getSetting, setSetting } from '../db/database'
import { SEED_EVENTS, SEED_TASKS, SEED_NOTES } from '../data/seedData'
import { saveNote } from '../db/hooks'

// ── Default categories ────────────────────────────────────────────────────────
export const DEFAULT_CATEGORIES = [
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
    calendarSources: [],
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

// ── Themes ────────────────────────────────────────────────────────────────────
export const THEMES = [
  { id: 'green',   name: 'RADAR GREEN',  accent: '#00ff41', accentDim: '#00ff4155', bg: '#0a0f0a', bgDeep: '#040a04' },
  { id: 'blue',    name: 'STELLAR BLUE', accent: '#60a5fa', accentDim: '#60a5fa55', bg: '#080d14', bgDeep: '#04080e' },
  { id: 'amber',   name: 'AMBER ALERT',  accent: '#fbbf24', accentDim: '#fbbf2455', bg: '#0f0d07', bgDeep: '#0a0800' },
  { id: 'crimson', name: 'CRIMSON',      accent: '#f87171', accentDim: '#f8717155', bg: '#0f0808', bgDeep: '#0a0404' },
  { id: 'void',    name: 'VOID',         accent: '#e2e8f0', accentDim: '#e2e8f055', bg: '#080808', bgDeep: '#030303' },
]

// ── Preset category layouts ───────────────────────────────────────────────────
export const CATEGORY_PRESETS = [
  {
    id: '4-quad',
    name: '4 QUADRANTS',
    categories: DEFAULT_CATEGORIES,
  },
  {
    id: '2-half',
    name: '2 HALVES',
    categories: [
      { id: 'work',     label: 'WORK',     color: '#00ff41', startAngle: -90, endAngle: 90,  calendarSources: [] },
      { id: 'personal', label: 'PERSONAL', color: '#60a5fa', startAngle: 90,  endAngle: 270, calendarSources: [] },
    ],
  },
  {
    id: '3-tri',
    name: '3 SECTORS',
    categories: [
      { id: 'work',      label: 'WORK',       color: '#00ff41', startAngle: -90, endAngle: 30,  calendarSources: [] },
      { id: 'community', label: 'COMMUNITY',  color: '#fb923c', startAngle: 30,  endAngle: 150, calendarSources: [] },
      { id: 'personal',  label: 'PERSONAL',   color: '#60a5fa', startAngle: 150, endAngle: 270, calendarSources: [] },
    ],
  },
  {
    id: '6-hex',
    name: '6 SECTORS',
    categories: [
      { id: 'work',         label: 'WORK',         color: '#00ff41', startAngle: -90, endAngle: -30, calendarSources: [] },
      { id: 'professional', label: 'LEARNING',     color: '#a78bfa', startAngle: -30, endAngle: 30,  calendarSources: [] },
      { id: 'community',    label: 'COMMUNITY',    color: '#fb923c', startAngle: 30,  endAngle: 90,  calendarSources: [] },
      { id: 'personal',     label: 'PERSONAL',     color: '#60a5fa', startAngle: 90,  endAngle: 150, calendarSources: [] },
      { id: 'health',       label: 'HEALTH',       color: '#4ade80', startAngle: 150, endAngle: 210, calendarSources: [] },
      { id: 'finance',      label: 'FINANCE',      color: '#facc15', startAngle: 210, endAngle: 270, calendarSources: [] },
    ],
  },
]

// ── Default radar settings ────────────────────────────────────────────────────
export const DEFAULT_RADAR_SETTINGS = {
  sweepSpeed:     'normal',  // 'slow' | 'normal' | 'fast'
  defaultZoom:    14,        // days
  showRingLabels: true,
}

// ── Module-level mutable reference (for non-hook callers) ─────────────────────
// Updated whenever AppContext categories change — keeps getCategoryById in sync.
let _categories = DEFAULT_CATEGORIES

export function getCategoryById(id) {
  return _categories.find(c => c.id === id) || _categories[0]
}
export function getCategoryByCalendar(src) {
  return _categories.find(c => c.calendarSources?.includes(src)) || _categories[_categories.length - 1]
}

// Distribute n categories evenly around the 360° starting at -90° (top)
export function distributeAngles(cats) {
  const span = 360 / cats.length
  return cats.map((cat, i) => ({
    ...cat,
    startAngle: -90 + i * span,
    endAngle:   -90 + (i + 1) * span,
  }))
}

// ── Context ───────────────────────────────────────────────────────────────────
const AppContext = createContext(null)

export function AppProvider({ children }) {
  const [ready,          setReady]          = useState(false)
  const [error,          setError]          = useState(null)
  const [categories,     setCategories]     = useState(DEFAULT_CATEGORIES)
  const [themeId,        setThemeId]        = useState('green')
  const [radarSettings,  setRadarSettings]  = useState(DEFAULT_RADAR_SETTINGS)

  // Keep module-level variable in sync so getCategoryById always works
  useEffect(() => { _categories = categories }, [categories])

  // Apply theme CSS variables globally
  useEffect(() => {
    const t = THEMES.find(t => t.id === themeId) || THEMES[0]
    const root = document.documentElement
    root.style.setProperty('--rc-accent',     t.accent)
    root.style.setProperty('--rc-accent-dim', t.accentDim)
    root.style.setProperty('--rc-bg',         t.bg)
    root.style.setProperty('--rc-bg-deep',    t.bgDeep)
  }, [themeId])

  // ── Persist helpers ──────────────────────────────────────────────────────
  async function saveCategories(cats) {
    const distributed = distributeAngles(cats)
    await setSetting('categories', distributed)
    setCategories(distributed)
  }

  async function saveTheme(id) {
    await setSetting('themeId', id)
    setThemeId(id)
  }

  async function saveRadarSettings(s) {
    const merged = { ...radarSettings, ...s }
    await setSetting('radarSettings', merged)
    setRadarSettings(merged)
  }

  // ── Init ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    async function init() {
      try {
        // Load persisted settings
        const savedCats    = await getSetting('categories',     null)
        const savedTheme   = await getSetting('themeId',        'green')
        const savedRadar   = await getSetting('radarSettings',  null)

        if (savedCats)  { _categories = savedCats; setCategories(savedCats) }
        if (savedTheme) setThemeId(savedTheme)
        if (savedRadar) setRadarSettings({ ...DEFAULT_RADAR_SETTINGS, ...savedRadar })

        // Seed on first load
        const seeded = await isSeeded()
        if (!seeded) {
          if (SEED_EVENTS.length > 0) await db.events.bulkAdd(SEED_EVENTS)
          if (SEED_TASKS.length > 0) {
            await db.tasks.bulkAdd(SEED_TASKS.map(t => ({
              ...t, completed: false, createdAt: new Date().toISOString(),
            })))
          }
          for (const note of SEED_NOTES) await saveNote(note.date, note.content)
          await markSeeded()
        }
        setReady(true)
      } catch (e) {
        console.error('DB init error:', e)
        setError(e.message)
        setReady(true)
      }
    }
    init()
  }, [])

  const theme = THEMES.find(t => t.id === themeId) || THEMES[0]

  return (
    <AppContext.Provider value={{
      ready, error,
      categories, saveCategories,
      theme, themeId, saveTheme,
      radarSettings, saveRadarSettings,
    }}>
      {!ready ? <LoadingScreen /> : children}
    </AppContext.Provider>
  )
}

export function useApp() { return useContext(AppContext) }
export function useCategories() { return useContext(AppContext).categories }
export function useTheme() { return useContext(AppContext).theme }
export function useRadarSettings() { return useContext(AppContext).radarSettings }

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
