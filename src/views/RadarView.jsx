import { useEffect, useRef, useState } from 'react'

// ── Category sectors (wedges) ─────────────────────────────────────────────────
const CATEGORIES = [
  { id: 'work',     label: 'WORK',     color: '#00ff41', startAngle: -90, endAngle:  0  },
  { id: 'personal', label: 'PERSONAL', color: '#60a5fa', startAngle:   0, endAngle:  90 },
  { id: 'health',   label: 'HEALTH',   color: '#f472b6', startAngle:  90, endAngle: 180 },
  { id: 'other',    label: 'OTHER',    color: '#fbbf24', startAngle: 180, endAngle: 270 },
]

// ── Time rings (how far out each ring represents) ─────────────────────────────
const TIME_RINGS = [
  { label: 'TODAY',      days: 1   },
  { label: 'THIS WEEK',  days: 7   },
  { label: 'THIS MONTH', days: 30  },
  { label: 'THIS YEAR',  days: 365 },
]

// ── Demo blips (will come from DB in later stages) ────────────────────────────
const DEMO_BLIPS = [
  { id: 1, label: 'Team Standup',       category: 'work',     daysUntil: 0.3, importance: 3 },
  { id: 2, label: 'Project Deadline',   category: 'work',     daysUntil: 4,   importance: 5 },
  { id: 3, label: 'Dentist Appt',       category: 'health',   daysUntil: 2,   importance: 4 },
  { id: 4, label: 'Gym',                category: 'health',   daysUntil: 0.8, importance: 2 },
  { id: 5, label: "Mom's Birthday",     category: 'personal', daysUntil: 12,  importance: 5 },
  { id: 6, label: 'Dinner with Alex',   category: 'personal', daysUntil: 6,   importance: 3 },
  { id: 7, label: 'Car Service',        category: 'other',    daysUntil: 18,  importance: 2 },
  { id: 8, label: 'Quarterly Review',   category: 'work',     daysUntil: 28,  importance: 4 },
]

function toRad(deg) { return (deg * Math.PI) / 180 }

function blipPosition(blip, cx, cy, maxR) {
  const cat = CATEGORIES.find(c => c.id === blip.category)
  if (!cat) return { x: cx, y: cy }

  // Angle: random within the category wedge
  const seed = blip.id * 137.508
  const spreadFraction = ((seed % 100) / 100) * 0.7 + 0.15 // 15%–85% within wedge
  const angleDeg = cat.startAngle + spreadFraction * (cat.endAngle - cat.startAngle)
  const angleRad = toRad(angleDeg)

  // Distance: log scale so near-future items cluster near center
  const maxDays = 365
  const fraction = Math.log(blip.daysUntil + 1) / Math.log(maxDays + 1)
  const r = fraction * maxR * 0.85 + maxR * 0.05 // 5%–90% of radius

  return {
    x: cx + r * Math.cos(angleRad),
    y: cy + r * Math.sin(angleRad),
    r,
    angleDeg,
  }
}

export default function RadarView() {
  const svgRef = useRef(null)
  const animRef = useRef(null)
  const sweepRef = useRef(0)
  const [selected, setSelected] = useState(null)
  const [size, setSize] = useState({ w: 600, h: 600 })

  // Responsive sizing
  useEffect(() => {
    const el = svgRef.current?.parentElement
    if (!el) return
    const obs = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect
      setSize({ w: width, h: height })
    })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  // Radar sweep animation (pure CSS via SVG transform)
  useEffect(() => {
    let angle = 0
    const sweep = svgRef.current?.querySelector('#sweep-line')
    const fade  = svgRef.current?.querySelector('#sweep-fade')

    function tick() {
      angle = (angle + 0.4) % 360
      if (sweep) sweep.setAttribute('transform', `rotate(${angle}, ${size.w / 2}, ${size.h / 2})`)
      if (fade)  fade.setAttribute('transform',  `rotate(${angle}, ${size.w / 2}, ${size.h / 2})`)
      animRef.current = requestAnimationFrame(tick)
    }
    animRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(animRef.current)
  }, [size])

  const cx = size.w / 2
  const cy = size.h / 2
  const maxR = Math.min(cx, cy) * 0.88

  return (
    <div className="relative w-full h-full flex overflow-hidden bg-[#0a0f0a] scanlines">

      {/* ── SVG Radar ── */}
      <div className="flex-1 relative">
        <svg
          ref={svgRef}
          width={size.w}
          height={size.h}
          className="absolute inset-0"
          style={{ width: '100%', height: '100%' }}
        >
          <defs>
            {/* Sweep gradient */}
            <linearGradient id="sweepGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%"   stopColor="#00ff41" stopOpacity="0" />
              <stop offset="100%" stopColor="#00ff41" stopOpacity="0.35" />
            </linearGradient>

            {/* Radial fade for edges */}
            <radialGradient id="radarFade" cx="50%" cy="50%" r="50%">
              <stop offset="0%"   stopColor="#0a0f0a" stopOpacity="0" />
              <stop offset="100%" stopColor="#0a0f0a" stopOpacity="0.5" />
            </radialGradient>

            {/* Category wedge clip */}
            <clipPath id="radarClip">
              <circle cx={cx} cy={cy} r={maxR} />
            </clipPath>

            {/* Blip glow filter */}
            <filter id="blipGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* ── Background circle ── */}
          <circle cx={cx} cy={cy} r={maxR + 2} fill="#050a05" stroke="#00ff4122" strokeWidth="1" />

          {/* ── Category wedge fills ── */}
          {CATEGORIES.map(cat => {
            const startRad = toRad(cat.startAngle)
            const endRad   = toRad(cat.endAngle)
            const x1 = cx + maxR * Math.cos(startRad)
            const y1 = cy + maxR * Math.sin(startRad)
            const x2 = cx + maxR * Math.cos(endRad)
            const y2 = cy + maxR * Math.sin(endRad)
            const largeArc = (cat.endAngle - cat.startAngle) > 180 ? 1 : 0
            return (
              <path
                key={cat.id}
                d={`M ${cx} ${cy} L ${x1} ${y1} A ${maxR} ${maxR} 0 ${largeArc} 1 ${x2} ${y2} Z`}
                fill={cat.color}
                opacity="0.04"
                clipPath="url(#radarClip)"
              />
            )
          })}

          {/* ── Category separator lines ── */}
          {CATEGORIES.map(cat => {
            const rad = toRad(cat.startAngle)
            return (
              <line
                key={cat.id}
                x1={cx} y1={cy}
                x2={cx + maxR * Math.cos(rad)}
                y2={cy + maxR * Math.sin(rad)}
                stroke="#00ff4120"
                strokeWidth="1"
                strokeDasharray="4 4"
              />
            )
          })}

          {/* ── Category labels ── */}
          {CATEGORIES.map(cat => {
            const midAngle = toRad((cat.startAngle + cat.endAngle) / 2)
            const labelR = maxR * 0.94
            return (
              <text
                key={cat.id}
                x={cx + labelR * Math.cos(midAngle)}
                y={cy + labelR * Math.sin(midAngle)}
                fill={cat.color}
                opacity="0.5"
                fontSize="9"
                fontFamily="JetBrains Mono, monospace"
                fontWeight="500"
                letterSpacing="2"
                textAnchor="middle"
                dominantBaseline="middle"
              >
                {cat.label}
              </text>
            )
          })}

          {/* ── Time rings ── */}
          {TIME_RINGS.map((ring, i) => {
            const fraction = Math.log(ring.days + 1) / Math.log(366)
            const r = fraction * maxR * 0.85 + maxR * 0.05
            return (
              <g key={ring.label}>
                <circle cx={cx} cy={cy} r={r} fill="none" stroke="#00ff4115" strokeWidth="1" />
                <text
                  x={cx + r + 4}
                  y={cy - 4}
                  fill="#00ff4140"
                  fontSize="8"
                  fontFamily="JetBrains Mono, monospace"
                  letterSpacing="1"
                >
                  {ring.label}
                </text>
              </g>
            )
          })}

          {/* ── Cross hairs ── */}
          <line x1={cx - maxR} y1={cy} x2={cx + maxR} y2={cy} stroke="#00ff4110" strokeWidth="1" />
          <line x1={cx} y1={cy - maxR} x2={cx} y2={cy + maxR} stroke="#00ff4110" strokeWidth="1" />

          {/* ── Sweep animation (rotated by JS) ── */}
          <g id="sweep-fade" style={{ transformOrigin: `${cx}px ${cy}px` }}>
            <path
              d={`M ${cx} ${cy} L ${cx + maxR} ${cy} A ${maxR} ${maxR} 0 0 0 ${cx + maxR * Math.cos(toRad(-60))} ${cy + maxR * Math.sin(toRad(-60))} Z`}
              fill="url(#sweepGrad)"
              opacity="0.6"
              clipPath="url(#radarClip)"
            />
          </g>
          <g id="sweep-line" style={{ transformOrigin: `${cx}px ${cy}px` }}>
            <line
              x1={cx} y1={cy}
              x2={cx + maxR} y2={cy}
              stroke="#00ff41"
              strokeWidth="1.5"
              opacity="0.7"
            />
          </g>

          {/* ── Edge fade overlay ── */}
          <circle cx={cx} cy={cy} r={maxR} fill="url(#radarFade)" pointerEvents="none" />

          {/* ── Blips ── */}
          {DEMO_BLIPS.map(blip => {
            const pos = blipPosition(blip, cx, cy, maxR)
            const cat = CATEGORIES.find(c => c.id === blip.category)
            const baseR = 4 + blip.importance * 1.5  // 5.5 – 11.5px
            const isSelected = selected?.id === blip.id
            return (
              <g
                key={blip.id}
                onClick={() => setSelected(isSelected ? null : blip)}
                style={{ cursor: 'pointer' }}
                filter="url(#blipGlow)"
              >
                {/* Pulse ring */}
                <circle
                  cx={pos.x} cy={pos.y}
                  r={baseR + 4}
                  fill="none"
                  stroke={cat?.color}
                  strokeWidth="1"
                  opacity={isSelected ? 0.6 : 0.2}
                  className={isSelected ? 'animate-ping' : ''}
                />
                {/* Main blip */}
                <circle
                  cx={pos.x} cy={pos.y}
                  r={baseR}
                  fill={cat?.color}
                  opacity={isSelected ? 1 : 0.85}
                />
                {/* Center dot */}
                <circle cx={pos.x} cy={pos.y} r={2} fill="#0a0f0a" />
              </g>
            )
          })}

          {/* ── Center dot ── */}
          <circle cx={cx} cy={cy} r={5} fill="#00ff41" className="radar-glow" />
          <circle cx={cx} cy={cy} r={2} fill="#0a0f0a" />
        </svg>
      </div>

      {/* ── Selected blip detail panel ── */}
      {selected && (
        <div className="absolute right-4 top-4 w-64 bg-[#0d1a0d] border border-[#00ff4133] rounded-lg p-4 font-mono text-sm shadow-xl z-20">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[#00ff41] text-xs tracking-widest">SIGNAL DETECTED</span>
            <button onClick={() => setSelected(null)} className="text-white/30 hover:text-white/70 text-lg leading-none">×</button>
          </div>
          <p className="text-white font-medium mb-2">{selected.label}</p>
          <div className="space-y-1 text-xs text-white/50">
            <div className="flex justify-between">
              <span>CATEGORY</span>
              <span style={{ color: CATEGORIES.find(c => c.id === selected.category)?.color }}>
                {selected.category.toUpperCase()}
              </span>
            </div>
            <div className="flex justify-between">
              <span>IN</span>
              <span className="text-white/80">
                {selected.daysUntil < 1
                  ? `${Math.round(selected.daysUntil * 24)}h`
                  : `${Math.round(selected.daysUntil)}d`}
              </span>
            </div>
            <div className="flex justify-between">
              <span>IMPORTANCE</span>
              <span className="text-white/80">{'█'.repeat(selected.importance)}{'░'.repeat(5 - selected.importance)}</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Legend ── */}
      <div className="absolute bottom-4 left-4 font-mono text-xs text-white/30 space-y-1 no-select">
        {CATEGORIES.map(cat => (
          <div key={cat.id} className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full inline-block" style={{ background: cat.color }} />
            <span>{cat.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
