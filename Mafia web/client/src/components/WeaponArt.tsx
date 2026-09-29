import type { ReactNode, SVGProps } from 'react'

function Frame({ children, ...props }: SVGProps<SVGSVGElement> & { children: ReactNode }) {
  return (
    <svg viewBox="0 0 220 140" className="h-full w-full" aria-hidden="true" {...props}>
      <defs>
        <linearGradient id="wbg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#232836" />
          <stop offset="100%" stopColor="#12151c" />
        </linearGradient>
      </defs>
      <rect width="220" height="140" rx="16" fill="url(#wbg)" />
      <rect x="1" y="1" width="218" height="138" rx="15" fill="none" stroke="rgba(255,255,255,0.06)" />
      {children}
    </svg>
  )
}

const ink = '#c9b08a'
const steel = '#8aa0c2'
const gold = '#e2c075'

export function WeaponArt({ id }: { id: string }) {
  switch (id) {
    case 'weapon:0001':
      return (
        <Frame>
          <g transform="translate(28,28) rotate(-28 82 42)" fill="none" stroke={ink} strokeWidth="5" strokeLinecap="round">
            <path d="M18 78 L132 22" />
            <path d="M18 78 q-10 10 2 16" stroke="#a88862" />
            <path d="M126 18 q18 -6 22 10" />
          </g>
        </Frame>
      )
    case 'weapon:0002':
      return (
        <Frame>
          <g fill="none" stroke={steel} strokeWidth="3" strokeLinecap="round">
            <path d="M36 88 C70 20 150 20 184 88" stroke={gold} strokeWidth="2" />
            <path d="M48 80 C78 34 142 34 172 80" />
            <circle cx="40" cy="92" r="7" fill="#2a3140" />
            <circle cx="180" cy="92" r="7" fill="#2a3140" />
          </g>
        </Frame>
      )
    case 'weapon:0003':
      return (
        <Frame>
          <g transform="translate(36,38)" fill="none" stroke={steel} strokeWidth="3">
            <rect x="8" y="28" width="70" height="28" rx="6" fill="#2a3140" />
            <path d="M78 42 h46" stroke={ink} strokeWidth="8" strokeLinecap="round" />
            <path d="M124 28 v28" stroke={gold} strokeWidth="4" />
            <path d="M20 28 v-14 h22" strokeLinecap="round" />
          </g>
        </Frame>
      )
    case 'weapon:0004':
      return (
        <Frame>
          <rect x="58" y="30" width="104" height="78" rx="8" fill="#1a1e28" stroke={steel} strokeWidth="3" />
          <rect x="70" y="42" width="80" height="10" rx="3" fill="#6d7c96" />
          <path d="M78 66 h16 v28 M110 66 v34 M142 66 h-10 v28" fill="none" stroke="#d8c6a2" strokeWidth="3" strokeLinecap="round" />
        </Frame>
      )
    case 'weapon:0005':
      return (
        <Frame>
          <g transform="translate(48,36)" fill="none" stroke={ink} strokeWidth="4" strokeLinejoin="round">
            <path d="M20 78 L92 18 L104 30 L40 86 Z" fill="#2a2430" />
            <path d="M92 18 L128 8" stroke={gold} />
            <rect x="8" y="78" width="36" height="14" rx="3" fill="#3a3140" stroke={steel} />
          </g>
        </Frame>
      )
    case 'weapon:0006':
      return (
        <Frame>
          <g transform="translate(28,44)" fill="none" stroke={steel} strokeWidth="4" strokeLinecap="round">
            <rect x="6" y="16" width="48" height="36" rx="8" fill="#2a3140" />
            <path d="M54 34 h70" stroke={ink} strokeWidth="10" />
            <path d="M124 18 v32" stroke={gold} strokeWidth="8" />
            <path d="M18 16 v-10 M36 16 v-10" />
          </g>
        </Frame>
      )
    case 'weapon:0007':
      return (
        <Frame>
          <g transform="translate(40,36)" fill="none" stroke="#b7c0cf" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
            <rect x="8" y="28" width="86" height="36" rx="10" fill="#2a3140" stroke={steel} />
            <path d="M94 46 h48" stroke="#d0d6e0" strokeWidth="8" />
            <circle cx="150" cy="46" r="10" stroke={gold} />
            <path d="M28 28 v-16 h24" />
            <rect x="20" y="64" width="28" height="18" rx="4" fill="#3a4254" />
          </g>
        </Frame>
      )
    case 'weapon:0008':
      return (
        <Frame>
          <g transform="translate(40,34)" fill="none" stroke={steel} strokeWidth="3">
            <path d="M16 20 h36 v56 h-36 z" fill="#243044" />
            <path d="M112 20 h36 v56 h-36 z" fill="#243044" />
            <path d="M52 48 h60" stroke={gold} strokeWidth="6" />
            <path d="M70 28 v40" stroke={ink} />
          </g>
        </Frame>
      )
    case 'weapon:0009':
      return (
        <Frame>
          <g transform="translate(46,28)" fill="none" stroke={gold} strokeWidth="3">
            <path d="M64 8 v88" stroke={steel} strokeWidth="6" />
            <path d="M24 28 q40 16 80 0" />
            <path d="M16 48 q48 22 96 0" />
            <path d="M24 68 q40 16 80 0" />
            <circle cx="64" cy="100" r="8" fill="#2a3140" stroke={ink} />
          </g>
        </Frame>
      )
    case 'weapon:0010':
      return (
        <Frame>
          <g transform="translate(34,40)" strokeLinecap="round">
            <path d="M12 70 L86 28" stroke="#9aa4b6" strokeWidth="8" />
            <path d="M86 28 L118 18" stroke="#6d778c" strokeWidth="5" />
            <path d="M118 18 c18 -8 28 10 16 22 c-10 8 -22 4 -16 -6" fill={gold} stroke="#f0d58a" strokeWidth="2" />
            <circle cx="24" cy="74" r="8" fill="#2a3140" stroke={steel} strokeWidth="3" />
          </g>
        </Frame>
      )
    case 'weapon:0011':
      return (
        <Frame>
          <g transform="translate(36,40)" fill="none" stroke={steel} strokeWidth="3">
            <path d="M20 40 h50 l16 -22 h40 l16 22 h20" stroke={gold} />
            <path d="M70 40 v28 h48 v-28" />
            <path d="M86 52 h16" stroke={ink} strokeWidth="4" />
          </g>
        </Frame>
      )
    case 'weapon:0012':
      return (
        <Frame>
          <g transform="translate(40,32)" fill="none" stroke={gold} strokeWidth="3" strokeLinejoin="round">
            <rect x="18" y="28" width="90" height="40" rx="8" fill="#241c28" stroke={steel} />
            <path d="M40 48 l14 -16 l8 22 l12 -18 l10 12" />
            <circle cx="130" cy="48" r="14" stroke={ink} />
          </g>
        </Frame>
      )
    case 'weapon:0013':
      return (
        <Frame>
          <g transform="translate(30,32)" fill="none" stroke={ink} strokeWidth="4" strokeLinejoin="round">
            <rect x="8" y="48" width="70" height="34" rx="6" fill="#2a2430" />
            <path d="M78 58 h52 v18 h-16 l-10 22 h-26" stroke={steel} />
            <rect x="130" y="22" width="28" height="78" rx="4" fill="#3a3140" stroke={gold} />
            <path d="M22 48 v-18 h40 v18" />
          </g>
        </Frame>
      )
    case 'weapon:0014':
      return (
        <Frame>
          <g transform="translate(34,30)" fill="none" stroke={steel} strokeWidth="4">
            <rect x="8" y="8" width="130" height="22" rx="4" fill="#2a3140" />
            <rect x="8" y="78" width="130" height="22" rx="4" fill="#2a3140" />
            <path d="M40 30 v48 M108 30 v48" stroke={gold} />
            <rect x="58" y="42" width="40" height="24" fill="#3a3140" stroke={ink} />
          </g>
        </Frame>
      )
    case 'weapon:0015':
      return (
        <Frame>
          <g transform="translate(50,24)" fill="none" stroke={gold} strokeWidth="3">
            <path d="M60 8 L78 92" stroke={ink} strokeWidth="7" strokeLinecap="round" />
            <path d="M20 40 q40 -20 80 0" />
            <path d="M12 58 q48 -16 96 0" />
            <path d="M20 76 q40 -12 80 0" />
            <path d="M48 92 h24" stroke={steel} strokeWidth="6" />
          </g>
        </Frame>
      )
    default:
      return (
        <Frame>
          <circle cx="110" cy="70" r="22" fill="none" stroke={gold} strokeWidth="3" />
        </Frame>
      )
  }
}
