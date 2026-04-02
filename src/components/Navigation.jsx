import { NavLink } from 'react-router-dom'

const NAV_ITEMS = [
  {
    to: '/',
    label: 'RADAR',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5" stroke="currentColor" strokeWidth="1.5">
        <circle cx="12" cy="12" r="10" />
        <circle cx="12" cy="12" r="6" />
        <circle cx="12" cy="12" r="2" />
        <line x1="12" y1="2" x2="12" y2="12" />
      </svg>
    ),
    activeColor: 'text-[#00ff41]',
    activeBorder: 'border-[#00ff41]',
    activeGlow: 'shadow-[0_0_12px_#00ff4155]',
  },
  {
    to: '/notes',
    label: 'NOTES',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5" stroke="currentColor" strokeWidth="1.5">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14,2 14,8 20,8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
      </svg>
    ),
    activeColor: 'text-[#60a5fa]',
    activeBorder: 'border-[#60a5fa]',
    activeGlow: 'shadow-[0_0_12px_#60a5fa55]',
  },
  {
    to: '/universe',
    label: 'UNIVERSE',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5" stroke="currentColor" strokeWidth="1.5">
        <circle cx="12" cy="12" r="10" />
        <ellipse cx="12" cy="12" rx="4" ry="10" />
        <line x1="2" y1="12" x2="22" y2="12" />
        <circle cx="12" cy="5"  r="1" fill="currentColor" />
        <circle cx="18" cy="9"  r="1" fill="currentColor" />
        <circle cx="6"  cy="16" r="1" fill="currentColor" />
      </svg>
    ),
    activeColor: 'text-[#a78bfa]',
    activeBorder: 'border-[#a78bfa]',
    activeGlow: 'shadow-[0_0_12px_#a78bfa55]',
  },
]

export default function Navigation() {
  return (
    <nav className="flex items-center justify-between px-6 py-3 border-b border-white/10 bg-[#0a0f0a]/90 backdrop-blur-sm z-50 flex-shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-2 no-select">
        <svg viewBox="0 0 32 32" className="w-7 h-7 radar-glow-sm" fill="none">
          <circle cx="16" cy="16" r="14" stroke="#00ff41" strokeWidth="1.5" />
          <circle cx="16" cy="16" r="9"  stroke="#00ff41" strokeWidth="1"   opacity="0.5" />
          <circle cx="16" cy="16" r="4"  stroke="#00ff41" strokeWidth="1"   opacity="0.5" />
          <circle cx="16" cy="16" r="2"  fill="#00ff41" />
          <line x1="16" y1="2"  x2="16" y2="16" stroke="#00ff41" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="22" cy="8" r="2" fill="#00ff41" opacity="0.9" />
        </svg>
        <span className="text-[#00ff41] font-mono font-semibold tracking-widest text-sm text-glow-green">
          RADAR<span className="text-white/40">CAL</span>
        </span>
      </div>

      {/* Nav links */}
      <div className="flex items-center gap-1">
        {NAV_ITEMS.map(({ to, label, icon, activeColor, activeBorder, activeGlow }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              [
                'flex items-center gap-2 px-4 py-2 rounded-md text-xs font-mono font-medium tracking-widest transition-all duration-200 border',
                isActive
                  ? `${activeColor} ${activeBorder} ${activeGlow} bg-white/5`
                  : 'text-white/40 border-transparent hover:text-white/70 hover:bg-white/5',
              ].join(' ')
            }
          >
            {({ isActive }) => (
              <>
                <span className={isActive ? '' : 'opacity-60'}>{icon}</span>
                <span className="hidden sm:inline">{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>

      {/* Status indicator */}
      <div className="flex items-center gap-2 text-xs text-white/30 font-mono no-select">
        <span className="w-1.5 h-1.5 rounded-full bg-[#00ff41] animate-pulse" />
        <span className="hidden md:inline">LOCAL</span>
      </div>
    </nav>
  )
}
