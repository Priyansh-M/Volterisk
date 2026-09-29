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

export function WeaponArt({ id }: { id: string }) {
  switch (id) {
    case 'weapon:0001':
      return (
        <Frame>
          <g transform="translate(28,28) rotate(-28 82 42)" fill="none" stroke="#c9b08a" strokeWidth="5" strokeLinecap="round">
            <path d="M18 78 L132 22" />
            <path d="M18 78 q-10 10 2 16" stroke="#a88862" />
            <path d="M126 18 q18 -6 22 10" />
          </g>
          <circle cx="168" cy="36" r="4" fill="#e2c075" opacity="0.7" />
        </Frame>
      )
    case 'weapon:0002':
      return (
        <Frame>
          <rect x="58" y="30" width="104" height="78" rx="8" fill="#1a1e28" stroke="#8aa0c2" strokeWidth="3" />
          <rect x="70" y="42" width="80" height="10" rx="3" fill="#6d7c96" />
          <path d="M78 66 h16 v28 M110 66 v34 M142 66 h-10 v28" fill="none" stroke="#d8c6a2" strokeWidth="3" strokeLinecap="round" />
        </Frame>
      )
    case 'weapon:0003':
      return (
        <Frame>
          <g transform="translate(40,36)" fill="none" stroke="#b7c0cf" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
            <rect x="8" y="28" width="86" height="36" rx="10" fill="#2a3140" stroke="#8aa0c2" />
            <path d="M94 46 h48" stroke="#d0d6e0" strokeWidth="8" />
            <circle cx="150" cy="46" r="10" stroke="#e2c075" />
            <path d="M28 28 v-16 h24" />
            <rect x="20" y="64" width="28" height="18" rx="4" fill="#3a4254" />
          </g>
        </Frame>
      )
    case 'weapon:0004':
      return (
        <Frame>
          <g transform="translate(34,40)" strokeLinecap="round">
            <path d="M12 70 L86 28" stroke="#9aa4b6" strokeWidth="8" />
            <path d="M86 28 L118 18" stroke="#6d778c" strokeWidth="5" />
            <path d="M118 18 c18 -8 28 10 16 22 c-10 8 -22 4 -16 -6" fill="#e2c075" stroke="#f0d58a" strokeWidth="2" />
            <circle cx="24" cy="74" r="8" fill="#2a3140" stroke="#8aa0c2" strokeWidth="3" />
          </g>
        </Frame>
      )
    case 'weapon:0005':
      return (
        <Frame>
          <g transform="translate(30,32)" fill="none" stroke="#c9b08a" strokeWidth="4" strokeLinejoin="round">
            <rect x="8" y="48" width="70" height="34" rx="6" fill="#2a2430" />
            <path d="M78 58 h52 v18 h-16 l-10 22 h-26" stroke="#8aa0c2" />
            <rect x="130" y="22" width="28" height="78" rx="4" fill="#3a3140" stroke="#e2c075" />
            <path d="M22 48 v-18 h40 v18" />
          </g>
        </Frame>
      )
    default:
      return (
        <Frame>
          <circle cx="110" cy="70" r="22" fill="none" stroke="#e2c075" strokeWidth="3" />
        </Frame>
      )
  }
}
