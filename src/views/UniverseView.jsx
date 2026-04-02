import { useEffect, useRef, useState } from 'react'
import * as d3 from 'd3'
import { useEvents, useTasks, useNotesWithContent } from '../db/hooks'
import { CATEGORIES, getCategoryById } from '../context/AppContext'

// ── Node appearance by type ───────────────────────────────────────────────────
const TYPE_CFG = {
  event: { baseR: 10, shape: 'circle',  label: 'EVENT' },
  task:  { baseR: 9,  shape: 'diamond', label: 'TASK'  },
  note:  { baseR: 7,  shape: 'circle',  label: 'NOTE'  },
}

function daysFromNow(d) {
  if (!d) return 0
  return (new Date(d) - new Date()) / (1000 * 60 * 60 * 24)
}

function buildGraphData(events, tasks, notes) {
  const nodes = []
  const links = []

  events.forEach(e => {
    const cat = getCategoryById(e.category)
    nodes.push({
      id: `e-${e.id}`,
      dbId: e.id,
      type: 'event',
      label: e.title,
      category: e.category,
      color: cat?.color || '#00ff41',
      days: daysFromNow(e.start),
      importance: e.importance || 3,
      data: e,
    })
  })

  tasks.forEach(t => {
    const cat = getCategoryById(t.category)
    nodes.push({
      id: `t-${t.id}`,
      dbId: t.id,
      type: 'task',
      label: t.title,
      category: t.category,
      color: cat?.color || '#fbbf24',
      days: daysFromNow(t.dueDate),
      importance: t.importance || 3,
      data: t,
    })
  })

  notes.forEach(n => {
    nodes.push({
      id: `n-${n.id}`,
      dbId: n.id,
      type: 'note',
      label: n.content?.split('\n')[0]?.slice(0, 40) || '(note)',
      category: null,
      color: '#60a5fa',
      days: daysFromNow(n.date),
      importance: 2,
      data: n,
    })

    // Auto-link notes to events/tasks via @/# tags
    const atTags   = [...(n.content?.matchAll(/@([\w][^\s@#]{0,40})/g) || [])]
    const hashTags = [...(n.content?.matchAll(/#([\w][^\s@#]{0,40})/g) || [])]

    atTags.forEach(m => {
      const tagText = m[1].toLowerCase()
      const match = events.find(e => e.title.toLowerCase().includes(tagText))
      if (match) links.push({ source: `n-${n.id}`, target: `e-${match.id}`, strength: 0.6 })
    })
    hashTags.forEach(m => {
      const tagText = m[1].toLowerCase()
      const match = tasks.find(t => t.title.toLowerCase().includes(tagText))
      if (match) links.push({ source: `n-${n.id}`, target: `t-${match.id}`, strength: 0.6 })
    })
  })

  // Link tasks to events in same category within 7 days of each other
  tasks.forEach(t => {
    events.forEach(e => {
      if (e.category === t.category && Math.abs(daysFromNow(e.start) - daysFromNow(t.dueDate)) < 7) {
        links.push({ source: `t-${t.id}`, target: `e-${e.id}`, strength: 0.2 })
      }
    })
  })

  return { nodes, links }
}

export default function UniverseView() {
  const svgRef  = useRef(null)
  const simRef  = useRef(null)
  const nodesRef = useRef([])
  const linksRef = useRef([])
  const [info, setInfo]   = useState(null)
  const [hov,  setHov]    = useState(null)
  const transform = useRef(d3.zoomIdentity)

  const events = useEvents() || []
  const tasks  = useTasks()  || []
  const notes  = useNotesWithContent() || []

  // Rebuild simulation when data changes
  useEffect(() => {
    const svg = d3.select(svgRef.current)
    if (!svgRef.current) return
    const { width, height } = svgRef.current.getBoundingClientRect()
    if (!width) return

    const { nodes, links } = buildGraphData(events, tasks, notes)
    nodesRef.current = nodes
    linksRef.current = links

    const cx = width / 2, cy = height / 2

    if (simRef.current) simRef.current.stop()

    // Seed x positions from time axis, y from category
    nodes.forEach(n => {
      const catIdx = CATEGORIES.findIndex(c => c.id === n.category)
      n.x = cx + n.days * (width / 2) / 55 + (Math.random() - 0.5) * 40
      n.y = cy + (catIdx >= 0 ? (catIdx - 1.5) * (height / 5) : 0) + (Math.random() - 0.5) * 30
    })

    simRef.current = d3.forceSimulation(nodes)
      .force('link',    d3.forceLink(links).id(d => d.id).distance(80).strength(d => d.strength || 0.3))
      .force('collide', d3.forceCollide(d => TYPE_CFG[d.type]?.baseR * 1.8 + 4).strength(0.7))
      .force('charge',  d3.forceManyBody().strength(-80))
      .force('timeX',   d3.forceX(d => cx + d.days * (width / 2) / 55).strength(0.25))
      .force('catY',    d3.forceY(d => {
        const ci = CATEGORIES.findIndex(c => c.id === d.category)
        return cy + (ci >= 0 ? (ci - 1.5) * (height / 5) : 0)
      }).strength(0.2))
      .alphaDecay(0.02)
      .on('tick', renderFrame)

    function renderFrame() {
      const g = svgRef.current?.querySelector('#nodes-group')
      const l = svgRef.current?.querySelector('#links-group')
      if (!g || !l) return

      // Update link positions
      const linkEls = l.querySelectorAll('line')
      links.forEach((lk, i) => {
        const el = linkEls[i]
        if (!el) return
        el.setAttribute('x1', lk.source.x)
        el.setAttribute('y1', lk.source.y)
        el.setAttribute('x2', lk.target.x)
        el.setAttribute('y2', lk.target.y)
      })

      // Update node positions
      nodes.forEach(n => {
        const el = g.querySelector(`[data-node="${n.id}"]`)
        if (el) el.setAttribute('transform', `translate(${n.x},${n.y})`)
      })
    }

    // Initial render of static elements
    renderStaticElements(svg, nodes, links, width, height)

    return () => simRef.current?.stop()
  }, [events, tasks, notes])

  function renderStaticElements(svg, nodes, links, w, h) {
    const cx = w / 2, cy = h / 2

    // Clear old content
    svg.select('#links-group').selectAll('*').remove()
    svg.select('#nodes-group').selectAll('*').remove()
    svg.select('#labels-group').selectAll('*').remove()

    // Links
    svg.select('#links-group')
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('stroke', '#ffffff0a')
      .attr('stroke-width', 1)

    // Node groups
    const nodeGs = svg.select('#nodes-group')
      .selectAll('g')
      .data(nodes, d => d.id)
      .join('g')
      .attr('data-node', d => d.id)
      .attr('transform', d => `translate(${d.x},${d.y})`)
      .style('cursor', 'pointer')
      .on('mouseenter', (event, d) => setHov(d))
      .on('mouseleave', () => setHov(null))
      .on('click', (event, d) => { event.stopPropagation(); setInfo(d) })

    // Node shapes
    nodeGs.each(function(d) {
      const g = d3.select(this)
      const r = TYPE_CFG[d.type]?.baseR || 8
      const col = d.color

      if (d.type === 'task') {
        g.append('polygon')
          .attr('points', `0,${-r} ${r},0 0,${r} ${-r},0`)
          .attr('fill', col)
          .attr('opacity', 0.85)
      } else {
        g.append('circle').attr('r', r).attr('fill', col).attr('opacity', 0.85)
      }

      // Inner dot
      g.append('circle').attr('r', r * 0.25).attr('fill', '#05050f')

      // Glow ring (hidden by default, shown on hover)
      if (d.type === 'task') {
        g.append('polygon')
          .attr('class', 'hover-ring')
          .attr('points', `0,${-(r+5)} ${r+5},0 0,${r+5} ${-(r+5)},0`)
          .attr('fill', 'none')
          .attr('stroke', col)
          .attr('stroke-width', 1)
          .attr('opacity', 0.25)
      } else {
        g.append('circle')
          .attr('class', 'hover-ring')
          .attr('r', r + 5)
          .attr('fill', 'none')
          .attr('stroke', col)
          .attr('stroke-width', 1)
          .attr('opacity', 0.25)
      }
    })
  }

  // ── Set up zoom/pan ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!svgRef.current) return
    const svg = d3.select(svgRef.current)
    const zoomLayer = svg.select('#zoom-layer')

    const zoom = d3.zoom()
      .scaleExtent([0.1, 12])
      .on('zoom', e => {
        transform.current = e.transform
        zoomLayer.attr('transform', e.transform)
      })

    svg.call(zoom)
    svg.on('click', () => setInfo(null))

    // Store reset fn
    svgRef.current._zoomReset = () => svg.transition().duration(500).call(zoom.transform, d3.zoomIdentity)
    svgRef.current._zoomIn    = () => svg.transition().duration(200).call(zoom.scaleBy, 1.4)
    svgRef.current._zoomOut   = () => svg.transition().duration(200).call(zoom.scaleBy, 0.72)

    return () => svg.on('zoom', null).on('click', null)
  }, [])

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#05050f]">
      <svg ref={svgRef} className="w-full h-full" style={{ cursor: 'grab' }}>
        <defs>
          <radialGradient id="bgGrad" cx="50%" cy="50%" r="55%">
            <stop offset="0%"   stopColor="#0d0d1a" />
            <stop offset="100%" stopColor="#05050f" />
          </radialGradient>
          <filter id="nodeGlow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* Background */}
        <rect width="100%" height="100%" fill="url(#bgGrad)" />

        {/* Stars (static, outside zoom) */}
        <g id="stars" pointerEvents="none">
          {Array.from({ length: 160 }, (_, i) => (
            <circle key={i}
              cx={(i * 137.5 * 3) % 2000}
              cy={(i * 97.1  * 3) % 1200}
              r={i % 5 === 0 ? 1 : 0.5}
              fill="white"
              opacity={0.04 + (i % 7) * 0.015}
            />
          ))}
        </g>

        {/* Zoom layer (everything pannable/zoomable) */}
        <g id="zoom-layer">
          {/* Category swim lanes */}
          {CATEGORIES.map((cat, i) => (
            <rect key={cat.id}
              x={-5000} y={0}
              width={10000} height={1}
              fill={cat.color}
              opacity="0.0"
              data-lane={cat.id}
            />
          ))}

          {/* Links */}
          <g id="links-group" />

          {/* Nodes */}
          <g id="nodes-group" filter="url(#nodeGlow)" />

          {/* Labels group (rendered over everything) */}
          <g id="labels-group" pointerEvents="none" />
        </g>
      </svg>

      {/* ── Overlay: axis labels (outside zoom) ── */}
      <div className="absolute top-3 left-0 right-0 flex justify-between px-8 font-mono text-[10px] text-white/20 tracking-widest pointer-events-none">
        <span>← PAST</span>
        <span>NOW</span>
        <span>FUTURE →</span>
      </div>

      {/* ── Category lane labels (left side) ── */}
      <div className="absolute left-3 top-0 bottom-0 flex flex-col justify-around font-mono pointer-events-none py-8">
        {CATEGORIES.map(cat => (
          <span key={cat.id} className="text-[9px] tracking-widest" style={{ color: cat.color, opacity: 0.35 }}>
            {cat.label}
          </span>
        ))}
      </div>

      {/* ── Legend ── */}
      <div className="absolute bottom-4 left-8 font-mono text-[10px] text-white/25 space-y-1 pointer-events-none">
        <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-[#00ff41]" /> EVENT</div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 inline-block bg-[#fbbf24]" style={{ clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)' }} /> TASK
        </div>
        <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-[#60a5fa]" /> NOTE</div>
        <div className="mt-1 opacity-60">SCROLL TO ZOOM · DRAG TO PAN</div>
      </div>

      {/* ── Zoom buttons ── */}
      <div className="absolute top-4 right-4 flex flex-col gap-1">
        {[
          { label: '+', fn: () => svgRef.current?._zoomIn?.()  },
          { label: '⟲', fn: () => svgRef.current?._zoomReset?.() },
          { label: '−', fn: () => svgRef.current?._zoomOut?.() },
        ].map(b => (
          <button key={b.label} onClick={b.fn}
            className="w-8 h-8 bg-white/5 hover:bg-white/10 border border-white/10 rounded text-white/50 hover:text-white/80 text-sm font-mono transition-colors">
            {b.label}
          </button>
        ))}
      </div>

      {/* ── Hover tooltip ── */}
      {hov && !info && (
        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 bg-[#0d0d1a]/95 border border-white/10 rounded px-3 py-1.5 text-xs font-mono text-white/70 pointer-events-none whitespace-nowrap shadow-xl">
          <span style={{ color: hov.color }}>{TYPE_CFG[hov.type]?.label}</span>
          <span className="text-white/40 mx-1.5">·</span>
          {hov.label}
        </div>
      )}

      {/* ── Node detail panel ── */}
      {info && (
        <div className="absolute left-8 top-8 w-64 bg-[#0d0d1a]/95 border border-[#a78bfa33] rounded-xl p-4 font-mono text-sm shadow-2xl backdrop-blur-sm">
          <div className="flex justify-between mb-3">
            <span className="text-[10px] tracking-widest" style={{ color: info.color }}>
              {TYPE_CFG[info.type]?.label || 'NODE'}
            </span>
            <button onClick={() => setInfo(null)} className="text-white/30 hover:text-white text-xl leading-none">×</button>
          </div>
          <p className="text-white font-medium mb-3 leading-snug">{info.label}</p>
          <div className="space-y-1.5 text-xs text-white/50">
            {info.category && (
              <div className="flex justify-between">
                <span>CATEGORY</span>
                <span style={{ color: getCategoryById(info.category)?.color }}>
                  {getCategoryById(info.category)?.label}
                </span>
              </div>
            )}
            {(info.data?.start || info.data?.dueDate || info.data?.date) && (
              <div className="flex justify-between">
                <span>DATE</span>
                <span className="text-white/70">
                  {new Date(((info.data.start || info.data.dueDate || info.data.date) + 'T12:00:00').slice(0,19))
                    .toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              </div>
            )}
            <div className="flex justify-between">
              <span>TIME</span>
              <span className="text-white/70">
                {info.days > 0
                  ? `+${Math.round(info.days)}d`
                  : info.days < 0
                  ? `${Math.round(info.days)}d ago`
                  : 'TODAY'}
              </span>
            </div>
            {info.data?.importance && (
              <div className="flex justify-between">
                <span>IMPORTANCE</span>
                <span>{'█'.repeat(info.data.importance)}{'░'.repeat(5-info.data.importance)}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
