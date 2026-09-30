import { useId, type ReactNode } from 'react'

export function InkPlate({ children, className = 'h-full w-full' }: { children: ReactNode; className?: string }) {
  const raw = useId().replace(/:/g, '')
  const grain = `grain-${raw}`
  const wobble = `wobble-${raw}`
  return (
    <svg viewBox="0 0 220 140" className={className} aria-hidden="true">
      <defs>
        <filter id={grain} x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="4" />
          <feColorMatrix type="matrix" values="0 0 0 0 0.22  0 0 0 0 0.18  0 0 0 0 0.13  0 0 0 0.35 0" />
        </filter>
        <filter id={wobble}>
          <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="9" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="1.6" />
        </filter>
      </defs>
      <rect width="220" height="140" fill="#14110e" />
      <rect width="220" height="140" filter={`url(#${grain})`} />
      <path d="M12 18 H198 M16 122 H206" stroke="#3c342c" strokeWidth="0.7" />
      <g fill="none" strokeLinecap="round" strokeLinejoin="round" filter={`url(#${wobble})`}>
        {children}
      </g>
    </svg>
  )
}
