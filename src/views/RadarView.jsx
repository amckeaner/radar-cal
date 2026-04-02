import { useEffect, useRef, useState, useMemo } from 'react'
import * as d3 from 'd3'
import { useUpcomingEvents, usePendingTasks, deleteEvent, deleteTask, updateEvent, updateTask } from '../db/hooks'
import { CATEGORIES, getCategoryById } from '../context/AppContext'
import EventModal from '../components/EventModal'
import TaskModal from '../components/TaskModal'

// ── Helpers ───────────────────────────────────────────────────────────────────
function daysUntil(dateStr) {
  return (new Date(dateStr) - new Date()) / (1000 * 60 * 60 * 24)
}

function toRad(deg) { return (deg * Math.PI) / 180 }

// Map days-until to a radius fraction (log scale, 0.05–0.90 of maxR)
function timeToRadius(days, maxR) {
  const fraction = Math.log(Math.max(days, 0.01) + 1) / Math.log(366)
  return fraction * maxR * 0.85 + maxR * 0.05
}

// Initial angle in the centre of a category wedge (used as starting position for simulation)
function categoryMidAngle(cat) {
  return toRad((cat.startAngle + cat.endAngle) / 2)
}

export default function RadarView() {
  const svgRef    = useRef(null)
  const sweepRef  = useRef(null)    // rAF id
  const simRef    = useRef(null)    // d3 simulation

  const [size, setSize]           = useState({ w: 800, h: 600 })
  const [selected, setSelected]   = useState(null)   // { item, type }
  const [editTarget, setEdit]     = useState(null)   // { item, type } → open modal
  const [showEventModal, setShowEvent] = useState(false)
  const [showTaskModal,  setShowTask]  = useState(false)
  const [clickHint, setClickHint]      = useState(null) // { category, days } pre-fill

  // Live DB data
  const events = useUpcomingEvents(365) || []
  const tasks  = usePendingTasks()      || []

  const futureEvents = events.filter(e => !e.allDay && daysUntil(e.start) > -0.5)
  const futureAllDay = events.filter(e =>  e.allDay && daysUntil(e.start) > -0.5)
  const futureTasks  = tasks.filter(t => t.dueDate && daysUntil(t.dueDate) > -0.5)

  const cx = size.w / 2
  const cy = size.h / 2
  const maxR = Math.min(cx, cy) * 0.88

  // ── Responsive sizing ────────────────────────────────────────────────────────
  useEffect(() => {
    const el = svgRef.current?.parentElement
    if (!el) return
    const obs = new ResizeObserver(([entry]) => {
      setSize({ w: entry.contentRect.width, h: entry.contentRect.height })
    })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  // ── Radar sweep animation ─────────────────────────────────────────────────────
  useEffect(() => {
    let angle = 0
    function tick() {
      angle = (angle + 0.35) % 360
      const sw = svgRef.current?.querySelector('#sweep-group')
      if (sw) sw.setAttribute('transform', `rotate(${angle},${size.w/2},${size.h/2})`)
      sweepRef.current = requestAnimationFrame(tick)
    }
    sweepRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(sweepRef.current)
  }, [size])

  // ── D3 force simulation for blip positions ────────────────────────────────────
  const blipNodes = useMemo(() => {
    if (!maxR || maxR <= 0) return []
    const nodes = []

    futureEvents.forEach(e => {
      const cat = getCategoryById(e.category)
      if (!cat) return
      const r   = timeToRadius(daysUntil(e.start), maxR)
      const ang = categoryMidAngle(cat)
      nodes.push({
        id: `e-${e.id}`,
        item: e,
        itemType: 'event',
        targetR: r,
        targetAng: ang,
        x: cx + r * Math.cos(ang),
        y: cy + r * Math.sin(ang),
        radius: 4 + (e.importance || 3) * 1.5,
        color: cat.color,
      })
    })

    futureTasks.forEach(t => {
      const cat = getCategoryById(t.category)
      if (!cat) return
      const r   = timeToRadius(daysUntil(t.dueDate), maxR)
      const ang = categoryMidAngle(cat)
      nodes.push({
        id: `t-${t.id}`,
        item: t,
        itemType: 'task',
        targetR: r,
        targetAng: ang,
        x: cx + r * Math.cos(ang) + 15,
        y: cy + r * Math.sin(ang) + 15,
        radius: 4 + (t.importance || 3) * 1.2,
        color: cat.color,
      })
    })
    return nodes
  }, [futureEvents, futureTasks, cx, cy, maxR])

  // Run the simulation and update DOM directly (no React re-render per tick)
  useEffect(() => {
    if (!blipNodes.length || maxR <= 0) return

    if (simRef.current) simRef.current.stop()

    simRef.current = d3.forceSimulation(blipNodes)
      .alphaDecay(0.04)
      .force('collide', d3.forceCollide(d => d.radius + 3).strength(0.85))
      .force('radial', d3.forceRadial(d => d.targetR, cx, cy).strength(0.6))
      .force('angle', {
        // Custom force: push nodes back toward their category's angular zone
        initialize(nodes) { this._nodes = nodes },
        force(alpha) {
          for (const n of this._nodes) {
            const cat = getCategoryById(n.item.category)
            if (!cat) continue
            const dx = n.x - cx, dy = n.y - cy
            let ang = Math.atan2(dy, dx) * 180 / Math.PI
            // Clamp angle into wedge
            const lo = cat.startAngle, hi = cat.endAngle
            const mid = (lo + hi) / 2
            const clamped = Math.max(lo, Math.min(hi, ang))
            const diff = (clamped - ang) * (Math.PI / 180)
            const r = Math.sqrt(dx * dx + dy * dy) || 1
            n.vx += Math.cos(Math.atan2(dy, dx) + diff) * r * alpha * 0.4 - dx * alpha * 0.01
            n.vy += Math.sin(Math.atan2(dy, dx) + diff) * r * alpha * 0.4 - dy * alpha * 0.01
          }
        },
      })
      .on('tick', () => {
        blipNodes.forEach(n => {
          const g = svgRef.current?.querySelector(`[data-blip="${n.id}"]`)
          if (g) g.setAttribute('transform', `translate(${n.x},${n.y})`)
        })
      })

    return () => simRef.current?.stop()
  }, [blipNodes, cx, cy, maxR])

  // ── Arc generator for wedge sectors ──────────────────────────────────────────
  const arc = d3.arc()

  function wedgePath(cat) {
    return arc({
      innerRadius: 0,
      outerRadius: maxR,
      startAngle: toRad(cat.startAngle),
      endAngle:   toRad(cat.endAngle),
    })
  }

  const TIME_RINGS = [
    { label: 'TODAY',      days: 1   },
    { label: 'THIS WEEK',  days: 7   },
    { label: 'THIS MONTH', days: 30  },
    { label: 'THIS YEAR',  days: 365 },
  ]

  // ── Radar click: detect which category+time zone was clicked ─────────────────
  function handleRadarClick(e) {
    const rect = svgRef.current.getBoundingClientRect()
    const dx = e.clientX - rect.left - cx
    const dy = e.clientY - rect.top  - cy
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist > maxR || dist < 10) return

    // Find category from angle
    let angleDeg = Math.atan2(dy, dx) * 180 / Math.PI
    const cat = CATEGORIES.find(c => {
      let lo = c.startAngle, hi = c.endAngle
      return angleDeg >= lo && angleDeg < hi
    })

    // Convert radius back to approximate days
    // r = fraction * maxR * 0.85 + maxR * 0.05 → fraction = (r - 0.05*maxR) / (0.85*maxR)
    const fraction = Math.max(0, (dist - maxR * 0.05) / (maxR * 0.85))
    const days = Math.round(Math.pow(366, fraction) - 1)
    const date = new Date()
    date.setDate(date.getDate() + days)
    const dateStr = date.toISOString().slice(0, 10)

    setClickHint({ category: cat?.id || 'work', date: dateStr })
    setShowEvent(true)
  }

  // ── Handle edit/delete from detail panel ──────────────────────────────────────
  async function handleDelete() {
    if (!selected) return
    if (selected.type === 'event') await deleteEvent(selected.item.id)
    else                           await deleteTask(selected.item.id)
    setSelected(null)
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="relative w-full h-full flex overflow-hidden bg-[#0a0f0a] scanlines no-select">

      {/* ── SVG Radar canvas ── */}
      <div className="flex-1 relative" onClick={handleRadarClick}>
        <svg
          ref={svgRef}
          className="absolute inset-0"
          style={{ width: '100%', height: '100%' }}
          width={size.w} height={size.h}
        >
          <defs>
            {/* Sweep gradient */}
            <linearGradient id="sweepGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%"   stopColor="#00ff41" stopOpacity="0" />
              <stop offset="100%" stopColor="#00ff41" stopOpacity="0.28" />
            </linearGradient>

            {/* Radial edge fade */}
            <radialGradient id="radarFade" cx="50%" cy="50%" r="50%">
              <stop offset="60%"  stopColor="#0a0f0a" stopOpacity="0"   />
              <stop offset="100%" stopColor="#0a0f0a" stopOpacity="0.55" />
            </radialGradient>

            {/* Clip to circle */}
            <clipPath id="radarClip">
              <circle cx={cx} cy={cy} r={maxR} />
            </clipPath>

            {/* Blip glow */}
            <filter id="blipGlow" x="-70%" y="-70%" width="240%" height="240%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>

            {/* Selected glow */}
            <filter id="blipGlowSel" x="-70%" y="-70%" width="240%" height="240%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>

          {/* ── Background disk ── */}
          <circle cx={cx} cy={cy} r={maxR + 1} fill="#040a04" stroke="#00ff4120" strokeWidth="1" />

          {/* ── Category wedge fills (D3 arc) ── */}
          <g transform={`translate(${cx},${cy})`}>
            {CATEGORIES.map(cat => (
              <path
                key={cat.id}
                d={wedgePath(cat)}
                fill={cat.color}
                opacity="0.04"
                clipPath="url(#radarClip)"
              />
            ))}
          </g>

          {/* ── Divider lines ── */}
          {CATEGORIES.map(cat => {
            const r = toRad(cat.startAngle)
            return (
              <line key={cat.id}
                x1={cx} y1={cy}
                x2={cx + maxR * Math.cos(r)}
                y2={cy + maxR * Math.sin(r)}
                stroke="#00ff4122" strokeWidth="1" strokeDasharray="5 5"
              />
            )
          })}

          {/* ── Category labels ── */}
          {CATEGORIES.map(cat => {
            const mid = toRad((cat.startAngle + cat.endAngle) / 2)
            const lr  = maxR * 0.93
            return (
              <text key={cat.id}
                x={cx + lr * Math.cos(mid)} y={cy + lr * Math.sin(mid)}
                fill={cat.color} opacity="0.5" fontSize="9"
                fontFamily="JetBrains Mono, monospace" fontWeight="600"
                letterSpacing="2" textAnchor="middle" dominantBaseline="middle"
              >{cat.label}</text>
            )
          })}

          {/* ── Time rings ── */}
          {TIME_RINGS.map(ring => {
            const r = timeToRadius(ring.days, maxR)
            return (
              <g key={ring.label}>
                <circle cx={cx} cy={cy} r={r} fill="none" stroke="#00ff4114" strokeWidth="1" />
                <text x={cx + r + 4} y={cy - 5}
                  fill="#00ff4130" fontSize="8"
                  fontFamily="JetBrains Mono, monospace" letterSpacing="1.5">
                  {ring.label}
                </text>
              </g>
            )
          })}

          {/* ── Cross hairs ── */}
          <line x1={cx - maxR} y1={cy} x2={cx + maxR} y2={cy} stroke="#00ff400e" strokeWidth="1" />
          <line x1={cx} y1={cy - maxR} x2={cx} y2={cy + maxR} stroke="#00ff400e" strokeWidth="1" />

          {/* ── Sweep (rotated by rAF) ── */}
          <g id="sweep-group">
            <path
              d={`M ${cx} ${cy} L ${cx + maxR} ${cy} A ${maxR} ${maxR} 0 0 0 ${cx + maxR * Math.cos(toRad(-55))} ${cy + maxR * Math.sin(toRad(-55))} Z`}
              fill="url(#sweepGrad)" opacity="0.8" clipPath="url(#radarClip)"
            />
            <line x1={cx} y1={cy} x2={cx + maxR} y2={cy}
              stroke="#00ff41" strokeWidth="1.5" opacity="0.65"
            />
          </g>

          {/* ── Edge fade overlay ── */}
          <circle cx={cx} cy={cy} r={maxR} fill="url(#radarFade)" pointerEvents="none" />

          {/* ── Blips (positioned by D3 simulation via DOM transforms) ── */}
          {blipNodes.map(n => {
            const isSel = selected?.item?.id === n.item.id && selected?.type === n.itemType
            return (
              <g
                key={n.id}
                data-blip={n.id}
                transform={`translate(${n.x},${n.y})`}
                onClick={e => { e.stopPropagation(); setSelected(isSel ? null : { item: n.item, type: n.itemType }) }}
                style={{ cursor: 'pointer' }}
                filter={isSel ? 'url(#blipGlowSel)' : 'url(#blipGlow)'}
              >
                {/* Outer pulse ring */}
                <circle r={n.radius + 6} fill="none" stroke={n.color}
                  strokeWidth="1" opacity={isSel ? 0.7 : 0.18} />

                {/* Main shape */}
                {n.itemType === 'event' ? (
                  <circle r={n.radius} fill={n.color} opacity={isSel ? 1 : 0.88} />
                ) : (
                  // Task = diamond
                  <polygon
                    points={`0,${-n.radius} ${n.radius},0 0,${n.radius} ${-n.radius},0`}
                    fill={n.color} opacity={isSel ? 1 : 0.82}
                  />
                )}

                {/* Inner hole */}
                <circle r={2.5} fill="#040a04" />
              </g>
            )
          })}

          {/* ── Center dot ── */}
          <circle cx={cx} cy={cy} r={5} fill="#00ff41" opacity="0.9" />
          <circle cx={cx} cy={cy} r={2} fill="#040a04" />

          {/* ── All-day event tick marks on outer ring ── */}
          {futureAllDay.map(e => {
            const days = daysUntil(e.start)
            if (days > 365 || days < 0) return null
            const cat = getCategoryById(e.category)
            const mid = toRad((cat.startAngle + cat.endAngle) / 2)
            const r1 = maxR - 8, r2 = maxR - 1
            return (
              <line key={e.id}
                x1={cx + r1 * Math.cos(mid)} y1={cy + r1 * Math.sin(mid)}
                x2={cx + r2 * Math.cos(mid)} y2={cy + r2 * Math.sin(mid)}
                stroke={cat.color} strokeWidth="2" opacity="0.6"
              />
            )
          })}
        </svg>
      </div>

      {/* ── Click hint label ── */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 text-[10px] font-mono text-white/20 tracking-widest pointer-events-none">
        CLICK RADAR TO ADD EVENT
      </div>

      {/* ── Detail panel ── */}
      {selected && (
        <DetailPanel
          selected={selected}
          onClose={() => setSelected(null)}
          onEdit={() => {
            setEdit(selected)
            selected.type === 'event' ? setShowEvent(true) : setShowTask(true)
          }}
          onDelete={handleDelete}
        />
      )}

      {/* ── Task list sidebar ── */}
      <TaskSidebar tasks={futureTasks} onSelect={t => setSelected({ item: t, type: 'task' })} selected={selected} />

      {/* ── Add buttons ── */}
      <div className="absolute bottom-4 right-52 flex gap-2">
        <button onClick={e => { e.stopPropagation(); setClickHint(null); setShowTask(true) }}
          className="px-3 py-2 bg-[#0d1a0d]/90 border border-[#fbbf2433] text-[#fbbf24] text-[10px] font-mono tracking-widest rounded hover:bg-[#fbbf2415] transition-colors">
          + TASK
        </button>
        <button onClick={e => { e.stopPropagation(); setClickHint(null); setShowEvent(true) }}
          className="px-3 py-2 bg-[#0d1a0d]/90 border border-[#00ff4133] text-[#00ff41] text-[10px] font-mono tracking-widest rounded hover:bg-[#00ff4115] transition-colors">
          + EVENT
        </button>
      </div>

      {/* ── Legend ── */}
      <div className="absolute bottom-4 left-4 font-mono text-xs text-white/30 space-y-1 no-select pointer-events-none">
        {CATEGORIES.map(cat => (
          <div key={cat.id} className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full" style={{ background: cat.color }} />
            <span>{cat.label}</span>
          </div>
        ))}
        <div className="mt-1 text-[10px] text-white/20">● EVENT  ◇ TASK</div>
      </div>

      {/* Modals */}
      {showEventModal && (
        <EventModal
          onClose={() => { setShowEvent(false); setClickHint(null); setEdit(null) }}
          prefillCategory={clickHint?.category}
          prefillDate={clickHint?.date}
          editItem={editTarget?.type === 'event' ? editTarget.item : null}
        />
      )}
      {showTaskModal && (
        <TaskModal
          onClose={() => { setShowTask(false); setEdit(null) }}
          editItem={editTarget?.type === 'task' ? editTarget.item : null}
        />
      )}
    </div>
  )
}

// ── Detail panel ──────────────────────────────────────────────────────────────
function DetailPanel({ selected, onClose, onEdit, onDelete }) {
  const { item, type } = selected
  const cat = getCategoryById(item.category)
  const dateStr = item.start || item.dueDate
  const days = daysUntil(dateStr)

  return (
    <div className="absolute right-4 top-4 w-64 bg-[#0a140a]/95 border rounded-xl p-4 font-mono text-sm shadow-2xl z-20 backdrop-blur-sm"
      style={{ borderColor: cat?.color + '44' }}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] tracking-widest" style={{ color: cat?.color }}>
          {type === 'task' ? '◇ TASK' : '● EVENT'}
        </span>
        <button onClick={onClose} className="text-white/30 hover:text-white text-xl leading-none">×</button>
      </div>

      <p className="text-white font-medium mb-3 leading-snug">{item.title}</p>

      <div className="space-y-1.5 text-xs text-white/50 mb-4">
        <div className="flex justify-between">
          <span>CATEGORY</span>
          <span style={{ color: cat?.color }}>{cat?.label}</span>
        </div>
        <div className="flex justify-between">
          <span>DATE</span>
          <span className="text-white/70">
            {new Date(dateStr + (item.allDay ? 'T12:00:00' : '')).toLocaleDateString('en-US', {
              month: 'short', day: 'numeric', year: 'numeric',
            })}
          </span>
        </div>
        {!item.allDay && (
          <div className="flex justify-between">
            <span>IN</span>
            <span className="text-white/70">
              {days < 0 ? 'PAST' : days < 1 ? `${Math.round(days * 24)}h` : `${Math.round(days)}d`}
            </span>
          </div>
        )}
        <div className="flex justify-between">
          <span>IMPORTANCE</span>
          <span className="text-white/80 tracking-wider">
            {'█'.repeat(item.importance || 1)}{'░'.repeat(5 - (item.importance || 1))}
          </span>
        </div>
        {item.location && (
          <div className="flex justify-between gap-2">
            <span className="flex-shrink-0">LOCATION</span>
            <span className="text-white/70 text-right truncate">{item.location}</span>
          </div>
        )}
        {item.calendarSource && item.calendarSource !== 'manual' && (
          <div className="flex justify-between">
            <span>SOURCE</span>
            <span className="text-white/40 text-[10px]">GCAL</span>
          </div>
        )}
      </div>

      <div className="flex gap-2 border-t border-white/10 pt-3">
        <button onClick={onDelete}
          className="flex-1 py-1.5 text-[10px] text-red-400/70 border border-red-400/20 rounded hover:bg-red-400/10 transition-colors">
          DELETE
        </button>
        <button onClick={onEdit}
          className="flex-1 py-1.5 text-[10px] border rounded transition-colors hover:bg-white/5"
          style={{ color: cat?.color, borderColor: cat?.color + '44' }}>
          EDIT
        </button>
      </div>
    </div>
  )
}

// ── Task sidebar ──────────────────────────────────────────────────────────────
function TaskSidebar({ tasks, onSelect, selected }) {
  const [open, setOpen] = useState(true)
  if (!open) return (
    <button onClick={() => setOpen(true)}
      className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-20 bg-[#0d1a0d]/80 border border-white/10 rounded-l text-[10px] text-white/30 font-mono writing-vertical flex items-center justify-center hover:text-white/60 transition-colors"
      style={{ writingMode: 'vertical-rl' }}>
      TASKS
    </button>
  )

  return (
    <div className="w-44 flex-shrink-0 flex flex-col border-l border-white/10 bg-[#080d08]/80 backdrop-blur-sm overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
        <span className="text-[10px] text-[#fbbf24] tracking-widest">TASKS</span>
        <button onClick={() => setOpen(false)} className="text-white/20 hover:text-white/50 text-xs">−</button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {tasks.length === 0 && (
          <p className="text-[10px] text-white/20 font-mono px-3 py-3 tracking-wide">NO PENDING TASKS</p>
        )}
        {tasks.map(t => {
          const cat = getCategoryById(t.category)
          const days = daysUntil(t.dueDate)
          const isSel = selected?.item?.id === t.id && selected?.type === 'task'
          return (
            <button key={t.id} onClick={() => onSelect(t)}
              className={`w-full text-left px-3 py-2.5 border-b border-white/5 text-xs font-mono transition-colors ${
                isSel ? 'bg-white/10' : 'hover:bg-white/5'
              }`}>
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="w-1.5 h-1.5 rotate-45 flex-shrink-0"
                  style={{ background: cat?.color, borderRadius: '1px' }} />
                <span className="text-white/80 truncate leading-tight">{t.title}</span>
              </div>
              <div className="text-[10px] text-white/30 pl-3">
                {days < 0 ? 'OVERDUE' : days < 1 ? 'TODAY' : `${Math.round(days)}d`}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
