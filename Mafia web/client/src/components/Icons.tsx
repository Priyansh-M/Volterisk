import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement>

function base(props: IconProps) {
  return {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.6,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true as const,
    ...props,
  }
}

export function IconHome(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 11.5 12 4l8 7.5" />
      <path d="M6.5 10.5V20h11V10.5" />
    </svg>
  )
}

export function IconCity(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M3 20h18" />
      <path d="M5 20V9h5v11" />
      <path d="M10 20V5h6v15" />
      <path d="M16 20v-7h3v7" />
    </svg>
  )
}

export function IconVault(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="4" y="5" width="16" height="14" rx="2" />
      <circle cx="12" cy="12" r="3" />
      <path d="M12 9.2v1.4M12 13.4v1.4M9.2 12h1.4M13.4 12h1.4" />
    </svg>
  )
}

export function IconArsenal(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M5 16.5 16.5 5l2.5 2.5L7.5 19H5z" />
      <path d="M14 7.5 16.5 10" />
    </svg>
  )
}

export function IconHeist(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="7.5" />
      <path d="M12 8.5v7M9 10.2h4.2a1.8 1.8 0 0 1 0 3.6H9" />
    </svg>
  )
}

export function IconMarket(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 8h16l-1 11H5z" />
      <path d="M8 8V6.5A4 4 0 0 1 16 6.5V8" />
    </svg>
  )
}

export function IconProfile(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="8.5" r="3" />
      <path d="M5.5 19c1.3-3 4-4.5 6.5-4.5s5.2 1.5 6.5 4.5" />
    </svg>
  )
}

export function IconBoard(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M5 19V9l4-3 3 4 3-5 4 4v10" />
      <path d="M4 19h16" />
    </svg>
  )
}

export function IconCrew(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="8" cy="9" r="2.2" />
      <circle cx="16" cy="9" r="2.2" />
      <path d="M4.5 18c.7-2.4 2.5-3.6 4.5-3.6s3.8 1.2 4.5 3.6M11 18c.7-2.4 2.5-3.6 4.5-3.6s3.8 1.2 4.5 3.6" />
    </svg>
  )
}

export function IconIntel(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="11" cy="11" r="6" />
      <path d="m20 20-3.6-3.6" />
    </svg>
  )
}

export function IconItems(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 8 12 4l8 4-8 4z" />
      <path d="M4 8v8l8 4 8-4V8" />
      <path d="M12 12v8" />
    </svg>
  )
}

export function IconProperty(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 20V9l8-5 8 5v11" />
      <path d="M10 20v-6h4v6" />
    </svg>
  )
}

export function IconFlame(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 3s3 4 3 7a3 3 0 1 1-6 0c0-1.6.7-3 2-4.5C9.5 8 8 10 8 13a4 4 0 0 0 8 0c0-3.4-2.2-6.4-4-10z" />
    </svg>
  )
}
