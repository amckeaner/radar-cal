import { useEffect, useRef, useState, useMemo } from 'react'
import * as d3 from 'd3'
import {
  useEvents, usePendingTasks,
  deleteEvent, deleteTask,
  addEvent, addTask, toggleTask,
  expandRecurringEvents,
} from '../db/hooks'
import { CATEGORIES, getCategoryById } from '../context/AppContext'
import EventModal    from '../components/EventModal'
import TaskModal     from '../components/TaskModal'
import PriorityList  from '../components/PriorityList'

// ── Helpers ───────────────────────────────────────────────────────────────────
function daysUntil(dateStr) {
  if (!dateStr) return Infinity
  const d = new Date(dateStr + (!dateStr.includes('T') ? 'T00:00:00' : ''))
  return (d - new Date()) / (1000 * 60 * 60 * 24)
}
function toRad(deg) { return (deg * Math.PI) / 180 }

function timeToRadius(days, maxR, horizonDays) {
  const frac = Math.log(Math.max(days, 0.001) + 1) / Math.log(Math.max(horizonDays, 0.01) + 1)
  return Math.min(frac, 1.0) * maxR * 0.85 + maxR * 0.05
}
function categoryMidAngle(cat) { return toRad((cat.startAngle + cat.endAngle) / 2) }

// ── Zoom levels ───────────────────────────────────────────────────────────────
const ZOOM_LEVELS = [
  { label: '1Y',  days: 365  },
  { label: '6M',  days: 180  },
  { label: '3M',  days: 90   },
  { label: '1M',  days: 30   },
  { label: '2W',  days: 14   },
  { label: '1W',  days: 7    },
  { label: '5D',  days: 5    },
  { label: '2D',  days: 2    },
  { label: '1D',  days: 1    },
  { label: '12H', days: 0.5  },
  { label: '6H',  days: 0.25 },
]

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

function getDynamicRings(h) {
  if (h <= 0.3)  return [{l:'1H',d:1/24},{l:'2H',d:2/24},{l:'4H',d:4/24},{l:'6H',d:6/24}]
  if (h <= 0.75) return [{l:'2H',d:2/24},{l:'4H',d:4/24},{l:'8H',d:8/24},{l:'12H',d:12/24}]
  if (h <= 1.5)  return [{l:'3H',d:3/24},{l:'6H',d:6/24},{l:'12H',d:12/24},{l:'24H',d:1}]
  if (h <= 3.5)  return [{l:'12H',d:12/24},{l:'1D',d:1},{l:'2D',d:2},{l:'3D',d:3}]
  if (h <= 8)    return [{l:'1D',d:1},{l:'2D',d:2},{l:'4D',d:4},{l:'7D',d:7}]
  if (h <= 16)   return [{l:'2D',d:2},{l:'5D',d:5},{l:'1W',d:7},{l:'2W',d:14}]
  if (h <= 35)   return [{l:'1W',d:7},{l:'2W',d:14},{l:'3W',d:21},{l:'1M',d:30}]
  if (h <= 75)   return [{l:'2W',d:14},{l:'1M',d:30},{l:'6W',d:45},{l:'2M',d:60}]
  if (h <= 120)  return [{l:'1M',d:30},{l:'2M',d:60},{l:'3M',d:90}]
  if (h <= 200)  return [{l:'1M',d:30},{l:'2M',d:60},{l:'4M',d:120},{l:'6M',d:180}]
  return [{l:'2M',d:60},{l:'3M',d:90},{l:'6M',d:180},{l:'1Y',d:365}]
}

// ── Quick-add parser ──────────────────────────────────────────────────────────
const CAT_ALIASES = {
  sage:'work', school:'work', work:'work',
  pd:'professional', prof:'professional', professional:'professional', dev:'professional',
  community:'community', comm:'community',
  personal:'personal', me:'personal', home:'personal',
}
const DAY_MAP = {
  monday:1, mon:1, tuesday:2, tue:2, wednesday:3, wed:3,
  thursday:4, thu:4, friday:5, fri:5, saturday:6, sat:6, sunday:0, sun:0,
}
function parseQuickAdd(input) {
  if (!input.trim()) return null
  const isTask = /^t:|^task:/i.test(input)
  let raw = input.replace(/^(t:|task:|e:|event:)/i, '').trim()
  let category = 'work', dateStr = new Date().toISOString().slice(0,10)
  const titleWords = []
  for (const word of raw.split(/\s+/)) {
    const lw = word.toLowerCase()
    if (CAT_ALIASES[lw])  { category = CAT_ALIASES[lw]; continue }
    const pm = lw.match(/^\+(\d+)d?$/)
    if (pm) { const d=new Date(); d.setDate(d.getDate()+parseInt(pm[1])); dateStr=d.toISOString().slice(0,10); continue }
    if (lw in DAY_MAP) {
      const today=new Date().getDay(), t=DAY_MAP[lw]; let diff=(t-today+7)%7; if(diff===0)diff=7
      const d=new Date(); d.setDate(d.getDate()+diff); dateStr=d.toISOString().slice(0,10); continue
    }
    if (lw==='today'||lw==='tonight') { dateStr=new Date().toISOString().slice(0,10); continue }
    if (lw==='tomorrow'||lw==='tmr') { const d=new Date(); d.setDate(d.getDate()+1); dateStr=d.toISOString().slice(0,10); continue }
    const dm = lw.match(/^(\d{1,2})[\/\-](\d{1,2})$/)
    if (dm) { dateStr=`${new Date().getFullYear()}-${dm[1].padStart(2,'0')}-${dm[2].padStart(2,'0')}`; continue }
    titleWords.push(word)
  }
  const title = titleWords.join(' ').trim()
  if (!title) return null
  return { isTask, title, category, dateStr }
}

// ── ZoomBar component ─────────────────────────────────────────────────────────
function ZoomBar({ horizon, onZoom }) {
  const activeLabel = ZOOM_LEVELS.reduce((a, b) =>
    Math.abs(Math.log(b.days) - Math.log(horizon)) < Math.abs(Math.log(a.days) - Math.log(horizon)) ? b : a
  ).label

  return (
    <div className="w-11 flex-shrink-0 flex flex-col border-r border-white/5 bg-[#060d06]/70 select-none">
      <div className="text-[7px] text-white/15 tracking-widest text-center py-1.5 border-b border-white/5">
        ZOOM
      </div>
      <div className="flex-1 flex flex-col justify-around py-1">
        {ZOOM_LEVELS.map(level => {
          const isActive = level.label === activeLabel
          return (
            <button
              key={level.label}
              onClick={() => onZoom(level.days)}
              className={`w-full py-0.5 text-center text-[9px] font-mono tracking-wide transition-all ${
                isActive
                  ? 'text-[#00ff41] bg-[#00ff4118] font-semibold'
                  : 'text-white/18 hover:text-white/55 hover:bg-white/4'
              }`}
              title={`Zoom to ${level.label}`}
            >
              {level.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function RadarView() {
  const svgRef   = useRef(null)
  const sweepRef = useRef(null)
  const simRef   = useRef(null)
  const quickRef = useRef(null)

  // Zoom — animated via rAF; refs let the mount-once rAF loop read latest values
  const horizonRef       = useRef(14)
  const targetHorizonRef = useRef(14)
  const maxRRef          = useRef(0)
  const cxRef            = useRef(0)
  const cyRef            = useRef(0)
  const blipNodesRef     = useRef([])

  const [horizon,  setHorizon]  = useState(14)
  const [size,     setSize]     = useState({ w: 800, h: 600 })
  const [selected, setSelected] = useState(null)
  const [editTarget, setEdit]   = useState(null)
  const [showEventModal, setShowEvent] = useState(false)
  const [showTaskModal,  setShowTask]  = useState(false)
  const [clickHint,   setClickHint]   = useState(null)
  const [showPriority, setShowPriority] = useState(false)

  // Quick-add
  const [quickText,    setQuickText]    = useState('')
  const [quickFocus,   setQuickFocus]   = useState(false)
  const [quickPreview, setQuickPreview] = useState(null)
  const [quickSaved,   setQuickSaved]   = useState(false)

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

  // DB
  const allEvents = useEvents()       || []
  const allTasks  = usePendingTasks() || []

  const expandedEvents = useMemo(
    () => expandRecurringEvents(allEvents, Math.ceil(horizon) + 2),
    [allEvents, Math.ceil(horizon)]
  )

  const cx   = size.w / 2
  const cy   = size.h / 2
  const maxR = Math.min(cx, cy) * 0.88

  // Keep refs in sync
  useEffect(() => { cxRef.current = cx },   [cx])
  useEffect(() => { cyRef.current = cy },   [cy])
  useEffect(() => { maxRRef.current = maxR }, [maxR])

  const dynamicRings = useMemo(() => getDynamicRings(horizon), [Math.round(horizon * 10) / 10])

  // ── Responsive sizing ────────────────────────────────────────────────────────
  useEffect(() => {
    const el = svgRef.current?.parentElement
    if (!el) return
    const obs = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }))
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  // ── Mount-once rAF loop: sweep + smooth zoom ──────────────────────────────
  useEffect(() => {
    let sweepAngle = 0
    function tick() {
      const bx = cxRef.current, by = cyRef.current, mx = maxRRef.current

      // Sweep
      sweepAngle = (sweepAngle + 0.35) % 360
      const sw = svgRef.current?.querySelector('#sweep-group')
      if (sw) sw.setAttribute('transform', `rotate(${sweepAngle},${bx},${by})`)

      // Zoom lerp
      const cur = horizonRef.current, tgt = targetHorizonRef.current
      const rel = Math.abs((tgt - cur) / Math.max(tgt, 0.01))
      if (rel > 0.003) {
        const next = cur + (tgt - cur) * 0.07  // ← slower lerp = smoother feel
        horizonRef.current = next
        setHorizon(next)

        // Directly reposition blips during zoom (bypasses simulation lag)
        blipNodesRef.current.forEach(n => {
          const g = svgRef.current?.querySelector(`[data-blip="${n.id}"]`)
          if (!g) return
          const d = daysUntil(n.item.start || n.item.dueDate)
          const r = timeToRadius(d, mx, next)
          const x = bx + r * Math.cos(n.targetAng)
          const y = by + r * Math.sin(n.targetAng)
          g.setAttribute('transform', `translate(${x},${y})`)
          const inner = g.querySelector('[data-blip-inner]')
          if (inner) {
            const ang = Math.atan2(y - by, x - bx) * 180 / Math.PI
            inner.setAttribute('transform', `rotate(${ang})`)
            // Also scale the ellipse rx dynamically
            const hourPx = (mx * 0.85) / (next * 24)
            const durPx  = Math.max(4, Math.min(48, n.durationHours * hourPx))
            const el = inner.querySelector('ellipse')
            if (el) el.setAttribute('rx', durPx)
            const poly = inner.querySelector('polygon')
            if (poly) poly.setAttribute('points',
              `${durPx},0 0,${n.impPx} ${-durPx},0 0,${-n.impPx}`)
          }
        })
      }

      sweepRef.current = requestAnimationFrame(tick)
    }
    sweepRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(sweepRef.current)
  }, [])  // mount-once; reads all values via refs

  // ── Mouse wheel zoom (reduced sensitivity) ────────────────────────────────
  useEffect(() => {
    const el = svgRef.current?.parentElement
    if (!el) return
    const onWheel = e => {
      e.preventDefault()
      // Normalise delta across trackpads (high dpi) and mice (step = ~100)
      const norm = Math.sign(e.deltaY) * Math.min(Math.abs(e.deltaY), 120) / 120
      // Each full "tick" changes horizon by ~15%
      const factor = Math.pow(1.15, norm)
      targetHorizonRef.current = Math.min(365, Math.max(0.25, targetHorizonRef.current * factor))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    function onKey(e) {
      const tag = document.activeElement.tagName
      if (e.key === '/' && tag !== 'INPUT' && tag !== 'TEXTAREA') {
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
    e.preventDefault(); if (!quickPreview) return
    const { isTask, title, category, dateStr } = quickPreview
    if (isTask) await addTask({ title, category, dueDate: dateStr, importance: 3, estimatedHours: 1, completed: false, createdAt: new Date().toISOString() })
    else await addEvent({ title, category, start: dateStr, end: dateStr, allDay: true, importance: 3, estimatedHours: 1, calendarSource: 'manual', gcalId: null })
    setQuickText(''); setQuickPreview(null)
    setQuickSaved(true); setTimeout(() => setQuickSaved(false), 1500)
  }

  // ── Blip nodes ────────────────────────────────────────────────────────────
  const visibleEvents = useMemo(() =>
    expandedEvents.filter(e =>
      !e.allDay && activeCategories.has(e.category) &&
      daysUntil(e.start) >= -0.5 && daysUntil(e.start) <= horizon + 0.1
    ), [expandedEvents, activeCategories, Math.ceil(horizon)]
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
    const hourPx = (maxR * 0.85) / (horizon * 24)
    const nodes  = []

    visibleEvents.forEach(e => {
      const cat = getCategoryById(e.category); if (!cat) return
      const d   = daysUntil(e.start)
      const r   = timeToRadius(d, maxR, horizon)
      const ang = categoryMidAngle(cat)
      // Duration: use estimated hours if provided, else derive from start/end
      const durH = e.estimatedHours || Math.min(
        Math.max((new Date(e.end || e.start) - new Date(e.start)) / 3600000, 0.5),
        24
      )
      const durPx = Math.max(4, Math.min(48, durH * hourPx))
      const impPx = 3 + (e.importance || 3) * 1.8  // tangential half-width
      nodes.push({
        id: `e-${e.id}`, item: e, itemType: 'event',
        targetR: r, targetAng: ang,
        x: cx + r * Math.cos(ang), y: cy + r * Math.sin(ang),
        initAngle: ang * 180 / Math.PI,
        radius: Math.max(durPx, impPx),
        durationHours: durH, durPx, impPx,
        color: cat.color, isRecurrence: !!e.isRecurrence,
      })
    })

    visibleTasks.forEach(t => {
      const cat = getCategoryById(t.category); if (!cat) return
      const d   = daysUntil(t.dueDate)
      const r   = timeToRadius(d, maxR, horizon)
      const ang = categoryMidAngle(cat)
      const durH  = t.estimatedHours || 1
      const durPx = Math.max(4, Math.min(48, durH * hourPx))
      const impPx = 3 + (t.importance || 3) * 1.8
      nodes.push({
        id: `t-${t.id}`, item: t, itemType: 'task',
        targetR: r, targetAng: ang,
        x: cx + r * Math.cos(ang) + 10, y: cy + r * Math.sin(ang) + 10,
        initAngle: ang * 180 / Math.PI,
        radius: Math.max(durPx, impPx),
        durationHours: durH, durPx, impPx,
        color: cat.color, isRecurrence: false,
      })
    })
    return nodes
  }, [visibleEvents, visibleTasks, cx, cy, maxR, Math.round(horizon)])

  // Keep ref in sync
  useEffect(() => { blipNodesRef.current = blipNodes }, [blipNodes])

  // ── D3 simulation ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!blipNodes.length || maxR <= 0) return
    if (simRef.current) simRef.current.stop()
    simRef.current = d3.forceSimulation(blipNodes)
      .alphaDecay(0.06)
      .force('collide', d3.forceCollide(d => d.radius + 4).strength(0.8))
      .force('radial',  d3.forceRadial(d => d.targetR, cx, cy).strength(0.7))
      .force('angle', {
        initialize(nodes) { this._nodes = nodes },
        force(alpha) {
          for (const n of this._nodes) {
            const cat = getCategoryById(n.item.category); if (!cat) continue
            const dx = n.x - cx, dy = n.y - cy
            const ang = Math.atan2(dy, dx) * 180 / Math.PI
            const clamped = Math.max(cat.startAngle, Math.min(cat.endAngle, ang))
            const diff = (clamped - ang) * (Math.PI / 180)
            const r = Math.sqrt(dx*dx + dy*dy) || 1
            n.vx += Math.cos(Math.atan2(dy,dx)+diff)*r*alpha*0.4 - dx*alpha*0.01
            n.vy += Math.sin(Math.atan2(dy,dx)+diff)*r*alpha*0.4 - dy*alpha*0.01
          }
        },
      })
      .on('tick', () => {
        blipNodes.forEach(n => {
          const g = svgRef.current?.querySelector(`[data-blip="${n.id}"]`)
          if (!g) return
          g.setAttribute('transform', `translate(${n.x},${n.y})`)
          const inner = g.querySelector('[data-blip-inner]')
          if (inner) {
            const ang = Math.atan2(n.y - cy, n.x - cx) * 180 / Math.PI
            inner.setAttribute('transform', `rotate(${ang})`)
          }
        })
      })
    return () => simRef.current?.stop()
  }, [blipNodes, cx, cy, maxR])

  // ── Heat map ──────────────────────────────────────────────────────────────
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

  // ── Arc wedge helper ──────────────────────────────────────────────────────
  const arc = d3.arc()
  function wedgePath(cat) {
    return arc({ innerRadius:0, outerRadius:maxR, startAngle:toRad(cat.startAngle), endAngle:toRad(cat.endAngle) })
  }

  // ── Click on radar ────────────────────────────────────────────────────────
  function handleRadarClick(e) {
    if (quickFocus) return
    const rect = svgRef.current.getBoundingClientRect()
    const dx = e.clientX - rect.left - cx, dy = e.clientY - rect.top - cy
    const dist = Math.sqrt(dx*dx + dy*dy)
    if (dist > maxR || dist < 10) return
    const angleDeg = Math.atan2(dy, dx) * 180 / Math.PI
    const cat = CATEGORIES.find(c => angleDeg >= c.startAngle && angleDeg < c.endAngle)
    const frac = Math.max(0, (dist - maxR*0.05) / (maxR*0.85))
    const days = Math.round(Math.pow(horizon+1, frac) - 1)
    const date = new Date(); date.setDate(date.getDate() + days)
    setClickHint({ category: cat?.id || 'work', date: date.toISOString().slice(0,10) })
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

      {/* Quick-add bar */}
      <form onSubmit={handleQuickSubmit}
        className={`relative z-30 flex items-center gap-2 px-4 py-2 border-b transition-colors ${
          quickFocus ? 'bg-[#0d1a0d] border-[#00ff4133]' : 'bg-[#080d08]/60 border-white/5'
        }`}>
        <span className="text-[10px] text-white/25 font-mono tracking-widest flex-shrink-0 hidden sm:block">
          {quickFocus ? '/' : 'PRESS /'}
        </span>
        <div className="flex-1 relative">
          <input ref={quickRef} value={quickText}
            onChange={e => setQuickText(e.target.value)}
            onFocus={() => setQuickFocus(true)}
            onBlur={() => { if (!quickText) setQuickFocus(false) }}
            placeholder='Quick add: "Board meeting Friday sage" or "t: Report +3d work"'
            className="w-full bg-transparent text-sm text-white font-mono outline-none placeholder-white/15" />
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

      {/* Main area */}
      <div className="flex-1 flex overflow-hidden scanlines no-select">

        {/* ZoomBar */}
        <ZoomBar horizon={horizon} onZoom={days => { targetHorizonRef.current = days }} />

        {/* Radar SVG */}
        <div className="flex-1 relative" onClick={handleRadarClick}>
          <svg ref={svgRef} className="absolute inset-0" style={{width:'100%',height:'100%'}} width={size.w} height={size.h}>
            <defs>
              <linearGradient id="sweepGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#00ff41" stopOpacity="0" />
                <stop offset="100%" stopColor="#00ff41" stopOpacity="0.28" />
              </linearGradient>
              <radialGradient id="radarFade" cx="50%" cy="50%" r="50%">
                <stop offset="60%" stopColor="#0a0f0a" stopOpacity="0" />
                <stop offset="100%" stopColor="#0a0f0a" stopOpacity="0.55" />
              </radialGradient>
              <clipPath id="radarClip"><circle cx={cx} cy={cy} r={maxR} /></clipPath>
              <filter id="blipGlow" x="-80%" y="-80%" width="260%" height="260%">
                <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="blur"/>
                <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
              </filter>
              <filter id="blipGlowSel" x="-80%" y="-80%" width="260%" height="260%">
                <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="blur"/>
                <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
              </filter>
            </defs>

            {/* Background */}
            <circle cx={cx} cy={cy} r={maxR+1} fill="#040a04" stroke="#00ff4120" strokeWidth="1" />

            {/* Wedges */}
            <g transform={`translate(${cx},${cy})`}>
              {CATEGORIES.map(cat => (
                <path key={cat.id} d={wedgePath(cat)} fill={cat.color}
                  opacity={activeCategories.has(cat.id) ? 0.05 : 0.01} clipPath="url(#radarClip)" />
              ))}
            </g>

            {/* Dividers */}
            {CATEGORIES.map(cat => {
              const r = toRad(cat.startAngle)
              return <line key={cat.id} x1={cx} y1={cy}
                x2={cx+maxR*Math.cos(r)} y2={cy+maxR*Math.sin(r)}
                stroke="#00ff4122" strokeWidth="1" strokeDasharray="5 5" />
            })}

            {/* Category labels */}
            {CATEGORIES.map(cat => {
              const mid = toRad((cat.startAngle+cat.endAngle)/2), lr = maxR*0.93
              return (
                <text key={cat.id} x={cx+lr*Math.cos(mid)} y={cy+lr*Math.sin(mid)}
                  fill={cat.color} opacity={activeCategories.has(cat.id)?0.5:0.12}
                  fontSize="9" fontFamily="JetBrains Mono, monospace" fontWeight="600"
                  letterSpacing="2" textAnchor="middle" dominantBaseline="middle">
                  {cat.label}
                </text>
              )
            })}

            {/* Time rings with heat */}
            {dynamicRings.map(ring => {
              const r    = timeToRadius(ring.d, maxR, horizon)
              const heat = heatMap[ring.l] || 0
              const col  = heat===0?'#00ff41':heat<=2?'#80ff80':heat<=4?'#ffcc44':'#ff6644'
              const op   = heat===0 ? 0.12 : Math.min(0.12 + heat*0.08, 0.5)
              return (
                <g key={ring.l}>
                  <circle cx={cx} cy={cy} r={r} fill="none" stroke={col} strokeWidth="1" strokeOpacity={op} />
                  {heat>=2 && <circle cx={cx} cy={cy} r={r} fill="none" stroke={col} strokeWidth="6" strokeOpacity={0.04} />}
                  <text x={cx+r*Math.cos(toRad(-82))} y={cy+r*Math.sin(toRad(-82))-4}
                    fill={col} fillOpacity={Math.min(0.25+heat*0.08,0.6)}
                    fontSize="8" fontFamily="JetBrains Mono, monospace" letterSpacing="1.5" textAnchor="middle">
                    {ring.l}
                  </text>
                </g>
              )
            })}

            {/* Crosshairs */}
            <line x1={cx-maxR} y1={cy} x2={cx+maxR} y2={cy} stroke="#00ff400e" strokeWidth="1"/>
            <line x1={cx} y1={cy-maxR} x2={cx} y2={cy+maxR} stroke="#00ff400e" strokeWidth="1"/>

            {/* Sweep */}
            <g id="sweep-group">
              <path d={`M ${cx} ${cy} L ${cx+maxR} ${cy} A ${maxR} ${maxR} 0 0 0 ${cx+maxR*Math.cos(toRad(-55))} ${cy+maxR*Math.sin(toRad(-55))} Z`}
                fill="url(#sweepGrad)" opacity="0.8" clipPath="url(#radarClip)" />
              <line x1={cx} y1={cy} x2={cx+maxR} y2={cy} stroke="#00ff41" strokeWidth="1.5" opacity="0.65" />
            </g>

            {/* Edge fade */}
            <circle cx={cx} cy={cy} r={maxR} fill="url(#radarFade)" pointerEvents="none" />

            {/* ── Blips — ellipse/diamond oriented radially ── */}
            {blipNodes.map(n => {
              const isSel = selected?.item?.id === n.item.id && selected?.type === n.itemType
              const { durPx, impPx, initAngle, isRecurrence, color } = n
              return (
                <g key={n.id} data-blip={n.id} transform={`translate(${n.x},${n.y})`}
                  onClick={e => { e.stopPropagation(); setSelected(isSel ? null : { item: n.item, type: n.itemType }) }}
                  style={{ cursor: 'pointer' }}
                  filter={isSel ? 'url(#blipGlowSel)' : 'url(#blipGlow)'}>

                  {/* Radially-oriented inner group */}
                  <g data-blip-inner transform={`rotate(${initAngle})`}>
                    {/* Outer pulse outline */}
                    {n.itemType === 'event'
                      ? <ellipse rx={durPx+5} ry={impPx+4} fill="none" stroke={color}
                          strokeWidth="1" strokeDasharray={isRecurrence?'3 3':undefined}
                          opacity={isSel?0.75:0.2} />
                      : <ellipse rx={durPx+5} ry={impPx+4} fill="none" stroke={color}
                          strokeWidth="1" strokeDasharray="2 2" opacity={isSel?0.75:0.2} />
                    }

                    {/* Main shape */}
                    {n.itemType === 'event'
                      ? <ellipse rx={durPx} ry={impPx} fill={color}
                          opacity={isRecurrence ? 0.5 : (isSel ? 1 : 0.88)} />
                      : <polygon
                          points={`${durPx},0 0,${impPx} ${-durPx},0 0,${-impPx}`}
                          fill={color} opacity={isSel ? 1 : 0.82} />
                    }

                    {/* Centre hole */}
                    <circle r={2} fill="#040a04" />
                  </g>

                  {/* Recurrence dot */}
                  {isRecurrence && <circle r={2} cx={durPx-1} cy={0} fill={color} opacity={0.85} />}
                </g>
              )
            })}

            {/* Centre dot */}
            <circle cx={cx} cy={cy} r={5} fill="#00ff41" opacity="0.9" />
            <circle cx={cx} cy={cy} r={2} fill="#040a04" />

            {/* All-day ticks */}
            {visibleAllDay.map(e => {
              const cat = getCategoryById(e.category); if (!cat) return null
              const d = daysUntil(e.start); if (d < 0 || d > horizon+0.1) return null
              const mid = toRad((cat.startAngle+cat.endAngle)/2)
              return (
                <line key={`ad-${e.id}`}
                  x1={cx+(maxR-8)*Math.cos(mid)} y1={cy+(maxR-8)*Math.sin(mid)}
                  x2={cx+(maxR-1)*Math.cos(mid)} y2={cy+(maxR-1)*Math.sin(mid)}
                  stroke={cat.color} strokeWidth={e.isRecurrence?1:2}
                  strokeDasharray={e.isRecurrence?'2 2':undefined} opacity={e.isRecurrence?0.35:0.6} />
              )
            })}
          </svg>

          {/* View label */}
          <div className="absolute top-3 right-3 pointer-events-none">
            <div className="flex items-center gap-2 bg-[#040a04]/80 border border-white/8 rounded px-2.5 py-1.5">
              <span className="text-[9px] text-white/25 font-mono tracking-widest">VIEW</span>
              <span className="text-[11px] text-[#00ff41]/70 font-mono tracking-widest font-semibold">
                {getHorizonLabel(horizon)}
              </span>
            </div>
          </div>

          {!quickFocus && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-[9px] font-mono text-white/10 tracking-widest pointer-events-none">
              CLICK TO ADD EVENT  ·  SCROLL TO ZOOM  ·  PRESS / TO QUICK-ADD
            </div>
          )}
        </div>

        {/* Detail panel */}
        {selected && !showPriority && (
          <DetailPanel
            selected={selected}
            onClose={() => setSelected(null)}
            onEdit={() => { setEdit(selected); selected.type==='event' ? setShowEvent(true) : setShowTask(true) }}
            onDelete={handleDelete}
          />
        )}

        {/* Task sidebar */}
        <TaskSidebar
          tasks={allTasks.filter(t => activeCategories.has(t.category))}
          onSelect={t => { setSelected({ item: t, type: 'task' }); setShowPriority(false) }}
          selected={selected}
          onOpenPriority={() => setShowPriority(p => !p)}
          showPriority={showPriority}
        />

        {/* Priority panel */}
        {showPriority && (
          <PriorityList
            tasks={allTasks}
            onClose={() => setShowPriority(false)}
            onSelectTask={t => { setSelected({ item: t, type: 'task' }); setShowPriority(false) }}
          />
        )}
      </div>

      {/* Bottom bar */}
      <div className="relative z-20 flex items-center justify-between px-4 py-2 bg-[#080d08]/80 border-t border-white/5">
        <div className="flex items-center gap-3 flex-wrap">
          {CATEGORIES.map(cat => {
            const isActive = activeCategories.has(cat.id)
            return (
              <button key={cat.id} onClick={() => toggleCategory(cat.id)}
                className="flex items-center gap-1.5 font-mono text-[10px] transition-opacity"
                style={{ opacity: isActive ? 1 : 0.28 }}>
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: cat.color }} />
                <span style={{ color: isActive ? cat.color : 'rgba(255,255,255,0.3)' }}>{cat.label}</span>
              </button>
            )
          })}
          <span className="text-[9px] text-white/12 font-mono ml-1">
            ● event (length=hours, width=importance)  ◇ task  ↻ recurring
          </span>
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

      {showEventModal && (
        <EventModal
          onClose={() => { setShowEvent(false); setClickHint(null); setEdit(null) }}
          prefillCategory={clickHint?.category}
          prefillDate={clickHint?.date}
          editItem={editTarget?.type==='event' ? editTarget.item : null}
        />
      )}
      {showTaskModal && (
        <TaskModal
          onClose={() => { setShowTask(false); setEdit(null) }}
          editItem={editTarget?.type==='task' ? editTarget.item : null}
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
      style={{ borderColor: cat?.color+'44' }}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] tracking-widest" style={{ color: cat?.color }}>
          {type==='task' ? '◇ TASK' : '● EVENT'}
          {item.recurrenceType && item.recurrenceType!=='none' && <span className="ml-2 opacity-60">↻ {item.recurrenceType}</span>}
        </span>
        <button onClick={onClose} className="text-white/30 hover:text-white text-xl leading-none">×</button>
      </div>
      <p className="text-white font-medium mb-3 leading-snug">{item.title}</p>
      <div className="space-y-1.5 text-xs text-white/50 mb-4">
        <div className="flex justify-between"><span>CATEGORY</span><span style={{color:cat?.color}}>{cat?.label}</span></div>
        <div className="flex justify-between">
          <span>DATE</span>
          <span className="text-white/70">
            {new Date(dateStr+(!dateStr.includes('T')?'T12:00:00':'')).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}
          </span>
        </div>
        {!item.allDay && (
          <div className="flex justify-between"><span>IN</span>
            <span className="text-white/70">{days<0?'PAST':days<1?`${Math.round(days*24)}h`:`${Math.round(days)}d`}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span>IMPORTANCE</span>
          <span className="text-white/80 tracking-wider">{'█'.repeat(item.importance||1)}{'░'.repeat(5-(item.importance||1))}</span>
        </div>
        {item.estimatedHours && (
          <div className="flex justify-between"><span>EFFORT</span>
            <span className="text-white/70">{item.estimatedHours<1?`${item.estimatedHours*60}m`:`${item.estimatedHours}h`}</span>
          </div>
        )}
        {item.location && (
          <div className="flex justify-between gap-2"><span className="flex-shrink-0">LOCATION</span>
            <span className="text-white/70 text-right truncate">{item.location}</span>
          </div>
        )}
        {item.isRecurrence && (
          <div className="text-[10px] text-white/25 pt-1 border-t border-white/5">↻ Recurring — edit original to change all</div>
        )}
      </div>
      <div className="flex gap-2 border-t border-white/10 pt-3">
        <button onClick={onDelete}
          className="flex-1 py-1.5 text-[10px] text-red-400/70 border border-red-400/20 rounded hover:bg-red-400/10 transition-colors">
          {item.isRecurrence?'DEL SERIES':'DELETE'}
        </button>
        <button onClick={onEdit}
          className="flex-1 py-1.5 text-[10px] border rounded transition-colors hover:bg-white/5"
          style={{ color: cat?.color, borderColor: cat?.color+'44' }}>
          EDIT
        </button>
      </div>
    </div>
  )
}

// ── Task sidebar ──────────────────────────────────────────────────────────────
function TaskSidebar({ tasks, onSelect, selected, onOpenPriority, showPriority }) {
  const [open, setOpen] = useState(true)
  const overdue  = tasks.filter(t => daysUntil(t.dueDate) < 0)
  const upcoming = tasks.filter(t => daysUntil(t.dueDate) >= 0)

  if (!open) return (
    <button onClick={() => setOpen(true)}
      className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-20 bg-[#0d1a0d]/80 border border-white/10 rounded-l text-[10px] text-white/30 font-mono flex items-center justify-center hover:text-white/60 transition-colors"
      style={{ writingMode: 'vertical-rl' }}>TASKS</button>
  )

  return (
    <div className="w-44 flex-shrink-0 flex flex-col border-l border-white/10 bg-[#080d08]/80 backdrop-blur-sm overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-[#fbbf24] tracking-widest">TASKS</span>
          {overdue.length > 0 && <span className="text-[9px] text-red-400 font-mono">{overdue.length} LATE</span>}
        </div>
        <button onClick={() => setOpen(false)} className="text-white/20 hover:text-white/50 text-xs">−</button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {tasks.length === 0 && <p className="text-[10px] text-white/20 font-mono px-3 py-3 tracking-wide">NO PENDING TASKS</p>}
        {overdue.length > 0 && (
          <>
            <div className="px-3 py-1 text-[9px] text-red-400/60 tracking-widest font-mono border-b border-red-400/10">OVERDUE</div>
            {overdue.map(t => <TaskRow key={t.id} task={t} onSelect={onSelect} selected={selected} isOverdue />)}
          </>
        )}
        {upcoming.map(t => <TaskRow key={t.id} task={t} onSelect={onSelect} selected={selected} />)}
      </div>
      {/* Priority queue button */}
      <button onClick={onOpenPriority}
        className={`px-3 py-2 text-[10px] font-mono tracking-widest border-t transition-colors flex items-center gap-2 ${
          showPriority
            ? 'bg-[#00ff4115] border-[#00ff4133] text-[#00ff41]'
            : 'border-white/8 text-white/30 hover:text-white/60 hover:bg-white/4'
        }`}>
        <span>⚡</span>
        <span>PRIORITY QUEUE</span>
      </button>
    </div>
  )
}

function TaskRow({ task: t, onSelect, selected, isOverdue }) {
  const cat  = getCategoryById(t.category)
  const days = daysUntil(t.dueDate)
  const isSel = selected?.item?.id === t.id && selected?.type === 'task'
  return (
    <div className={`w-full text-left px-3 py-2.5 border-b transition-colors ${isOverdue?'border-red-400/10':'border-white/5'} ${isSel?'bg-white/10':'hover:bg-white/5'}`}>
      <div className="flex items-start gap-1.5">
        <button onClick={async e => { e.stopPropagation(); await toggleTask(t.id) }}
          className="mt-0.5 w-3.5 h-3.5 flex-shrink-0 border rounded-sm flex items-center justify-center hover:border-white/50 transition-colors"
          style={{ borderColor: cat?.color+'66' }}>
          <span className="text-[8px]" style={{ color: cat?.color }}>✓</span>
        </button>
        <button onClick={() => onSelect(t)} className="flex-1 text-left min-w-0">
          <div className="flex items-center gap-1 mb-0.5">
            <span className="w-1.5 h-1.5 rotate-45 flex-shrink-0" style={{ background: cat?.color, borderRadius:'1px' }} />
            <span className={`text-xs font-mono truncate leading-tight ${isOverdue?'text-red-300/80':'text-white/80'}`}>{t.title}</span>
          </div>
          <div className={`text-[10px] pl-3 font-mono ${isOverdue?'text-red-400/60':'text-white/30'}`}>
            {days < 0 ? `${Math.abs(Math.round(days))}d AGO` : days < 1 ? 'TODAY' : `${Math.round(days)}d`}
          </div>
        </button>
      </div>
    </div>
  )
}
