import { useEffect, useRef, useState } from 'react'

// ── Demo nodes for the Universe (will come from DB later) ─────────────────────
const DEMO_NODES = [
  // Events
  { id: 'e1', type: 'event',    label: 'Team Standup',       category: 'work',     daysFromNow:  0.3  },
  { id: 'e2', type: 'event',    label: 'Project Deadline',   category: 'work',     daysFromNow:  4    },
  { id: 'e3', type: 'event',    label: 'Quarterly Review',   category: 'work',     daysFromNow:  28   },
  { id: 'e4', type: 'event',    label: 'Dentist Appt',       category: 'health',   daysFromNow:  2    },
  { id: 'e5', type: 'event',    label: "Mom's Birthday",     category: 'personal', daysFromNow:  12   },
  { id: 'e6', type: 'event',    label: 'Dinner with Alex',   category: 'personal', daysFromNow:  6    },
  { id: 'e7', type: 'event',    label: 'Sprint Planning',    category: 'work',     daysFromNow: -3    },
  { id: 'e8', type: 'event',    label: 'Annual Physical',    category: 'health',   daysFromNow: -14   },
  // Tasks
  { id: 't1', type: 'task',     label: 'Write Report',       category: 'work',     daysFromNow:  3    },
  { id: 't2', type: 'task',     label: 'Buy Groceries',      category: 'personal', daysFromNow:  1    },
  { id: 't3', type: 'task',     label: 'Car Service',        category: 'other',    daysFromNow:  18   },
  // Notes
  { id: 'n1', type: 'note',     label: 'Standup Notes',      category: 'work',     daysFromNow:  0.3  },
  { id: 'n2', type: 'note',     label: 'Birthday Ideas',     category: 'personal', daysFromNow:  12   },
  { id: 'n3', type: 'note',     label: 'Q3 Retro Notes',     category: 'work',     daysFromNow: -3    },
  // Days
  { id: 'd1', type: 'day',      label: 'Today',              category: 'other',    daysFromNow:  0    },
  { id: 'd2', type: 'day',      label: 'Last Week',          category: 'other',    daysFromNow: -7    },
  { id: 'd3', type: 'day',      label: 'Next Month',         category: 'other',    daysFromNow:  30   },
]

// Edges (connections between nodes)
const DEMO_EDGES = [
  { source: 'n1', target: 'e1' },
  { source: 'n2', target: 'e5' },
  { source: 'n3', target: 'e7' },
  { source: 't1', target: 'e2' },
  { source: 'd1', target: 'e1' },
  { source: 'd1', target: 't1' },
  { source: 'd1', target: 't2' },
  { source: 'd2', target: 'e7' },
  { source: 'd2', target: 'n3' },
  { source: 'd3', target: 'e3' },
]

const TYPE_CONFIG = {
  event: { color: '#00ff41', shape: 'circle',   baseSize: 10 },
  task:  { color: '#fbbf24', shape: 'diamond',  baseSize: 9  },
  note:  { color: '#60a5fa', shape: 'circle',   baseSize: 7  },
  day:   { color: '#a78bfa', shape: 'hexagon',  baseSize: 14 },
}

const CAT_COLOR = {
  work:     '#00ff41',
  personal: '#60a5fa',
  health:   '#f472b6',
  other:    '#fbbf24',
}

// Simple force simulation (no D3 dependency for Stage 1)
function initPositions(nodes, w, h) {
  const cx = w / 2, cy = h / 2
  return nodes.map(n => {
    // X axis = time (past left, future right)
    const timeX = cx + n.daysFromNow * (w / 2) / 45
    // Y axis = cluster by category
    const catIndex = ['work', 'personal', 'health', 'other'].indexOf(n.category)
    const catY = cy + (catIndex - 1.5) * (h / 5)
    // Add jitter by type
    const typeJitter = { event: 0, task: 40, note: -40, day: -10 }
    const seed = n.id.charCodeAt(1) * 17
    return {
      ...n,
      x: timeX + ((seed % 60) - 30),
      y: catY + (typeJitter[n.type] || 0) + ((seed % 40) - 20),
      vx: 0, vy: 0,
    }
  })
}

export default function UniverseView() {
  const canvasRef = useRef(null)
  const stateRef  = useRef({ nodes: [], zoom: 1, panX: 0, panY: 0, drag: null, hovered: null })
  const [hovered, setHovered] = useState(null)
  const [info, setInfo]       = useState(null)
  const sizeRef = useRef({ w: 800, h: 600 })
  const animRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const parent = canvas.parentElement
    const obs = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect
      canvas.width  = width
      canvas.height = height
      sizeRef.current = { w: width, h: height }
      stateRef.current.nodes = initPositions(DEMO_NODES, width, height)
    })
    obs.observe(parent)
    stateRef.current.nodes = initPositions(DEMO_NODES, canvas.width, canvas.height)
    return () => obs.disconnect()
  }, [])

  // Draw loop
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')

    function draw() {
      const { w, h } = sizeRef.current
      const { nodes, zoom, panX, panY, hovered: hovId } = stateRef.current
      canvas.width  = w
      canvas.height = h

      ctx.clearRect(0, 0, w, h)

      // Background gradient
      const bg = ctx.createRadialGradient(w/2, h/2, 0, w/2, h/2, Math.max(w,h)/1.5)
      bg.addColorStop(0, '#0d0d1a')
      bg.addColorStop(1, '#05050f')
      ctx.fillStyle = bg
      ctx.fillRect(0, 0, w, h)

      ctx.save()
      ctx.translate(panX, panY)
      ctx.scale(zoom, zoom)

      // ── Star field ──
      ctx.fillStyle = '#ffffff'
      for (let i = 0; i < 120; i++) {
        const sx = ((i * 137.508 * 3) % w)
        const sy = ((i * 97.123  * 3) % h)
        const sr = (i % 3 === 0) ? 1 : 0.5
        ctx.globalAlpha = 0.1 + (i % 5) * 0.04
        ctx.beginPath()
        ctx.arc(sx, sy, sr, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1

      // ── Time axis ──
      ctx.strokeStyle = '#ffffff10'
      ctx.lineWidth = 1
      ctx.setLineDash([4, 8])
      ctx.beginPath()
      ctx.moveTo(0, h / 2)
      ctx.lineTo(w, h / 2)
      ctx.stroke()
      ctx.setLineDash([])

      // NOW marker
      ctx.strokeStyle = '#ffffff20'
      ctx.lineWidth = 1
      ctx.setLineDash([2, 4])
      ctx.beginPath()
      ctx.moveTo(w / 2, 0)
      ctx.lineTo(w / 2, h)
      ctx.stroke()
      ctx.setLineDash([])
      ctx.fillStyle = '#ffffff30'
      ctx.font = '10px JetBrains Mono, monospace'
      ctx.letterSpacing = '2px'
      ctx.fillText('NOW', w / 2 + 6, 18)
      ctx.fillText('PAST ←', 60, 18)
      ctx.fillText('→ FUTURE', w - 100, 18)

      // ── Edges ──
      DEMO_EDGES.forEach(edge => {
        const src = nodes.find(n => n.id === edge.source)
        const tgt = nodes.find(n => n.id === edge.target)
        if (!src || !tgt) return
        ctx.beginPath()
        ctx.moveTo(src.x, src.y)
        ctx.lineTo(tgt.x, tgt.y)
        ctx.strokeStyle = '#ffffff08'
        ctx.lineWidth = 1
        ctx.stroke()
      })

      // ── Nodes ──
      nodes.forEach(node => {
        const cfg = TYPE_CONFIG[node.type]
        const isHov = node.id === hovId
        const r = cfg.baseSize * (isHov ? 1.4 : 1)
        const col = CAT_COLOR[node.category] || cfg.color

        // Glow
        if (isHov) {
          ctx.shadowColor = col
          ctx.shadowBlur = 18
        }

        // Shape
        ctx.fillStyle = col
        ctx.globalAlpha = isHov ? 1 : 0.8
        ctx.beginPath()

        if (cfg.shape === 'circle') {
          ctx.arc(node.x, node.y, r, 0, Math.PI * 2)
        } else if (cfg.shape === 'diamond') {
          ctx.moveTo(node.x, node.y - r)
          ctx.lineTo(node.x + r, node.y)
          ctx.lineTo(node.x, node.y + r)
          ctx.lineTo(node.x - r, node.y)
          ctx.closePath()
        } else if (cfg.shape === 'hexagon') {
          for (let i = 0; i < 6; i++) {
            const a = (i * Math.PI) / 3 - Math.PI / 6
            const fn = i === 0 ? ctx.moveTo.bind(ctx) : ctx.lineTo.bind(ctx)
            fn(node.x + r * Math.cos(a), node.y + r * Math.sin(a))
          }
          ctx.closePath()
        }
        ctx.fill()

        ctx.shadowBlur = 0
        ctx.globalAlpha = 1

        // Inner dot
        ctx.fillStyle = '#05050f'
        ctx.beginPath()
        ctx.arc(node.x, node.y, r * 0.3, 0, Math.PI * 2)
        ctx.fill()

        // Label
        if (isHov || zoom > 1.2) {
          ctx.fillStyle = isHov ? '#ffffff' : '#ffffff80'
          ctx.font = `${isHov ? 11 : 9}px JetBrains Mono, monospace`
          ctx.fillText(node.label, node.x + r + 4, node.y + 4)
        }
      })

      ctx.restore()
      animRef.current = requestAnimationFrame(draw)
    }

    animRef.current = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(animRef.current)
  }, [])

  // ── Mouse interactions ──
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    function getWorldPos(e) {
      const rect = canvas.getBoundingClientRect()
      const { zoom, panX, panY } = stateRef.current
      return {
        x: (e.clientX - rect.left - panX) / zoom,
        y: (e.clientY - rect.top  - panY) / zoom,
      }
    }

    function findNode(wx, wy) {
      return stateRef.current.nodes.find(n => {
        const cfg = TYPE_CONFIG[n.type]
        return Math.hypot(wx - n.x, wy - n.y) < cfg.baseSize * 1.8
      })
    }

    function onMouseMove(e) {
      const { x, y } = getWorldPos(e)
      const node = findNode(x, y)
      stateRef.current.hovered = node?.id || null
      setHovered(node || null)

      if (stateRef.current.drag) {
        stateRef.current.panX += e.movementX
        stateRef.current.panY += e.movementY
      }
      canvas.style.cursor = node ? 'pointer' : stateRef.current.drag ? 'grabbing' : 'grab'
    }

    function onMouseDown(e) {
      const { x, y } = getWorldPos(e)
      const node = findNode(x, y)
      if (node) {
        setInfo(node)
      } else {
        stateRef.current.drag = true
        canvas.style.cursor = 'grabbing'
      }
    }

    function onMouseUp() {
      stateRef.current.drag = false
      canvas.style.cursor = 'grab'
    }

    function onWheel(e) {
      e.preventDefault()
      const rect = canvas.getBoundingClientRect()
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top
      const delta = e.deltaY < 0 ? 1.1 : 0.9
      const { zoom, panX, panY } = stateRef.current
      const newZoom = Math.max(0.2, Math.min(8, zoom * delta))
      stateRef.current.panX = mx - (mx - panX) * (newZoom / zoom)
      stateRef.current.panY = my - (my - panY) * (newZoom / zoom)
      stateRef.current.zoom = newZoom
    }

    canvas.addEventListener('mousemove', onMouseMove)
    canvas.addEventListener('mousedown', onMouseDown)
    canvas.addEventListener('mouseup', onMouseUp)
    canvas.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      canvas.removeEventListener('mousemove', onMouseMove)
      canvas.removeEventListener('mousedown', onMouseDown)
      canvas.removeEventListener('mouseup', onMouseUp)
      canvas.removeEventListener('wheel', onWheel)
    }
  }, [])

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#05050f]">
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" style={{ cursor: 'grab' }} />

      {/* ── Node type legend ── */}
      <div className="absolute bottom-4 left-4 font-mono text-xs text-white/30 space-y-1 no-select pointer-events-none">
        {Object.entries(TYPE_CONFIG).map(([type, cfg]) => (
          <div key={type} className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full inline-block" style={{ background: cfg.color }} />
            <span>{type.toUpperCase()}</span>
          </div>
        ))}
        <div className="mt-2 text-[10px] opacity-60">SCROLL TO ZOOM · DRAG TO PAN</div>
      </div>

      {/* ── Zoom controls ── */}
      <div className="absolute top-4 right-4 flex flex-col gap-1">
        {[
          { label: '+', fn: () => { stateRef.current.zoom = Math.min(8, stateRef.current.zoom * 1.3) } },
          { label: '⟲', fn: () => { stateRef.current.zoom = 1; stateRef.current.panX = 0; stateRef.current.panY = 0 } },
          { label: '−', fn: () => { stateRef.current.zoom = Math.max(0.2, stateRef.current.zoom * 0.77) } },
        ].map(btn => (
          <button
            key={btn.label}
            onClick={btn.fn}
            className="w-8 h-8 bg-white/5 hover:bg-white/10 border border-white/10 rounded text-white/50 hover:text-white/80 text-sm font-mono transition-colors"
          >
            {btn.label}
          </button>
        ))}
      </div>

      {/* ── Selected node detail ── */}
      {info && (
        <div className="absolute left-4 top-4 w-60 bg-[#0d0d1a] border border-[#a78bfa33] rounded-lg p-4 font-mono text-sm shadow-xl z-20">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[#a78bfa] text-[10px] tracking-widest">NODE INFO</span>
            <button onClick={() => setInfo(null)} className="text-white/30 hover:text-white/70 text-lg leading-none">×</button>
          </div>
          <p className="text-white font-medium mb-2">{info.label}</p>
          <div className="space-y-1 text-xs text-white/50">
            <div className="flex justify-between">
              <span>TYPE</span>
              <span style={{ color: TYPE_CONFIG[info.type]?.color }}>{info.type.toUpperCase()}</span>
            </div>
            <div className="flex justify-between">
              <span>CATEGORY</span>
              <span style={{ color: CAT_COLOR[info.category] }}>{info.category.toUpperCase()}</span>
            </div>
            <div className="flex justify-between">
              <span>TIME</span>
              <span className="text-white/80">
                {info.daysFromNow === 0
                  ? 'TODAY'
                  : info.daysFromNow > 0
                  ? `+${info.daysFromNow}d`
                  : `${info.daysFromNow}d`}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── Hover tooltip ── */}
      {hovered && !info && (
        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 bg-[#0d0d1a]/90 border border-white/10 rounded px-3 py-1.5 text-xs font-mono text-white/70 pointer-events-none">
          {hovered.label}
        </div>
      )}
    </div>
  )
}
