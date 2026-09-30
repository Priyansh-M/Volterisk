import type { ReactNode } from 'react'

export function InkPlate({ children, className = 'h-full w-full' }: { children: ReactNode; className?: string }) {
  return (
    <svg viewBox="0 0 220 140" className={className} aria-hidden="true">
      <rect width="220" height="140" fill="#14110e" />
      <path d="M12 18 H198 M16 122 H206" stroke="#3c342c" strokeWidth="0.7" />
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        {children}
      </g>
    </svg>
  )
}
