import { useState } from 'react'
import { useApp, THEMES, CATEGORY_PRESETS, distributeAngles } from '../context/AppContext'
import { db } from '../db/database'

// ── Helpers ───────────────────────────────────────────────────────────────────
function uid() {
  return Math.random().toString(36).slice(2, 9)
}

const SWEEP_SPEEDS = [
  { id: 'slow',   label: 'SLOW',   deg: 0.15 },
  { id: 'normal', label: 'NORMAL', deg: 0.35 },
  { id: 'fast',   label: 'FAST',   deg: 0.7  },
]

const ZOOM_PRESETS = [
  { label: '1 DAY',   days: 1   },
  { label: '1 WEEK',  days: 7   },
  { label: '2 WEEKS', days: 14  },
  { label: '1 MONTH', days: 30  },
  { label: '3 MONTHS',days: 90  },
]

// ── Main component ────────────────────────────────────────────────────────────
export default function SettingsView() {
  const { categories, saveCategories, themeId, saveTheme, radarSettings, saveRadarSettings } = useApp()
  const [activeSection, setActiveSection] = useState('categories')
  const [saved, setSaved] = useState(false)

  function flashSaved() {
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  const SECTIONS = [
    { id: 'categories', label: 'CATEGORIES', icon: '◈' },
    { id: 'theme',      label: 'THEME',      icon: '◉' },
    { id: 'radar',      label: 'RADAR',      icon: '⊙' },
    { id: 'data',       label: 'DATA',       icon: '▦' },
  ]

  return (
    <div className="w-full h-full flex bg-[#0a0f0a] font-mono overflow-hidden">

      {/* ── Sidebar nav ── */}
      <div className="w-44 flex-shrink-0 border-r border-white/8 flex flex-col bg-[#080d08]/60">
        <div className="px-4 py-4 border-b border-white/8">
          <div className="text-[10px] text-white/30 tracking-widest">SETTINGS</div>
        </div>
        <nav className="flex-1 py-2">
          {SECTIONS.map(s => (
            <button key={s.id} onClick={() => setActiveSection(s.id)}
              className={`w-full text-left px-4 py-2.5 flex items-center gap-2.5 text-xs tracking-widest transition-colors ${
                activeSection === s.id
                  ? 'text-white bg-white/8 border-l-2 border-[var(--rc-accent,#00ff41)]'
                  : 'text-white/35 hover:text-white/60 hover:bg-white/4 border-l-2 border-transparent'
              }`}>
              <span className="text-base leading-none">{s.icon}</span>
              <span>{s.label}</span>
            </button>
          ))}
        </nav>
        {saved && (
          <div className="px-4 py-2 text-[10px] text-[var(--rc-accent,#00ff41)] tracking-widest animate-pulse border-t border-white/8">
            ✓ SAVED
          </div>
        )}
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto">
        {activeSection === 'categories' && (
          <CategoriesSection
            categories={categories}
            onSave={cats => { saveCategories(cats); flashSaved() }}
          />
        )}
        {activeSection === 'theme' && (
          <ThemeSection
            themeId={themeId}
            onSave={id => { saveTheme(id); flashSaved() }}
          />
        )}
        {activeSection === 'radar' && (
          <RadarSection
            settings={radarSettings}
            onSave={s => { saveRadarSettings(s); flashSaved() }}
          />
        )}
        {activeSection === 'data' && (
          <DataSection onSaved={flashSaved} />
        )}
      </div>
    </div>
  )
}

// ── Categories section ────────────────────────────────────────────────────────
function CategoriesSection({ categories, onSave }) {
  const [cats, setCats] = useState(() => categories.map(c => ({ ...c })))
  const [editing, setEditing] = useState(null)  // category id being edited inline

  function applyPreset(preset) {
    setCats(preset.categories.map(c => ({ ...c })))
    setEditing(null)
  }

  function updateCat(id, field, value) {
    setCats(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c))
  }

  function addCategory() {
    const hue = Math.floor(Math.random() * 360)
    const newCat = {
      id: uid(),
      label: 'NEW SECTOR',
      color: `hsl(${hue},80%,60%)`,
      startAngle: 0, endAngle: 90,
      calendarSources: [],
    }
    const next = [...cats, newCat]
    setCats(next)
    setEditing(newCat.id)
  }

  function deleteCategory(id) {
    if (cats.length <= 1) return
    setCats(prev => prev.filter(c => c.id !== id))
    if (editing === id) setEditing(null)
  }

  function moveUp(i) {
    if (i === 0) return
    const next = [...cats]
    ;[next[i-1], next[i]] = [next[i], next[i-1]]
    setCats(next)
  }
  function moveDown(i) {
    if (i === cats.length - 1) return
    const next = [...cats]
    ;[next[i], next[i+1]] = [next[i+1], next[i]]
    setCats(next)
  }

  return (
    <div className="p-6 max-w-2xl">
      <h2 className="text-[11px] text-white/60 tracking-widest mb-1">CATEGORIES</h2>
      <p className="text-xs text-white/25 mb-6">
        Radar wedge sectors — add, remove, rename, or recolor. Angles redistribute automatically.
      </p>

      {/* Preset layouts */}
      <div className="mb-6">
        <div className="text-[10px] text-white/30 tracking-widest mb-2">PRESET LAYOUTS</div>
        <div className="flex flex-wrap gap-2">
          {CATEGORY_PRESETS.map(preset => (
            <button key={preset.id} onClick={() => applyPreset(preset)}
              className="px-3 py-1.5 text-[10px] border border-white/15 text-white/45 rounded hover:border-[var(--rc-accent,#00ff41)] hover:text-[var(--rc-accent,#00ff41)] transition-colors tracking-wider">
              {preset.name}
            </button>
          ))}
        </div>
      </div>

      {/* Category list */}
      <div className="space-y-1 mb-4">
        {cats.map((cat, i) => (
          <div key={cat.id}>
            <div className={`flex items-center gap-3 px-3 py-2.5 rounded border transition-colors ${
              editing === cat.id
                ? 'border-white/20 bg-white/5'
                : 'border-transparent hover:border-white/10 hover:bg-white/3'
            }`}>
              {/* Color swatch + picker */}
              <label className="relative cursor-pointer flex-shrink-0 group" title="Click to change color">
                <div className="w-5 h-5 rounded-full border-2 border-white/20 group-hover:border-white/50 transition-colors"
                  style={{ background: cat.color }} />
                <input type="color" value={cat.color}
                  onChange={e => updateCat(cat.id, 'color', e.target.value)}
                  className="absolute inset-0 opacity-0 w-5 h-5 cursor-pointer" />
              </label>

              {/* Label (editable inline) */}
              {editing === cat.id ? (
                <input
                  autoFocus
                  value={cat.label}
                  onChange={e => updateCat(cat.id, 'label', e.target.value.toUpperCase())}
                  onBlur={() => setEditing(null)}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') setEditing(null) }}
                  className="flex-1 bg-transparent text-white text-xs font-mono tracking-widest outline-none border-b border-[var(--rc-accent,#00ff41)]"
                  style={{ color: cat.color }}
                />
              ) : (
                <button onClick={() => setEditing(cat.id)} className="flex-1 text-left text-xs tracking-widest" style={{ color: cat.color }}>
                  {cat.label}
                </button>
              )}

              {/* Reorder buttons */}
              <div className="flex gap-0.5">
                <button onClick={() => moveUp(i)} disabled={i === 0}
                  className="w-5 h-5 text-white/20 hover:text-white/60 disabled:opacity-20 text-xs transition-colors">↑</button>
                <button onClick={() => moveDown(i)} disabled={i === cats.length - 1}
                  className="w-5 h-5 text-white/20 hover:text-white/60 disabled:opacity-20 text-xs transition-colors">↓</button>
              </div>

              {/* Delete */}
              <button onClick={() => deleteCategory(cat.id)} disabled={cats.length <= 1}
                className="w-6 h-6 text-red-400/30 hover:text-red-400/70 disabled:opacity-20 text-sm transition-colors leading-none"
                title="Delete category">×</button>
            </div>

            {/* Angle preview bar */}
            {(() => {
              const distributed = distributeAngles(cats)
              const d = distributed[i]
              const pct = ((d.endAngle - d.startAngle) / 360) * 100
              const offset = ((d.startAngle + 90) / 360) * 100
              return (
                <div className="mx-3 mb-1 h-1 bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full rounded-full opacity-60"
                    style={{ marginLeft: `${offset}%`, width: `${pct}%`, background: cat.color }} />
                </div>
              )
            })()}
          </div>
        ))}
      </div>

      <button onClick={addCategory}
        className="w-full py-2 border border-dashed border-white/15 text-[10px] text-white/30 tracking-widest rounded hover:border-[var(--rc-accent,#00ff41)] hover:text-[var(--rc-accent,#00ff41)] transition-colors">
        + ADD CATEGORY
      </button>

      <div className="mt-6 flex gap-3">
        <button onClick={() => setCats(categories.map(c => ({ ...c })))}
          className="flex-1 py-2 text-xs text-white/30 border border-white/10 rounded hover:border-white/25 transition-colors">
          RESET
        </button>
        <button onClick={() => onSave(cats)}
          className="flex-1 py-2 text-xs border rounded transition-colors"
          style={{ color: 'var(--rc-accent,#00ff41)', borderColor: 'color-mix(in srgb, var(--rc-accent,#00ff41) 40%, transparent)' }}>
          SAVE CATEGORIES
        </button>
      </div>
    </div>
  )
}

// ── Theme section ─────────────────────────────────────────────────────────────
function ThemeSection({ themeId, onSave }) {
  return (
    <div className="p-6 max-w-2xl">
      <h2 className="text-[11px] text-white/60 tracking-widest mb-1">THEME</h2>
      <p className="text-xs text-white/25 mb-6">
        Changes the accent color used for the radar sweep, rings, UI highlights and navigation.
      </p>

      <div className="grid grid-cols-1 gap-3">
        {THEMES.map(t => (
          <button key={t.id} onClick={() => onSave(t.id)}
            className={`flex items-center gap-4 px-4 py-3 rounded-lg border transition-all ${
              themeId === t.id
                ? 'border-[var(--rc-accent,#00ff41)] bg-white/5'
                : 'border-white/10 hover:border-white/25 hover:bg-white/3'
            }`}>

            {/* Mini radar preview */}
            <svg width="48" height="48" viewBox="0 0 48 48">
              <circle cx="24" cy="24" r="22" fill={t.bgDeep} stroke={t.accent} strokeWidth="1" strokeOpacity="0.3" />
              <circle cx="24" cy="24" r="14" fill="none" stroke={t.accent} strokeWidth="0.8" strokeOpacity="0.2" />
              <circle cx="24" cy="24" r="7"  fill="none" stroke={t.accent} strokeWidth="0.8" strokeOpacity="0.2" />
              <path d="M 24 24 L 46 24 A 22 22 0 0 0 24 2 Z" fill={t.accent} opacity="0.15" />
              <line x1="24" y1="24" x2="46" y2="24" stroke={t.accent} strokeWidth="1.5" opacity="0.8" />
              <circle cx="24" cy="24" r="2.5" fill={t.accent} />
              <circle cx="34" cy="16" r="3" fill={t.accent} opacity="0.7" />
            </svg>

            <div className="text-left flex-1">
              <div className="text-xs tracking-widest mb-0.5" style={{ color: t.accent }}>{t.name}</div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full" style={{ background: t.accent }} />
                <span className="text-[10px] text-white/30">{t.accent}</span>
              </div>
            </div>

            {themeId === t.id && (
              <span className="text-[10px] tracking-widest" style={{ color: t.accent }}>ACTIVE</span>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Radar display section ─────────────────────────────────────────────────────
function RadarSection({ settings, onSave }) {
  const [local, setLocal] = useState({ ...settings })
  const set = (k, v) => setLocal(s => ({ ...s, [k]: v }))

  return (
    <div className="p-6 max-w-lg">
      <h2 className="text-[11px] text-white/60 tracking-widest mb-1">RADAR DISPLAY</h2>
      <p className="text-xs text-white/25 mb-6">Controls for the radar view appearance and defaults.</p>

      <div className="space-y-6">
        {/* Sweep speed */}
        <div>
          <div className="text-[10px] text-white/40 tracking-widest mb-2">SWEEP SPEED</div>
          <div className="flex gap-2">
            {SWEEP_SPEEDS.map(s => (
              <button key={s.id} onClick={() => set('sweepSpeed', s.id)}
                className={`flex-1 py-2 text-[10px] border rounded tracking-wider transition-all ${
                  local.sweepSpeed === s.id
                    ? 'border-[var(--rc-accent,#00ff41)] text-[var(--rc-accent,#00ff41)] bg-[color-mix(in_srgb,var(--rc-accent,#00ff41)_10%,transparent)]'
                    : 'border-white/10 text-white/35 hover:border-white/25'
                }`}>
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Default zoom */}
        <div>
          <div className="text-[10px] text-white/40 tracking-widest mb-2">DEFAULT ZOOM LEVEL</div>
          <div className="flex flex-wrap gap-2">
            {ZOOM_PRESETS.map(z => (
              <button key={z.days} onClick={() => set('defaultZoom', z.days)}
                className={`px-3 py-1.5 text-[10px] border rounded tracking-wider transition-all ${
                  local.defaultZoom === z.days
                    ? 'border-[var(--rc-accent,#00ff41)] text-[var(--rc-accent,#00ff41)] bg-[color-mix(in_srgb,var(--rc-accent,#00ff41)_10%,transparent)]'
                    : 'border-white/10 text-white/35 hover:border-white/25'
                }`}>
                {z.label}
              </button>
            ))}
          </div>
        </div>

        {/* Ring labels toggle */}
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[10px] text-white/40 tracking-widest">SHOW RING LABELS</div>
            <div className="text-[10px] text-white/20 mt-0.5">Display time labels on each radar ring</div>
          </div>
          <button onClick={() => set('showRingLabels', !local.showRingLabels)}
            className={`w-10 h-5 rounded-full transition-colors relative flex-shrink-0 ${
              local.showRingLabels ? 'bg-[color-mix(in_srgb,var(--rc-accent,#00ff41)_50%,transparent)]' : 'bg-white/10'
            }`}>
            <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${local.showRingLabels ? 'left-5' : 'left-0.5'}`} />
          </button>
        </div>
      </div>

      <div className="mt-8 flex gap-3">
        <button onClick={() => setLocal({ ...settings })}
          className="flex-1 py-2 text-xs text-white/30 border border-white/10 rounded hover:border-white/25 transition-colors">
          RESET
        </button>
        <button onClick={() => onSave(local)}
          className="flex-1 py-2 text-xs border rounded transition-colors"
          style={{ color: 'var(--rc-accent,#00ff41)', borderColor: 'color-mix(in srgb, var(--rc-accent,#00ff41) 40%, transparent)' }}>
          SAVE SETTINGS
        </button>
      </div>
    </div>
  )
}

// ── Data section ──────────────────────────────────────────────────────────────
function DataSection({ onSaved }) {
  const [confirmReset, setConfirmReset] = useState(false)
  const [exporting, setExporting] = useState(false)

  async function handleExport() {
    setExporting(true)
    try {
      const [events, tasks, notes] = await Promise.all([
        db.events.toArray(),
        db.tasks.toArray(),
        db.notes.toArray(),
      ])
      const blob = new Blob(
        [JSON.stringify({ events, tasks, notes, exportedAt: new Date().toISOString() }, null, 2)],
        { type: 'application/json' }
      )
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `radar-cal-export-${new Date().toISOString().slice(0,10)}.json`
      a.click()
      URL.revokeObjectURL(url)
      onSaved()
    } finally {
      setExporting(false)
    }
  }

  async function handleReset() {
    await Promise.all([
      db.events.clear(),
      db.tasks.clear(),
      db.notes.clear(),
      db.tagLinks.clear(),
      db.settings.clear(),
    ])
    window.location.reload()
  }

  return (
    <div className="p-6 max-w-lg">
      <h2 className="text-[11px] text-white/60 tracking-widest mb-1">DATA</h2>
      <p className="text-xs text-white/25 mb-6">Export your data or reset the app to its default state.</p>

      <div className="space-y-4">
        {/* Export */}
        <div className="p-4 border border-white/8 rounded-lg">
          <div className="text-xs text-white/60 tracking-widest mb-1">EXPORT DATA</div>
          <div className="text-xs text-white/25 mb-3">Downloads all events, tasks, and notes as a JSON file.</div>
          <button onClick={handleExport} disabled={exporting}
            className="px-4 py-2 text-[10px] border rounded tracking-widest transition-colors disabled:opacity-30"
            style={{ color: 'var(--rc-accent,#00ff41)', borderColor: 'color-mix(in srgb, var(--rc-accent,#00ff41) 40%, transparent)' }}>
            {exporting ? 'EXPORTING...' : 'EXPORT JSON'}
          </button>
        </div>

        {/* Reset */}
        <div className="p-4 border border-red-400/15 rounded-lg">
          <div className="text-xs text-red-400/70 tracking-widest mb-1">RESET ALL DATA</div>
          <div className="text-xs text-white/25 mb-3">
            Permanently deletes all events, tasks, notes, and settings. This cannot be undone.
          </div>
          {!confirmReset ? (
            <button onClick={() => setConfirmReset(true)}
              className="px-4 py-2 text-[10px] border border-red-400/25 text-red-400/50 rounded tracking-widest hover:bg-red-400/10 hover:text-red-400/80 transition-colors">
              RESET APP
            </button>
          ) : (
            <div className="flex gap-2 items-center">
              <span className="text-[10px] text-red-400/70">Are you sure?</span>
              <button onClick={handleReset}
                className="px-3 py-1.5 text-[10px] bg-red-400/20 border border-red-400/50 text-red-400 rounded tracking-widest hover:bg-red-400/30 transition-colors">
                YES, RESET
              </button>
              <button onClick={() => setConfirmReset(false)}
                className="px-3 py-1.5 text-[10px] border border-white/15 text-white/40 rounded tracking-widest hover:border-white/30 transition-colors">
                CANCEL
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
