import { useEffect, useRef, useState, useMemo } from 'react'
import * as d3 from 'd3'
import {
  useEvents, usePendingTasks,
  deleteEvent, deleteTask, updateEvent, updateTask,
  addEvent, addTask, toggleTask,
  expandRecurringEvents,
} from '../db/hooks'
import { CATEGORIES, getCategoryById } from '../context/AppContext'
import EventModal from '../components/EventModal'
import TaskModal from '../components/TaskModal'

// ── Time helpers ───────────────────────────────────────────────────────────────
function daysUntil(dateStr) {
  if (!dateStr) return Infinity
  const d = new Date(dateStr + (!dateStr.includes('T') ? 'T00:00:00' : ''))
  return (d - new Date()) / (1000 * 60 * 60 * 24)
}

function toRad(deg) { return (deg * Math.PI) / 180 }

// Map days-until to radius fraction using log scale against the current horizon
function timeToRadius(days, maxR, horizonDays) {
  const safeHorizon = Math.max(horizonDays, 0.01)
  const fraction = Math.log(Math.max(days, 0.001) + 1) / Math.log(safeHorizon + 1)
  return Math.min(fraction, 1.0) * maxR * 0.85 + maxR * 0.05
}

function categoryMidAngle(cat) {
  return toRad((cat.startAngle + cat.endAngle) / 2)
}

// ── Dynamic time rings ────────────────────────────────────────────────────────
function getDynamicRings(h) {
  if (h <= 0.3)  return [{l:'1H',d:1/24},{l:'2H',d:2/24},{l:'4H',d:4/24},{l:'6H',d:6/24}]
  if (h <= 0.75) return [{l:'2H',d:2/24},{l:'4H',d:4/24},{l:'8H',d:8/24},{l:'12H',d:12/24}]
  if (h <= 1.5)  return [{l:'3H',d:3/24},{l:'6H',d:6/24},{l:'12H',d:12/24},{l:'TODAY',d:1}]
  if (h <= 3.5)  return [{l:'6H',d:6/24},{l:'12H',d:12/24},{l:'1D',d:1},{l:'2D',d:2},{l:'3D',d:3}]
  if (h <= 8)    return [{l:'1D',d:1},{l:'2D',d:2},{l:'3D',d:3},{l:'5D',d:5},{l:'7D',d:7}]
  if (h <= 16)   return [{l:'2D',d:2},{l:'5D',d:5},{l:'1W',d:7},{l:'10D',d:10},{l:'2W',d:14}]
  if (h <= 35)   return [{l:'1W',d:7},{l:'2W',d:14},{l:'3W',d:21},{l:'1M',d:30}]
  if (h <= 75)   return [{l:'2W',d:14},{l:'1M',d:30},{l:'6W',d:45},{l:'2M',d:60}]
  if (h <= 120)  return [{l:'1M',d:30},{l:'6W',d:45},{l:'2M',d:60},{l:'3M',d:90}]
  if (h <= 200)  return [{l:'1M',d:30},{l:'2M',d:60},{l:'4M',d:120},{l:'6M',d:180}]
  return [{l:'2M',d:60},{l:'3M',d:90},{l:'6M',d:180},{l:'1Y',d:365}]
}

function getHorizonLabel(h) {
  if (h < 0.3)  return '6 HOURS'
  if (h < 0.6)  return '12 HOURS'
  if (h < 1.2)  return '1 DAY'
  if (h < 2.5)  return '2 DAYS'
  if (h < 4)    return `${Math.round(h)} DAYS`
  if (h < 5.5)  return '5 DAYS'
  if (h < 8.5)  return '1 WEEK'
  if (h < 12)   return '10 DAYS'
  if (h < 17)   return '2 WEEKS'
  if (h < 23)   return '3 WEEKS'
  if (h < 40)   return '1 MONTH'
  if (h < 70)   return '2 MONTHS'
  if (h < 110)  return '3 MONTHS'
  if (h < 200)  return '6 MONTHS'
  return '1 YEAR'
}

// ── Quick-add parser ──────────────────────────────────────────────────────────
const CAT_ALIASES = {
  sage: 'work', school: 'work', work: 'work',
  pd: 'professional', prof: 'professional', professional: 'professional', dev: 'professional',
  community: 'community', comm: 'community',
  personal: 'personal', me: 'personal', home: 'personal',
}
const DAY_MAP = {
  monday: 1, mon: 1, tuesday: 2, tue: 2, wednesday: 3, wed: 3,
  thursday: 4, thu: 4, friday: 5, fri: 5, saturday: 6, sat: 6, sunday: 0, sun: 0,
}

function parseQuickAdd(input) {
  if (!input.trim()) return null
  const isTask = /^t:|^task:/i.test(input)
  let raw = input.replace(/^(t:|task:|e:|event:)/i, '').trim()
  let category = 'work'
  let dateStr = new Date().toISOString().slice(0, 10)
  const titleWords = []

  for (const word of raw.split(/\s+/)) {
    const lw = word.toLowerCase()
    if (CAT_ALIASES[lw]) { category = CAT_ALIASES[lw]; continue }
    const plusMatch = lw.match(/^\+(\d+)d?$/)
    if (plusMatch) {
      const d = new Date(); d.setDate(d.getDate() + parseInt(plusMatch[1]))
      dateStr = d.toISOString().slice(0, 10); continue
    }
    if (lw in DAY_MAP) {
      const today = new Date().getDay(), target = DAY_MAP[lw]
      let diff = (target - today + 7) % 7; if (diff === 0) diff = 7
      const d = new Date(); d.setDate(d.getDate() + diff)
      dateStr = d.toISOString().slice(0, 10); continue
    }
    if (lw === 'today' || lw === 'tonight') { dateStr = new Date().toISOString().slice(0, 10); continue }
    if (lw === 'tomorrow' || lw === 'tmr') {
      const d = new Date(); d.setDate(d.getDate() + 1)
      dateStr = d.toISOString().slice(0, 10); continue
    }
    const dateMatch = lw.match(/^(\d{1,2})[\/\-](\d{1,2})$/)
    if (dateMatch) {
      const year = new Date().getFullYear()
      dateStr = `${year}-${dateMatch[1].padStart(2,'0')}-${dateMatch[2].padStart(2,'0')}`; continue
    }
    titleWords.push(word)
  }
  const title = titleWords.join(' ').trim()
  if (!title) return null
  return { isTask, title, category, dateStr }
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function RadarView() {
  const svgRef   = useRef(null)
  const sweepRef = useRef(null)
  const simRef   = useRef(null)
  const quickRef = useRef(null)

  // Zoom state — animated via rAF
  const horizonRef       = useRef(14)   // current animated value (days)
  const targetHorizonRef = useRef(14)   // scroll target
  const [horizon, setHorizon] = useState(14)

  const [size, setSize]           = useState({ w: 800, h: 600 })
  const [selected, setSelected]   = useState(null)
  const [editTarget, setEdit]     = useState(null)
  const [showEventModal, setShowEvent] = useState(false)
  const [showTaskModal,  setShowTask]  = useState(false)
  const [clickHint, setClickHint]      = useState(null)

  // Quick-add
  const [quickText, setQuickText]       = useState('')
  const [quickFocus, setQuickFocus]     = useState(false)
  const [quickPreview, setQuickPreview] = useState(null)
  const [quickSaved, setQuickSaved]     = useState(false)

  // Category filters
  const [activeCategories, setActiveCategories] = useState(
    () => new Set(CATEGORIES.map(c => c.id))
  )

  function toggleCategory(id) {
    setActiveCategories(prev => {
      const next = new Set(prev)
      if (next.has(id)) { if (next.size > 1) next.delete(id) }
      else next.add(id)
      return next
    })
  }

  // Live DB data
  const allEvents = useEvents()        || []
  const allTasks  = usePendingTasks()  || []

  // Expand recurring events within the current horizon
  const expandedEvents = useMemo(
    () => expandRecurringEvents(allEvents, Math.ceil(horizon) + 2),
    [allEvents, Math.ceil(horizon)]
  )

  const cx = size.w / 2
  const cy = size.h / 2
  const maxR = Math.min(cx, cy) * 0.88

  const dynamicRings = useMemo(() => getDynamicRings(horizon), [Math.round(horizon * 10) / 10])

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

  // ── Combined rAF: sweep animation + zoom lerp ─────────────────────────────
  useEffect(() => {
    let sweepAngle = 0
    function tick() {
      // Radar sweep
      sweepAngle = (sweepAngle + 0.35) % 360
      const sw = svgRef.current?.querySelector('#sweep-group')
      if (sw) sw.setAttribute('transform', `rotate(${sweepAngle},${cx},${cy})`)

      // Smooth zoom lerp
      const cur = horizonRef.current
      const tgt = targetHorizonRef.current
      if (Math.abs((tgt - cur) / Math.max(tgt, 0.01)) > 0.003) {
        const next = cur + (tgt - cur) * 0.1
        horizonRef.current = next
        setHorizon(next)
      }

      sweepRef.current = requestAnimationFrame(tick)
    }
    sweepRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(sweepRef.current)
  }, [cx, cy])

  // ── Mouse wheel zoom ──────────────────────────────────────────────────────
  useEffect(() => {
    const el = svgRef.current?.parentElement
    if (!el) return
    const onWheel = e => {
      e.preventDefault()
      const factor = e.deltaY > 0 ? 1.2 : (1 / 1.2)
      targetHorizonRef.current = Math.min(365, Math.max(0.25, targetHorizonRef.current * factor))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  // ── Quick-add keyboard shortcut ───────────────────────────────────────────
  useEffect(() => {
    function onKey(e) {
      if (e.key === '/' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
        e.preventDefault(); quickRef.current?.focus()
      }
      if (e.key === 'Escape') {
        setQuickFocus(false); setQuickText(''); setQuickPreview(null); quickRef.current?.blur()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => { setQuickPreview(parseQuickAdd(quickText)) }, [quickText])

  async function handleQuickSubmit(e) {
    e.preventDefault()
    if (!quickPreview) return
    const { isTask, title, category, dateStr } = quickPreview
    if (isTask) {
      await addTask({ title, category, dueDate: dateStr, importance: 3, completed: false, createdAt: new Date().toISOString() })
    } else {
      await addEvent({ title, category, start: dateStr, end: dateStr, allDay: true, importance: 3, calendarSource: 'manual', gcalId: null })
    }
    setQuickText(''); setQuickPreview(null)
    setQuickSaved(true); setTimeout(() => setQuickSaved(false), 1500)
  }

  // ── Blip nodes from visible events + tasks ────────────────────────────────
  const visibleEvents = useMemo(() =>
    expandedEvents.filter(e => {
      if (!activeCategories.has(e.category)) return false
      if (e.allDay) return true // all-day rendered as tick
      const d = daysUntil(e.start)
      return d >= -0.5 && d <= horizon + 0.1
    }), [expandedEvents, activeCategories, Math.ceil(horizon)]
  )

  const visibleAllDay = useMemo(() =>
    expandedEvents.filter(e =>
      e.allDay && activeCategories.has(e.category) &&
      daysUntil(e.start) >= -0.5 && daysUntil(e.start) <= horizon + 0.1
    ), [expandedEvents, activeCategories, Math.ceil(horizon)]
  )

  const visibleTasks = useMemo(() =>
    allTasks.filter(t =>
      t.dueDate && activeCategories.has(t.category) &&
      daysUntil(t.dueDate) >= -0.5 && daysUntil(t.dueDate) <= horizon + 0.1
    ), [allTasks, activeCategories, Math.ceil(horizon)]
  )

  const blipNodes = useMemo(() => {
    if (!maxR || maxR <= 0) return []
    const nodes = []

    visibleEvents.filter(e => !e.allDay).forEach(e => {
      const cat = getCategoryById(e.category)
      if (!cat) return
      const d   = daysUntil(e.start)
      const r   = timeToRadius(d, maxR, horizon)
      const ang = categoryMidAngle(cat)
      nodes.push({
        id: `e-${e.id}`, item: e, itemType: 'event',
        targetR: r, targetAng: ang,
        x: cx + r * Math.cos(ang), y: cy + r * Math.sin(ang),
        radius: 4 + (e.importance || 3) * 1.5,
        color: cat.color,
        isRecurrence: !!e.isRecurrence,
      })
    })

    visibleTasks.forEach(t => {
      const cat = getCategoryById(t.category)
      if (!cat) return
      const d   = daysUntil(t.dueDate)
      const r   = timeToRadius(d, maxR, horizon)
      const ang = categoryMidAngle(cat)
      nodes.push({
        id: `t-${t.id}`, item: t, itemType: 'task',
        targetR: r, targetAng: ang,
        x: cx + r * Math.cos(ang) + 15, y: cy + r * Math.sin(ang) + 15,
        radius: 4 + (t.importance || 3) * 1.2,
        color: cat.color,
        isRecurrence: false,
      })
    })
    return nodes
  }, [visibleEvents, visibleTasks, cx, cy, maxR, Math.round(horizon * 4) / 4])

  // ── D3 force simulation ───────────────────────────────────────────────────
  useEffect(() => {
    if (!blipNodes.length || maxR <= 0) return
    if (simRef.current) simRef.current.stop()
    simRef.current = d3.forceSimulation(blipNodes)
      .alphaDecay(0.06)
      .force('collide', d3.forceCollide(d => d.radius + 3).strength(0.85))
      .force('radial', d3.forceRadial(d => d.targetR, cx, cy).strength(0.7))
      .force('angle', {
        initialize(nodes) { this._nodes = nodes },
        force(alpha) {
          for (const n of this._nodes) {
            const cat = getCategoryById(n.item.category)
            if (!cat) continue
            const dx = n.x - cx, dy = n.y - cy
            const ang = Math.atan2(dy, dx) * 180 / Math.PI
            const lo = cat.startAngle, hi = cat.endAngle
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

  // ── Heat map: how many blips near each ring ───────────────────────────────
  const heatMap = useMemo(() => {
    const map = {}
    for (const ring of dynamicRings) {
      const lo = ring.d * 0.6, hi = ring.d * 1.5
      map[ring.l] = blipNodes.filter(n => {
        const d = daysUntil(n.item.start || n.item.dueDate)
        return d >= lo && d <= hi
      }).length
    }
    return map
  }, [blipNodes, dynamicRings])

  // ── Arc for wedge paths ───────────────────────────────────────────────────
  const arc = d3.arc()
  function wedgePath(cat) {
    return arc({
      innerRadius: 0, outerRadius: maxR,
      startAngle: toRad(cat.startAngle), endAngle: toRad(cat.endAngle),
    })
  }

  // ── Radar click ───────────────────────────────────────────────────────────
  function handleRadarClick(e) {
    if (quickFocus) return
    const rect = svgRef.current.getBoundingClientRect()
    const dx = e.clientX - rect.left - cx
    const dy = e.clientY - rect.top  - cy
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist > maxR || dist < 10) return
    const angleDeg = Math.atan2(dy, dx) * 180 / Math.PI
    const cat = CATEGORIES.find(c => angleDeg >= c.startAngle && angleDeg < c.endAngle)
    const fraction = Math.max(0, (dist - maxR * 0.05) / (maxR * 0.85))
    // Invert the log scale: days = 10^(fraction * log10(horizon+1)) - 1
    const days = Math.round(Math.pow(horizon + 1, fraction) - 1)
    const date = new Date(); date.setDate(date.getDate() + days)
    setClickHint({ category: cat?.id || 'work', date: date.toISOString().slice(0, 10) })
    setShowEvent(true)
  }

  async function handleDelete() {
    if (!selected) return
    const baseId = selected.item._baseId || selected.item.id
    if (selected.type === 'event') await deleteEvent(baseId)
    else await deleteTask(selected.item.id)
    setSelected(null)
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="relative w-full h-full flex flex-col overflow-hidden bg-[#0a0f0a]">

      {/* ── Quick-add bar ── */}
      <form onSubmit={handleQuickSubmit}
        className={`relative z-30 flex items-center gap-2 px-4 py-2 border-b transition-colors ${
          quickFocus ? 'bg-[#0d1a0d] border-[#00ff4133]' : 'bg-[#080d08]/60 border-white/5'
        }`}>
        <span className="text-[10px] text-white/25 font-mono tracking-widest flex-shrink-0 hidden sm:block">
          {quickFocus ? '/' : 'PRESS /'}
        </span>
        <div className="flex-1 relative">
          <input
            ref={quickRef}
            value={quickText}
            onChange={e => setQuickText(e.target.value)}
            onFocus={() => setQuickFocus(true)}
            onBlur={() => { if (!quickText) setQuickFocus(false) }}
            placeholder='Quick add: "Board meeting Friday sage" or "t: Report +3d work"'
            className="w-full bg-transparent text-sm text-white font-mono outline-none placeholder-white/15"
          />
          {quickPreview && (
            <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center gap-1.5 pointer-events-none">
              <span className={`text-[9px] font-mono tracking-widest px-1.5 py-0.5 rounded ${
                quickPreview.isTask ? 'bg-[#fbbf2420] text-[#fbbf24]' : 'bg-[#00ff4120] text-[#00ff41]'
              }`}>{quickPreview.isTask ? '◇ TASK' : '● EVENT'}</span>
              <span className="text-[9px] font-mono text-white/30">{getCategoryById(quickPreview.category)?.label}</span>
              <span className="text-[9px] font-mono text-white/30">{quickPreview.dateStr}</span>
            </div>
          )}
        </div>
        {quickSaved && <span className="text-[10px] font-mono text-[#00ff41] animate-pulse">SAVED ✓</span>}
        {quickText && (
          <button type="submit" disabled={!quickPreview}
            className="flex-shrink-0 px-3 py-1 text-[10px] font-mono tracking-widest border border-[#00ff4133] text-[#00ff41] rounded hover:bg-[#00ff4115] disabled:opacity-30 transition-colors">
            ADD
          </button>
        )}
      </form>

      {/* ── Main area ── */}
      <div className="flex-1 flex overflow-hidden scanlines no-select">

        {/* ── SVG Radar ── */}
        <div className="flex-1 relative" onClick={handleRadarClick}>
          <svg ref={svgRef} className="absolute inset-0" style={{ width: '100%', height: '100%' }} width={size.w} height={size.h}>
            <defs>
              <linearGradient id="sweepGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%"   stopColor="#00ff41" stopOpacity="0" />
                <stop offset="100%" stopColor="#00ff41" stopOpacity="0.28" />
              </linearGradient>
              <radialGradient id="radarFade" cx="50%" cy="50%" r="50%">
                <stop offset="60%"  stopColor="#0a0f0a" stopOpacity="0" />
                <stop offset="100%" stopColor="#0a0f0a" stopOpacity="0.55" />
              </radialGradient>
              <clipPath id="radarClip"><circle cx={cx} cy={cy} r={maxR} /></clipPath>
              <filter id="blipGlow" x="-70%" y="-70%" width="240%" height="240%">
                <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur" />
                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
              <filter id="blipGlowSel" x="-70%" y="-70%" width="240%" height="240%">
                <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="blur" />
                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
            </defs>

            {/* Background disk */}
            <circle cx={cx} cy={cy} r={maxR + 1} fill="#040a04" stroke="#00ff4120" strokeWidth="1" />

            {/* Wedge fills */}
            <g transform={`translate(${cx},${cy})`}>
              {CATEGORIES.map(cat => (
                <path key={cat.id} d={wedgePath(cat)} fill={cat.color}
                  opacity={activeCategories.has(cat.id) ? 0.05 : 0.01}
                  clipPath="url(#radarClip)" />
              ))}
            </g>

            {/* Divider lines */}
            {CATEGORIES.map(cat => {
              const r = toRad(cat.startAngle)
              return <line key={cat.id} x1={cx} y1={cy}
                x2={cx + maxR * Math.cos(r)} y2={cy + maxR * Math.sin(r)}
                stroke="#00ff4122" strokeWidth="1" strokeDasharray="5 5" />
            })}

            {/* Category labels */}
            {CATEGORIES.map(cat => {
              const mid = toRad((cat.startAngle + cat.endAngle) / 2)
              const lr  = maxR * 0.93
              return (
                <text key={cat.id} x={cx + lr * Math.cos(mid)} y={cy + lr * Math.sin(mid)}
                  fill={cat.color} opacity={activeCategories.has(cat.id) ? 0.5 : 0.12}
                  fontSize="9" fontFamily="JetBrains Mono, monospace" fontWeight="600"
                  letterSpacing="2" textAnchor="middle" dominantBaseline="middle">
                  {cat.label}
                </text>
              )
            })}

            {/* ── Dynamic time rings with heat tinting ── */}
            {dynamicRings.map(ring => {
              const r    = timeToRadius(ring.d, maxR, horizon)
              const heat = heatMap[ring.l] || 0
              // Heat: 0 events = dim green, 1-2 = medium, 3+ = warm amber
              const ringColor = heat === 0 ? '#00ff41'
                : heat <= 2 ? '#80ff80'
                : heat <= 4 ? '#ffcc44'
                : '#ff6644'
              const ringOpacity = heat === 0 ? 0.12 : Math.min(0.12 + heat * 0.08, 0.5)
              const isToday = ring.l === 'TODAY' || (ring.d === 1 && horizon <= 2)
              return (
                <g key={ring.l}>
                  <circle cx={cx} cy={cy} r={r} fill="none"
                    stroke={ringColor}
                    strokeWidth={isToday ? 1.5 : 1}
                    strokeOpacity={isToday ? Math.max(ringOpacity, 0.3) : ringOpacity}
                  />
                  {/* Heat glow for busy rings */}
                  {heat >= 2 && (
                    <circle cx={cx} cy={cy} r={r} fill="none"
                      stroke={ringColor} strokeWidth={6} strokeOpacity={0.04} />
                  )}
                  <text
                    x={cx + r * Math.cos(toRad(-82))}
                    y={cy + r * Math.sin(toRad(-82)) - 4}
                    fill={ringColor}
                    fillOpacity={isToday ? 0.55 : Math.min(0.25 + heat * 0.08, 0.6)}
                    fontSize="8" fontFamily="JetBrains Mono, monospace"
                    letterSpacing="1.5" textAnchor="middle">
                    {ring.l}
                  </text>
                </g>
              )
            })}

            {/* Cross hairs */}
            <line x1={cx - maxR} y1={cy} x2={cx + maxR} y2={cy} stroke="#00ff400e" strokeWidth="1" />
            <line x1={cx} y1={cy - maxR} x2={cx} y2={cy + maxR} stroke="#00ff400e" strokeWidth="1" />

            {/* Sweep */}
            <g id="sweep-group">
              <path
                d={`M ${cx} ${cy} L ${cx + maxR} ${cy} A ${maxR} ${maxR} 0 0 0 ${cx + maxR * Math.cos(toRad(-55))} ${cy + maxR * Math.sin(toRad(-55))} Z`}
                fill="url(#sweepGrad)" opacity="0.8" clipPath="url(#radarClip)"
              />
              <line x1={cx} y1={cy} x2={cx + maxR} y2={cy}
                stroke="#00ff41" strokeWidth="1.5" opacity="0.65" />
            </g>

            {/* Edge fade */}
            <circle cx={cx} cy={cy} r={maxR} fill="url(#radarFade)" pointerEvents="none" />

            {/* ── Blips ── */}
            {blipNodes.map(n => {
              const isSel = selected?.item?.id === n.item.id && selected?.type === n.itemType
              const isRec = n.isRecurrence
              return (
                <g key={n.id} data-blip={n.id}
                  transform={`translate(${n.x},${n.y})`}
                  onClick={e => { e.stopPropagation(); setSelected(isSel ? null : { item: n.item, type: n.itemType }) }}
                  style={{ cursor: 'pointer' }}
                  filter={isSel ? 'url(#blipGlowSel)' : 'url(#blipGlow)'}
                >
                  {/* Pulse ring — dashed for recurrences */}
                  <circle r={n.radius + 6} fill="none" stroke={n.color}
                    strokeWidth="1"
                    strokeDasharray={isRec ? '3 3' : undefined}
                    opacity={isSel ? 0.7 : 0.18} />

                  {n.itemType === 'event' ? (
                    <circle r={n.radius} fill={n.color} opacity={isRec ? 0.55 : (isSel ? 1 : 0.88)} />
                  ) : (
                    <polygon
                      points={`0,${-n.radius} ${n.radius},0 0,${n.radius} ${-n.radius},0`}
                      fill={n.color} opacity={isSel ? 1 : 0.82} />
                  )}

                  {/* Recurrence indicator: small ↻ dot */}
                  {isRec && (
                    <circle r={2} cx={n.radius - 1} cy={-(n.radius - 1)}
                      fill={n.color} opacity={0.9} />
                  )}

                  <circle r={2.5} fill="#040a04" />
                </g>
              )
            })}

            {/* Center dot */}
            <circle cx={cx} cy={cy} r={5} fill="#00ff41" opacity="0.9" />
            <circle cx={cx} cy={cy} r={2} fill="#040a04" />

            {/* All-day ticks on outer ring */}
            {visibleAllDay.map(e => {
              const cat = getCategoryById(e.category)
              if (!cat) return null
              const d = daysUntil(e.start)
              if (d < 0 || d > horizon + 0.1) return null
              // Position the tick at the ring corresponding to the event's date
              const r1 = maxR - 8, r2 = maxR - 1
              const mid = toRad((cat.startAngle + cat.endAngle) / 2)
              return (
                <line key={`allday-${e.id}`}
                  x1={cx + r1 * Math.cos(mid)} y1={cy + r1 * Math.sin(mid)}
                  x2={cx + r2 * Math.cos(mid)} y2={cy + r2 * Math.sin(mid)}
                  stroke={cat.color} strokeWidth={e.isRecurrence ? 1 : 2}
                  strokeDasharray={e.isRecurrence ? '2 2' : undefined}
                  opacity={e.isRecurrence ? 0.35 : 0.6} />
              )
            })}
          </svg>

          {/* ── Zoom indicator (top-right) ── */}
          <div className="absolute top-3 right-3 pointer-events-none">
            <div className="flex items-center gap-2 bg-[#040a04]/80 border border-white/8 rounded px-2.5 py-1.5">
              <span className="text-[9px] text-white/25 font-mono tracking-widest">VIEW</span>
              <span className="text-[11px] text-[#00ff41]/70 font-mono tracking-widest font-semibold">
                {getHorizonLabel(horizon)}
              </span>
            </div>
            <p className="text-[8px] text-white/12 font-mono text-center mt-1 tracking-wide">SCROLL TO ZOOM</p>
          </div>

          {/* Hint */}
          {!quickFocus && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-[10px] font-mono text-white/12 tracking-widest pointer-events-none">
              CLICK RADAR TO ADD  ·  PRESS / TO QUICK-ADD
            </div>
          )}
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

        {/* ── Task sidebar ── */}
        <TaskSidebar
          tasks={allTasks.filter(t => activeCategories.has(t.category))}
          onSelect={t => setSelected({ item: t, type: 'task' })}
          selected={selected}
        />
      </div>

      {/* ── Bottom bar: legend + add buttons ── */}
      <div className="relative z-20 flex items-center justify-between px-4 py-2 bg-[#080d08]/80 border-t border-white/5">
        <div className="flex items-center gap-3 flex-wrap">
          {CATEGORIES.map(cat => {
            const isActive = activeCategories.has(cat.id)
            return (
              <button key={cat.id} onClick={() => toggleCategory(cat.id)}
                className="flex items-center gap-1.5 font-mono text-[10px] transition-opacity"
                style={{ opacity: isActive ? 1 : 0.28 }}
                title={isActive ? `Hide ${cat.label}` : `Show ${cat.label}`}>
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: cat.color }} />
                <span style={{ color: isActive ? cat.color : 'rgba(255,255,255,0.3)' }}>{cat.label}</span>
              </button>
            )
          })}
          <span className="text-[9px] text-white/15 font-mono ml-1">● EVENT  ◇ TASK  ↻ RECURRING</span>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button onClick={e => { e.stopPropagation(); setClickHint(null); setShowTask(true) }}
            className="px-3 py-1.5 bg-[#0d1a0d]/90 border border-[#fbbf2433] text-[#fbbf24] text-[10px] font-mono tracking-widest rounded hover:bg-[#fbbf2415] transition-colors">
            + TASK
          </button>
          <button onClick={e => { e.stopPropagation(); setClickHint(null); setShowEvent(true) }}
            className="px-3 py-1.5 bg-[#0d1a0d]/90 border border-[#00ff4133] text-[#00ff41] text-[10px] font-mono tracking-widest rounded hover:bg-[#00ff4115] transition-colors">
            + EVENT
          </button>
        </div>
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
    <div className="absolute right-4 top-12 w-64 bg-[#0a140a]/95 border rounded-xl p-4 font-mono text-sm shadow-2xl z-20 backdrop-blur-sm"
      style={{ borderColor: cat?.color + '44' }}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] tracking-widest" style={{ color: cat?.color }}>
          {type === 'task' ? '◇ TASK' : '● EVENT'}
          {item.recurrenceType && item.recurrenceType !== 'none' && (
            <span className="ml-2 opacity-60">↻ {item.recurrenceType}</span>
          )}
        </span>
        <button onClick={onClose} className="text-white/30 hover:text-white text-xl leading-none">×</button>
      </div>

      <p className="text-white font-medium mb-3 leading-snug">{item.title}</p>

      <div className="space-y-1.5 text-xs text-white/50 mb-4">
        <div className="flex justify-between">
          <span>CATEGORY</span><span style={{ color: cat?.color }}>{cat?.label}</span>
        </div>
        <div className="flex justify-between">
          <span>DATE</span>
          <span className="text-white/70">
            {new Date(dateStr + (!dateStr.includes('T') ? 'T12:00:00' : '')).toLocaleDateString('en-US', {
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
            <span>SOURCE</span><span className="text-white/40 text-[10px]">GCAL</span>
          </div>
        )}
        {item.isRecurrence && (
          <div className="text-[10px] text-white/30 pt-1 border-t border-white/5">
            ↻ Recurring occurrence — edit the original event to change all
          </div>
        )}
      </div>

      <div className="flex gap-2 border-t border-white/10 pt-3">
        <button onClick={onDelete}
          className="flex-1 py-1.5 text-[10px] text-red-400/70 border border-red-400/20 rounded hover:bg-red-400/10 transition-colors">
          {item.isRecurrence ? 'DEL SERIES' : 'DELETE'}
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
  const overdue  = tasks.filter(t => daysUntil(t.dueDate) < 0)
  const upcoming = tasks.filter(t => daysUntil(t.dueDate) >= 0)

  if (!open) return (
    <button onClick={() => setOpen(true)}
      className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-20 bg-[#0d1a0d]/80 border border-white/10 rounded-l text-[10px] text-white/30 font-mono flex items-center justify-center hover:text-white/60 transition-colors"
      style={{ writingMode: 'vertical-rl' }}>
      TASKS
    </button>
  )

  return (
    <div className="w-44 flex-shrink-0 flex flex-col border-l border-white/10 bg-[#080d08]/80 backdrop-blur-sm overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-[#fbbf24] tracking-widest">TASKS</span>
          {overdue.length > 0 && (
            <span className="text-[9px] text-red-400 font-mono">{overdue.length} LATE</span>
          )}
        </div>
        <button onClick={() => setOpen(false)} className="text-white/20 hover:text-white/50 text-xs">−</button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {tasks.length === 0 && (
          <p className="text-[10px] text-white/20 font-mono px-3 py-3 tracking-wide">NO PENDING TASKS</p>
        )}
        {overdue.length > 0 && (
          <>
            <div className="px-3 py-1 text-[9px] text-red-400/60 tracking-widest font-mono border-b border-red-400/10">OVERDUE</div>
            {overdue.map(t => <TaskRow key={t.id} task={t} onSelect={onSelect} selected={selected} isOverdue />)}
          </>
        )}
        {upcoming.map(t => <TaskRow key={t.id} task={t} onSelect={onSelect} selected={selected} />)}
      </div>
    </div>
  )
}

function TaskRow({ task: t, onSelect, selected, isOverdue }) {
  const cat  = getCategoryById(t.category)
  const days = daysUntil(t.dueDate)
  const isSel = selected?.item?.id === t.id && selected?.type === 'task'

  return (
    <div className={`w-full text-left px-3 py-2.5 border-b transition-colors ${
      isOverdue ? 'border-red-400/10' : 'border-white/5'
    } ${isSel ? 'bg-white/10' : 'hover:bg-white/5'}`}>
      <div className="flex items-start gap-1.5">
        <button
          onClick={async e => { e.stopPropagation(); await toggleTask(t.id) }}
          className="mt-0.5 w-3.5 h-3.5 flex-shrink-0 border rounded-sm flex items-center justify-center hover:border-white/50 transition-colors"
          style={{ borderColor: cat?.color + '66' }} title="Mark complete">
          <span className="text-[8px]" style={{ color: cat?.color }}>✓</span>
        </button>
        <button onClick={() => onSelect(t)} className="flex-1 text-left min-w-0">
          <div className="flex items-center gap-1 mb-0.5">
            <span className="w-1.5 h-1.5 rotate-45 flex-shrink-0" style={{ background: cat?.color, borderRadius: '1px' }} />
            <span className={`text-xs font-mono truncate leading-tight ${isOverdue ? 'text-red-300/80' : 'text-white/80'}`}>{t.title}</span>
          </div>
          <div className={`text-[10px] pl-3 font-mono ${isOverdue ? 'text-red-400/60' : 'text-white/30'}`}>
            {days < 0 ? `${Math.abs(Math.round(days))}d AGO` : days < 1 ? 'TODAY' : `${Math.round(days)}d`}
          </div>
        </button>
      </div>
    </div>
  )
}
