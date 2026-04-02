import { useState } from 'react'

const TODAY = new Date()
const fmt = d => d.toISOString().split('T')[0]

// Generate a small calendar around today for the sidebar
function getDays(offset = 0) {
  const days = []
  for (let i = -3; i <= 14; i++) {
    const d = new Date(TODAY)
    d.setDate(d.getDate() + i + offset)
    days.push(d)
  }
  return days
}

const PLACEHOLDER_NOTES = {
  [fmt(TODAY)]: "Team standup at 9am — discuss @Project Deadline\n\nRemember to follow up with Alex about #Dinner with Alex next week.",
}

export default function NotesView() {
  const [selectedDate, setSelectedDate]   = useState(fmt(TODAY))
  const [notes, setNotes]                 = useState(PLACEHOLDER_NOTES)
  const [dayOffset, setDayOffset]         = useState(0)

  const days = getDays(dayOffset)
  const currentNote = notes[selectedDate] || ''

  const isToday = d => fmt(d) === fmt(TODAY)
  const isSelected = d => fmt(d) === selectedDate

  function handleNoteChange(val) {
    setNotes(prev => ({ ...prev, [selectedDate]: val }))
  }

  // Very basic tag highlighting (non-destructive preview)
  function renderTagged(text) {
    if (!text) return null
    const parts = text.split(/(@\w[\w\s]*\w|\#\w[\w\s]*\w)/g)
    return parts.map((part, i) => {
      if (part.startsWith('@')) return <mark key={i} className="bg-[#00ff4120] text-[#00ff41] px-0.5 rounded not-italic">{part}</mark>
      if (part.startsWith('#')) return <mark key={i} className="bg-[#60a5fa20] text-[#60a5fa] px-0.5 rounded not-italic">{part}</mark>
      return <span key={i}>{part}</span>
    })
  }

  return (
    <div className="flex h-full overflow-hidden bg-[#0a0f0a] font-mono">

      {/* ── Day sidebar ── */}
      <div className="w-44 flex-shrink-0 border-r border-white/10 overflow-y-auto flex flex-col">
        <div className="sticky top-0 bg-[#0a0f0a] px-3 pt-3 pb-2 border-b border-white/10">
          <span className="text-[10px] text-white/30 tracking-widest">TIMELINE</span>
        </div>

        <div className="flex flex-col gap-0.5 p-2">
          {days.map(d => {
            const key = fmt(d)
            const hasNote = !!notes[key]
            return (
              <button
                key={key}
                onClick={() => setSelectedDate(key)}
                className={[
                  'w-full text-left px-3 py-2 rounded text-xs transition-all duration-150 group',
                  isSelected(d)
                    ? 'bg-[#60a5fa15] border border-[#60a5fa33] text-[#60a5fa]'
                    : 'text-white/40 hover:text-white/70 hover:bg-white/5 border border-transparent',
                ].join(' ')}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">
                    {d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()}
                  </span>
                  {hasNote && (
                    <span className="w-1.5 h-1.5 rounded-full bg-[#60a5fa] opacity-60" />
                  )}
                </div>
                <div className={isToday(d) ? 'text-[#60a5fa] font-semibold' : ''}>
                  {isToday(d) ? 'TODAY' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </div>
              </button>
            )
          })}
        </div>

        <div className="flex justify-between px-3 pb-3 mt-auto gap-1">
          <button onClick={() => setDayOffset(o => o - 7)} className="flex-1 text-white/30 hover:text-white/70 text-xs py-1 rounded hover:bg-white/5 transition-colors">← PREV</button>
          <button onClick={() => setDayOffset(0)}           className="flex-1 text-white/30 hover:text-white/70 text-xs py-1 rounded hover:bg-white/5 transition-colors">NOW</button>
          <button onClick={() => setDayOffset(o => o + 7)} className="flex-1 text-white/30 hover:text-white/70 text-xs py-1 rounded hover:bg-white/5 transition-colors">NEXT →</button>
        </div>
      </div>

      {/* ── Note editor ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-white/10 flex-shrink-0">
          <div>
            <span className="text-white/70 text-sm">
              {new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', {
                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
              })}
            </span>
            {selectedDate === fmt(TODAY) && (
              <span className="ml-2 text-[10px] text-[#60a5fa] tracking-widest border border-[#60a5fa33] px-1.5 py-0.5 rounded">TODAY</span>
            )}
          </div>
          <div className="text-[10px] text-white/20 tracking-widest">
            {currentNote.length} CHARS
          </div>
        </div>

        {/* Editor + preview split */}
        <div className="flex-1 flex overflow-hidden">
          {/* Raw editor */}
          <div className="flex-1 flex flex-col border-r border-white/10 overflow-hidden">
            <div className="px-4 pt-2 pb-1">
              <span className="text-[10px] text-white/20 tracking-widest">EDIT · use @EventName or #TaskName to link</span>
            </div>
            <textarea
              value={currentNote}
              onChange={e => handleNoteChange(e.target.value)}
              placeholder={`Write your note for this day...\n\nTip: Use @Event or #Task to link notes to calendar items.`}
              className="flex-1 bg-transparent resize-none outline-none px-6 py-3 text-sm text-white/80 leading-relaxed placeholder-white/20"
              spellCheck={false}
            />
          </div>

          {/* Preview panel */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="px-4 pt-2 pb-1">
              <span className="text-[10px] text-white/20 tracking-widest">PREVIEW</span>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-3 text-sm text-white/60 leading-relaxed whitespace-pre-wrap">
              {currentNote
                ? renderTagged(currentNote)
                : <span className="text-white/20 italic">No note yet.</span>
              }
            </div>

            {/* Tag summary */}
            {currentNote && (() => {
              const atTags = [...currentNote.matchAll(/@(\w[\w\s]*\w|\w+)/g)].map(m => m[0])
              const hashTags = [...currentNote.matchAll(/#(\w[\w\s]*\w|\w+)/g)].map(m => m[0])
              if (!atTags.length && !hashTags.length) return null
              return (
                <div className="border-t border-white/10 px-6 py-3 flex flex-wrap gap-2">
                  {atTags.map((t, i) => (
                    <span key={i} className="text-[10px] bg-[#00ff4115] text-[#00ff41] px-2 py-0.5 rounded tracking-wide">{t}</span>
                  ))}
                  {hashTags.map((t, i) => (
                    <span key={i} className="text-[10px] bg-[#60a5fa15] text-[#60a5fa] px-2 py-0.5 rounded tracking-wide">{t}</span>
                  ))}
                </div>
              )
            })()}
          </div>
        </div>
      </div>
    </div>
  )
}
