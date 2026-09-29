import { Link } from 'react-router-dom'

const spots = [
  { to: '/', label: 'Safehouse', x: '18%', y: '28%', hint: 'Home ledger' },
  { to: '/vault', label: 'Counting House', x: '46%', y: '22%', hint: 'Your vault' },
  { to: '/heists', label: 'Job Street', x: '28%', y: '58%', hint: 'Open heists' },
  { to: '/market', label: 'Night Market', x: '62%', y: '48%', hint: 'Buy tools' },
  { to: '/arsenal', label: 'Tool Yard', x: '78%', y: '30%', hint: 'Equip & upgrade' },
  { to: '/leaderboard', label: 'Rank Hall', x: '72%', y: '68%', hint: 'City standings' },
]

export function CityMap() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-line bg-[#0c1018]">
      <svg viewBox="0 0 900 520" className="block h-auto w-full" aria-hidden="true">
        <defs>
          <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#141a28" />
            <stop offset="55%" stopColor="#0e1320" />
            <stop offset="100%" stopColor="#0a0d14" />
          </linearGradient>
          <linearGradient id="river" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#1a2438" />
            <stop offset="100%" stopColor="#24324a" />
          </linearGradient>
          <linearGradient id="bldg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2a3144" />
            <stop offset="100%" stopColor="#161b28" />
          </linearGradient>
        </defs>
        <rect width="900" height="520" fill="url(#sky)" />
        <circle cx="780" cy="70" r="28" fill="#d9d2c3" opacity="0.14" />
        <circle cx="120" cy="50" r="1.6" fill="#f0ece4" opacity="0.5" />
        <circle cx="200" cy="90" r="1.2" fill="#f0ece4" opacity="0.35" />
        <circle cx="540" cy="40" r="1.4" fill="#f0ece4" opacity="0.4" />
        <circle cx="640" cy="86" r="1" fill="#f0ece4" opacity="0.3" />
        <path d="M0 250 C 180 210, 280 310, 450 280 S 720 220, 900 270 L 900 520 L 0 520 Z" fill="#10151f" />
        <path d="M0 330 C 160 300, 300 390, 470 360 S 740 300, 900 350 L 900 410 C 720 370, 520 430, 340 400 S 120 360, 0 390 Z" fill="url(#river)" opacity="0.55" />
        <g opacity="0.9">
          <rect x="40" y="168" width="70" height="150" fill="url(#bldg)" />
          <rect x="118" y="128" width="54" height="190" fill="#1c2332" />
          <rect x="180" y="150" width="90" height="168" fill="url(#bldg)" />
          <rect x="290" y="110" width="46" height="208" fill="#222a3c" />
          <rect x="350" y="168" width="120" height="150" fill="#1a2130" />
          <rect x="490" y="132" width="64" height="186" fill="url(#bldg)" />
          <rect x="568" y="96" width="50" height="222" fill="#252c3e" />
          <rect x="640" y="150" width="110" height="168" fill="#1b2232" />
          <rect x="770" y="122" width="72" height="196" fill="url(#bldg)" />
        </g>
        <g fill="#e2c075" opacity="0.28">
          <rect x="52" y="186" width="8" height="8" />
          <rect x="72" y="210" width="8" height="8" />
          <rect x="132" y="150" width="8" height="8" />
          <rect x="200" y="176" width="8" height="8" />
          <rect x="304" y="140" width="8" height="8" />
          <rect x="380" y="190" width="8" height="8" />
          <rect x="508" y="160" width="8" height="8" />
          <rect x="582" y="120" width="8" height="8" />
          <rect x="670" y="180" width="8" height="8" />
          <rect x="792" y="150" width="8" height="8" />
        </g>
        <path d="M0 420 H900" stroke="rgba(255,255,255,0.06)" />
        <path d="M80 250 C 200 300, 340 240, 500 300 S 760 250, 900 310" fill="none" stroke="rgba(226,192,117,0.12)" strokeWidth="3" />
        <text x="450" y="42" textAnchor="middle" fill="#9a9488" fontSize="13" letterSpacing="6" fontFamily="Outfit, sans-serif">
          CITY MAP
        </text>
      </svg>
      {spots.map((spot) => (
        <Link
          key={spot.to}
          to={spot.to}
          className="city-hotspot absolute -translate-x-1/2 -translate-y-1/2 text-center no-underline"
          style={{ left: spot.x, top: spot.y }}
        >
          <span className="city-pin mx-auto flex h-11 w-11 items-center justify-center rounded-2xl border border-gold/30 bg-panel/90 gloss">
            <BuildingGlyph name={spot.label} />
          </span>
          <span className="mt-1 block font-serif text-sm tracking-wide text-paper drop-shadow-[0_1px_4px_rgba(0,0,0,0.8)]">
            {spot.label}
          </span>
          <span className="block text-[11px] text-muted">{spot.hint}</span>
        </Link>
      ))}
    </div>
  )
}

function BuildingGlyph({ name }: { name: string }) {
  const common = {
    viewBox: '0 0 24 24',
    className: 'h-5 w-5 text-gold',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.7,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }
  if (name === 'Safehouse') {
    return (
      <svg {...common}>
        <path d="M4 11 12 4l8 7" />
        <path d="M6 10.5V20h12V10.5" />
      </svg>
    )
  }
  if (name === 'Counting House') {
    return (
      <svg {...common}>
        <rect x="4" y="6" width="16" height="13" rx="1.5" />
        <circle cx="12" cy="12.5" r="2.6" />
      </svg>
    )
  }
  if (name === 'Job Street') {
    return (
      <svg {...common}>
        <path d="M4 19V8l5-3 3 4 4-4 4 3v11" />
      </svg>
    )
  }
  if (name === 'Night Market') {
    return (
      <svg {...common}>
        <path d="M4 9h16l-1.2 10H5.2z" />
        <path d="M8 9V7a4 4 0 0 1 8 0v2" />
      </svg>
    )
  }
  if (name === 'Tool Yard') {
    return (
      <svg {...common}>
        <path d="M5 16 16 5l3 3L8 19H5z" />
      </svg>
    )
  }
  return (
    <svg {...common}>
      <path d="M5 19V8l7-4 7 4v11" />
      <path d="M10 19v-6h4v6" />
    </svg>
  )
}
