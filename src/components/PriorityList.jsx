import { getCategoryById } from '../context/AppContext'

// ── Priority scoring ──────────────────────────────────────────────────────────
function daysUntil(dateStr) {
  if (!dateStr) return 999
  const d = new Date(dateStr + (!dateStr.includes('T') ? 'T00:00:00' : ''))
  return (d - new Date()) / (1000 * 60 * 60 * 24)
}

function priorityScore(task) {
  const days = daysUntil(task.dueDate)
  const hours = task.estimatedHours || 1

  // Urgency: overdue tasks get a flat 500 bonus; others scale by proximity
  const urgency = days < 0
    ? 500 + Math.min(Math.abs(days) * 10, 200)   // overdue: 500–700
    : Math.min(300, 60 / Math.max(days, 0.1))     // due soon: 0–300

  // Importance: 1–5 mapped to 0–100
  const importance = ((task.importance || 3) - 1) * 25

  // Efficiency bonus: prefer quick wins when urgency/importance are equal
  const efficiency = Math.min(30, 10 / Math.max(hours, 0.25))

  return urgency + importance + efficiency
}

function formatDays(days) {
  if (days < -1)   return `${Math.abs(Math.round(days))}d LATE`
  if (days < 0)    return 'DUE TODAY'
  if (days < 1)    return 'TODAY'
  if (days < 2)    return 'TOMORROW'
  if (days < 7)    return `${Math.round(days)}d`
  if (days < 30)   return `${Math.round(days / 7)}w`
  return `${Math.round(days / 30)}mo`
}

function formatHours(h) {
  if (!h) return '?h'
  if (h < 1) return `${Math.round(h * 60)}m`
  return `${h}h`
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function PriorityList({ tasks, onClose, onSelectTask }) {
  const pending = tasks.filter(t => !t.completed && t.dueDate)
  const noDue   = tasks.filter(t => !t.completed && !t.dueDate)

  const sorted = [...pending]
    .map(t => ({ ...t, score: priorityScore(t) }))
    .sort((a, b) => b.score - a.score)

  return (
    <div className="absolute inset-y-0 right-0 w-72 bg-[#060d06]/97 border-l border-[#00ff4120] flex flex-col font-mono z-30 shadow-2xl backdrop-blur-md">

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/8">
        <div>
          <div className="text-[11px] text-[#00ff41] tracking-widest font-semibold">⚡ PRIORITY QUEUE</div>
          <div className="text-[9px] text-white/25 tracking-wide mt-0.5">
            ranked by urgency · importance · effort
          </div>
        </div>
        <button onClick={onClose} className="text-white/25 hover:text-white text-xl leading-none">×</button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {sorted.length === 0 && (
          <div className="px-4 py-8 text-center text-white/20 text-xs tracking-wide">
            NO TASKS WITH DUE DATES
          </div>
        )}

        {sorted.map((task, i) => {
          const cat  = getCategoryById(task.category)
          const days = daysUntil(task.dueDate)
          const isOverdue = days < 0
          const isUrgent  = days >= 0 && days < 3

          return (
            <button
              key={task.id}
              onClick={() => onSelectTask(task)}
              className="w-full text-left px-4 py-3 border-b border-white/5 hover:bg-white/4 transition-colors group"
            >
              {/* Rank + title row */}
              <div className="flex items-start gap-2.5">
                <span className={`text-[10px] font-semibold w-5 flex-shrink-0 mt-0.5 ${
                  i === 0 ? 'text-[#00ff41]'
                  : i === 1 ? 'text-[#80ff80]/70'
                  : i === 2 ? 'text-[#fbbf24]/60'
                  : 'text-white/20'
                }`}>
                  {i + 1}
                </span>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{ background: cat?.color }} />
                    <span className={`text-xs leading-tight truncate ${
                      isOverdue ? 'text-red-300' : 'text-white/85'
                    }`}>
                      {task.title}
                    </span>
                  </div>

                  {/* Meta row */}
                  <div className="flex items-center gap-3 pl-3">
                    <span className={`text-[10px] ${
                      isOverdue ? 'text-red-400' : isUrgent ? 'text-[#fbbf24]/80' : 'text-white/30'
                    }`}>
                      {formatDays(days)}
                    </span>
                    <span className="text-[10px] text-white/20">
                      ~{formatHours(task.estimatedHours)}
                    </span>
                    {/* Importance pips */}
                    <span className="text-[9px] tracking-tight" style={{ color: cat?.color + 'aa' }}>
                      {'█'.repeat(task.importance || 1)}{'░'.repeat(5 - (task.importance || 1))}
                    </span>
                  </div>
                </div>

                {/* Score badge */}
                <div className="text-right flex-shrink-0">
                  <div className="text-[9px] text-white/15 tracking-wide">
                    {Math.round(task.score)}
                  </div>
                </div>
              </div>

              {/* Score breakdown bar */}
              <div className="mt-2 pl-7">
                <ScoreBar task={task} days={days} />
              </div>
            </button>
          )
        })}

        {/* No-due-date tasks */}
        {noDue.length > 0 && (
          <>
            <div className="px-4 py-2 text-[9px] text-white/20 tracking-widest border-b border-white/5">
              NO DUE DATE
            </div>
            {noDue.map(task => {
              const cat = getCategoryById(task.category)
              return (
                <button key={task.id} onClick={() => onSelectTask(task)}
                  className="w-full text-left px-4 py-2.5 border-b border-white/5 hover:bg-white/4 transition-colors">
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: cat?.color }} />
                    <span className="text-xs text-white/40 truncate">{task.title}</span>
                    <span className="text-[10px] text-white/20 ml-auto flex-shrink-0">
                      ~{formatHours(task.estimatedHours)}
                    </span>
                  </div>
                </button>
              )
            })}
          </>
        )}
      </div>

      {/* Footer legend */}
      <div className="px-4 py-2.5 border-t border-white/8 text-[9px] text-white/15 space-y-0.5">
        <div>SCORE = urgency + importance + efficiency</div>
        <div>Quick tasks with near deadlines rank highest</div>
      </div>
    </div>
  )
}

// ── Mini score breakdown bar ──────────────────────────────────────────────────
function ScoreBar({ task, days }) {
  const hours = task.estimatedHours || 1
  const urgency    = days < 0 ? 500 : Math.min(300, 60 / Math.max(days, 0.1))
  const importance = ((task.importance || 3) - 1) * 25
  const efficiency = Math.min(30, 10 / Math.max(hours, 0.25))
  const total = urgency + importance + efficiency || 1

  const segs = [
    { value: urgency,    color: '#ff6644', label: 'U' },
    { value: importance, color: '#00ff41', label: 'I' },
    { value: efficiency, color: '#60a5fa', label: 'E' },
  ]

  return (
    <div className="flex gap-0.5 items-center h-1.5">
      {segs.map(s => (
        <div
          key={s.label}
          className="h-full rounded-sm"
          style={{
            width: `${Math.max(2, (s.value / total) * 100)}%`,
            background: s.color,
            opacity: 0.55,
          }}
          title={`${s.label}: ${Math.round(s.value)}`}
        />
      ))}
    </div>
  )
}
