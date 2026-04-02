import { useState, useEffect, useCallback } from 'react'
import { useNote, useNotesWithContent, saveNote } from '../db/hooks'

const TODAY = new Date().toISOString().split('T')[0]

function fmt(d) { return d instanceof Date ? d.toISOString().split('T')[0] : d }

function getDays(centerDate, offset = 0) {
  const base = new Date(centerDate + 'T12:00:00')
  base.setDate(base.getDate() + offset)
  return Array.from({ length: 18 }, (_, i) => {
    const d = new Date(base)
    d.setDate(base.getDate() + i - 3)
    return d
  })
}

function renderTagged(text) {
  if (!text) return null
  const parts = text.split(/(@[\w][^\s@#]{0,40}|#[\w][^\s@#]{0,40})/g)
  return parts.map((part, i) => {
    if (part.startsWith('@'))
      return <mark key={i} className="bg-[#00ff4120] text-[#00ff41] px-0.5 rounded not-italic">{part}</mark>
    if (part.startsWith('#'))
      return <mark key={i} className="bg-[#60a5fa20] text-[#60a5fa] px-0.5 rounded not-italic">{part}</mark>
    return <span key={i}>{part}</span>
  })
}

// Sub-component: reads a single note from DB for dot indicator
function NoteIndicator({ date }) {
  const note = useNote(fmt(date))
  return note?.content?.trim() ? (
    <span className="w-1.5 h-1.5 rounded-full bg-[#60a5fa] opacity-70 flex-shrink-0" />
  ) : null
}

// Sub-component: the main editor, loaded when a date is selected
function NoteEditor({ date }) {
  const dbNote = useNote(date)
  const [draft, setDraft] = useState('')
  const [saved, setSaved] = useState(true)

  // Sync draft when DB note loads or date changes
  useEffect(() => {
    setDraft(dbNote?.content || '')
    setSaved(true)
  }, [dbNote?.content, date])

  // Auto-save with debounce
  useEffect(() => {
    if (saved) return
    const timer = setTimeout(async () => {
      await saveNote(date, draft)
      setSaved(true)
    }, 800)
    return () => clearTimeout(timer)
  }, [draft, saved, date])

  function handleChange(val) {
    setDraft(val)
    setSaved(false)
  }

  const atTags   = [...(draft?.matchAll(/@([\w][^\s@#]{0,40})/g) || [])].map(m => m[0])
  const hashTags = [...(draft?.matchAll(/#([\w][^\s@#]{0,40})/g) || [])].map(m => m[0])

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Status bar */}
      <div className="flex items-center justify-between px-6 py-2 border-b border-white/10 flex-shrink-0">
        <span className="text-[10px] text-white/20 tracking-widest">
          {new Date(date + 'T12:00:00').toLocaleDateString('en-US', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
          })}
          {date === TODAY && <span className="ml-2 text-[#60a5fa] border border-[#60a5fa30] px-1.5 py-0.5 rounded">TODAY</span>}
        </span>
        <span className={`text-[10px] tracking-widest transition-colors ${saved ? 'text-white/20' : 'text-[#60a5fa] animate-pulse'}`}>
          {saved ? 'SAVED' : 'SAVING...'}
        </span>
      </div>

      {/* Editor + preview */}
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex flex-col border-r border-white/10">
          <div className="px-4 pt-2 pb-1 text-[10px] text-white/20 tracking-widest">
            EDIT · @EventName or #TaskName to link
          </div>
          <textarea
            value={draft}
            onChange={e => handleChange(e.target.value)}
            placeholder={`Write your note for this day...\n\nTip: @EventName links to events, #TaskName links to tasks.`}
            className="flex-1 bg-transparent resize-none outline-none px-6 py-3 text-sm text-white/80 leading-relaxed placeholder-white/20"
            spellCheck={false}
          />
        </div>

        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="px-4 pt-2 pb-1 text-[10px] text-white/20 tracking-widest">PREVIEW</div>
          <div className="flex-1 overflow-y-auto px-6 py-3 text-sm text-white/60 leading-relaxed whitespace-pre-wrap">
            {draft ? renderTagged(draft) : <span className="text-white/20 italic">Nothing here yet.</span>}
          </div>
          {(atTags.length > 0 || hashTags.length > 0) && (
            <div className="border-t border-white/10 px-6 py-3 flex flex-wrap gap-2">
              {atTags.map((t, i) => (
                <span key={i} className="text-[10px] bg-[#00ff4115] text-[#00ff41] px-2 py-0.5 rounded tracking-wide">{t}</span>
              ))}
              {hashTags.map((t, i) => (
                <span key={i} className="text-[10px] bg-[#60a5fa15] text-[#60a5fa] px-2 py-0.5 rounded tracking-wide">{t}</span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function NotesView() {
  const [selectedDate, setSelectedDate] = useState(TODAY)
  const [dayOffset, setDayOffset]       = useState(0)

  const days = getDays(TODAY, dayOffset)

  return (
    <div className="flex h-full overflow-hidden bg-[#0a0f0a] font-mono">
      {/* ── Day sidebar ── */}
      <div className="w-44 flex-shrink-0 border-r border-white/10 flex flex-col overflow-hidden">
        <div className="px-3 pt-3 pb-2 border-b border-white/10 flex-shrink-0">
          <span className="text-[10px] text-white/30 tracking-widest">TIMELINE</span>
        </div>

        <div className="flex-1 overflow-y-auto flex flex-col gap-0.5 p-2">
          {days.map(d => {
            const key = fmt(d)
            const isToday    = key === TODAY
            const isSelected = key === selectedDate
            return (
              <button
                key={key}
                onClick={() => setSelectedDate(key)}
                className={[
                  'w-full text-left px-3 py-2 rounded text-xs transition-all duration-150 flex items-center justify-between border',
                  isSelected
                    ? 'bg-[#60a5fa15] border-[#60a5fa33] text-[#60a5fa]'
                    : 'text-white/40 hover:text-white/70 hover:bg-white/5 border-transparent',
                ].join(' ')}
              >
                <div>
                  <div className="font-medium">
                    {d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()}
                  </div>
                  <div className={isToday ? 'text-[#60a5fa] font-semibold' : ''}>
                    {isToday ? 'TODAY' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </div>
                </div>
                <NoteIndicator date={d} />
              </button>
            )
          })}
        </div>

        <div className="flex border-t border-white/10 flex-shrink-0">
          {[
            { label: '←', fn: () => setDayOffset(o => o - 7) },
            { label: '◉', fn: () => setDayOffset(0) },
            { label: '→', fn: () => setDayOffset(o => o + 7) },
          ].map(btn => (
            <button key={btn.label} onClick={btn.fn}
              className="flex-1 py-2 text-white/30 hover:text-white/70 text-xs hover:bg-white/5 transition-colors">
              {btn.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Note editor ── */}
      <NoteEditor date={selectedDate} />
    </div>
  )
}
