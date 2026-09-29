import type { SVGProps } from 'react'

/**
 * One line-drawn set. Every glyph shares the same 24-unit box, 1.4 stroke,
 * round caps, no fills, and inherits currentColor. Nothing here is an emoji
 * or a downloaded asset.
 */
export type IconProps = SVGProps<SVGSVGElement> & { size?: number }

function Glyph({ size = 18, children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  )
}

export function IconCommand(props: IconProps) {
  return (
    <Glyph {...props}>
      <rect x="3" y="4" width="18" height="16" rx="1.5" />
      <path d="M3 9h18" />
      <path d="M9 9v11" />
      <path d="M12.5 13h5.5" />
      <path d="M12.5 16.5h3.5" />
    </Glyph>
  )
}

export function IconTarget(props: IconProps) {
  return (
    <Glyph {...props}>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="3" />
      <path d="M12 1.8v3.4M12 18.8v3.4M1.8 12h3.4M18.8 12h3.4" />
    </Glyph>
  )
}

export function IconVault(props: IconProps) {
  return (
    <Glyph {...props}>
      <rect x="3" y="4" width="18" height="16" rx="1.5" />
      <circle cx="11" cy="12" r="4.2" />
      <path d="M11 7.8v8.4M6.8 12h8.4" opacity="0.65" />
      <path d="M18 9.5v5" />
    </Glyph>
  )
}

export function IconTool(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M4 19.5 13.5 10" />
      <path d="M12 8.5 15.5 5a3.6 3.6 0 0 1 5 5l-3.5 3.5" />
      <path d="M3.4 18.2a2 2 0 0 0 2.4 2.4" />
      <path d="M15.2 13.4 19.8 18a1.8 1.8 0 0 1-2.6 2.6l-4.6-4.6" />
    </Glyph>
  )
}

export function IconBuilding(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M4 20V7.5l7-3.5v16" />
      <path d="M11 11h9v9" />
      <path d="M2.5 20h19" />
      <path d="M6.8 9.6v1.6M6.8 13.2v1.6M14.4 14h2.6M14.4 17h2.6" />
    </Glyph>
  )
}

export function IconContract(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M6 3h8.5L19 7.5V21H6z" />
      <path d="M14 3v5h5" />
      <path d="M8.8 12.5h6.4M8.8 15.5h6.4M8.8 18.2h3.6" />
    </Glyph>
  )
}

export function IconMap(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M3 6.4 9 4l6 2.4L21 4v13.6L15 20l-6-2.4L3 20z" />
      <path d="M9 4v13.6M15 6.4V20" />
    </Glyph>
  )
}

export function IconSeal(props: IconProps) {
  return (
    <Glyph {...props}>
      <circle cx="12" cy="9.5" r="5.5" />
      <path d="M12 6.8v5.4M9.3 9.5h5.4" opacity="0.6" />
      <path d="M8.4 14.4 7 21l5-2.4L17 21l-1.4-6.6" />
    </Glyph>
  )
}

export function IconIdCard(props: IconProps) {
  return (
    <Glyph {...props}>
      <rect x="2.5" y="5" width="19" height="14" rx="1.5" />
      <circle cx="8.5" cy="11" r="2.2" />
      <path d="M5.2 16.2c.7-1.6 2-2.4 3.3-2.4s2.6.8 3.3 2.4" />
      <path d="M14.8 10h4.2M14.8 13h4.2" />
    </Glyph>
  )
}

export function IconRanking(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M3 20h18" />
      <rect x="4" y="12" width="4" height="8" />
      <rect x="10" y="7" width="4" height="13" />
      <rect x="16" y="15" width="4" height="5" />
    </Glyph>
  )
}

export function IconSignal(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M12 13.5v7" />
      <circle cx="12" cy="11" r="2" />
      <path d="M7.8 15.2a6 6 0 0 1 0-8.4" />
      <path d="M16.2 6.8a6 6 0 0 1 0 8.4" />
      <path d="M5 18a9.6 9.6 0 0 1 0-14" opacity="0.55" />
      <path d="M19 4a9.6 9.6 0 0 1 0 14" opacity="0.55" />
    </Glyph>
  )
}

export function IconSliders(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M4 7h16M4 12h16M4 17h16" />
      <circle cx="9" cy="7" r="2" />
      <circle cx="15" cy="12" r="2" />
      <circle cx="7.5" cy="17" r="2" />
    </Glyph>
  )
}

export function IconKey(props: IconProps) {
  return (
    <Glyph {...props}>
      <circle cx="8" cy="8" r="4" />
      <path d="M10.9 10.9 20 20" />
      <path d="M16.4 16.4l-2 2M18.4 18.4l-2 2" />
    </Glyph>
  )
}

export function IconChevronLeft(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M14.5 5 8 12l6.5 7" />
    </Glyph>
  )
}

export function IconChevronRight(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M9.5 5 16 12l-6.5 7" />
    </Glyph>
  )
}

export function IconChevronDown(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M5 9.5 12 16l7-6.5" />
    </Glyph>
  )
}

export function IconClose(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M5.5 5.5l13 13M18.5 5.5l-13 13" />
    </Glyph>
  )
}

export function IconMenu(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M3.5 6.5h17M3.5 12h17M3.5 17.5h17" />
    </Glyph>
  )
}

export function IconPlus(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M12 5v14M5 12h14" />
    </Glyph>
  )
}

export function IconMinus(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M5 12h14" />
    </Glyph>
  )
}

export function IconCrosshair(props: IconProps) {
  return (
    <Glyph {...props}>
      <circle cx="12" cy="12" r="6.5" />
      <path d="M12 2.5v4M12 17.5v4M2.5 12h4M17.5 12h4" />
      <circle cx="12" cy="12" r="1" />
    </Glyph>
  )
}

export function IconLock(props: IconProps) {
  return (
    <Glyph {...props}>
      <rect x="5" y="10.5" width="14" height="10" rx="1.5" />
      <path d="M8.2 10.5V8a3.8 3.8 0 0 1 7.6 0v2.5" />
      <path d="M12 14v3" />
    </Glyph>
  )
}

export function IconShield(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M12 3 5 5.6v6.2c0 4 2.9 7.3 7 9.2 4.1-1.9 7-5.2 7-9.2V5.6z" />
      <path d="M9.2 12.2l2 2.2 3.6-4.4" />
    </Glyph>
  )
}

export function IconCheck(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M4.5 12.8l4.6 4.7L19.5 7" />
    </Glyph>
  )
}

export function IconAlert(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M12 3.5 21 19.5H3z" />
      <path d="M12 9.5v4.4M12 16.6v.1" />
    </Glyph>
  )
}

export function IconClock(props: IconProps) {
  return (
    <Glyph {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.2V12l3.4 2.2" />
    </Glyph>
  )
}

export function IconPin(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M12 21s6.2-6.1 6.2-10.4A6.2 6.2 0 0 0 5.8 10.6C5.8 14.9 12 21 12 21z" />
      <circle cx="12" cy="10.4" r="2.2" />
    </Glyph>
  )
}

export function IconCompass(props: IconProps) {
  return (
    <Glyph {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M14.8 9.2 10.4 10.4 9.2 14.8l4.4-1.2z" />
    </Glyph>
  )
}

export function IconEye(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M2.5 12S6 6.5 12 6.5 21.5 12 21.5 12 18 17.5 12 17.5 2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="2.6" />
    </Glyph>
  )
}

export function IconBanknote(props: IconProps) {
  return (
    <Glyph {...props}>
      <rect x="2.5" y="6.5" width="19" height="11" rx="1.5" />
      <circle cx="12" cy="12" r="2.6" />
      <path d="M5.6 9.4v.1M18.4 14.6v.1" />
    </Glyph>
  )
}

export function IconArrowUpRight(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M7 17 17 7" />
      <path d="M9.5 7H17v7.5" />
    </Glyph>
  )
}

export function IconArrowDownRight(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M7 7l10 10" />
      <path d="M17 9.5V17H9.5" />
    </Glyph>
  )
}

export function IconLogout(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M14 4.5H6.5v15H14" />
      <path d="M11.5 12h9" />
      <path d="M17.8 8.8 21 12l-3.2 3.2" />
    </Glyph>
  )
}

export function IconFolder(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M3 6.5h6l2 2.5h10V19H3z" />
      <path d="M3 10.6h18" opacity="0.6" />
    </Glyph>
  )
}

export function IconRefresh(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M20 12a8 8 0 1 1-2.6-5.9" />
      <path d="M20.5 4.5V9H16" />
    </Glyph>
  )
}

/** Shell glyphs from the existing night ledger. Same stroke, same 24 box. */
function shellGlyph(props: IconProps) {
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
    <svg {...shellGlyph(props)}>
      <path d="M4 11.5 12 4l8 7.5" />
      <path d="M6.5 10.5V20h11V10.5" />
    </svg>
  )
}

export function IconCity(props: IconProps) {
  return (
    <svg {...shellGlyph(props)}>
      <path d="M3 20h18" />
      <path d="M5 20V9h5v11" />
      <path d="M10 20V5h6v15" />
      <path d="M16 20v-7h3v7" />
    </svg>
  )
}

export function IconArsenal(props: IconProps) {
  return (
    <svg {...shellGlyph(props)}>
      <path d="M5 16.5 16.5 5l2.5 2.5L7.5 19H5z" />
      <path d="M14 7.5 16.5 10" />
    </svg>
  )
}

export function IconHeist(props: IconProps) {
  return (
    <svg {...shellGlyph(props)}>
      <circle cx="12" cy="12" r="7.5" />
      <path d="M12 8.5v7M9 10.2h4.2a1.8 1.8 0 0 1 0 3.6H9" />
    </svg>
  )
}

export function IconMarket(props: IconProps) {
  return (
    <svg {...shellGlyph(props)}>
      <path d="M4 8h16l-1 11H5z" />
      <path d="M8 8V6.5A4 4 0 0 1 16 6.5V8" />
    </svg>
  )
}

export function IconProfile(props: IconProps) {
  return (
    <svg {...shellGlyph(props)}>
      <circle cx="12" cy="8.5" r="3" />
      <path d="M5.5 19c1.3-3 4-4.5 6.5-4.5s5.2 1.5 6.5 4.5" />
    </svg>
  )
}

export function IconBoard(props: IconProps) {
  return (
    <svg {...shellGlyph(props)}>
      <path d="M5 19V9l4-3 3 4 3-5 4 4v10" />
      <path d="M4 19h16" />
    </svg>
  )
}

export function IconCrew(props: IconProps) {
  return (
    <svg {...shellGlyph(props)}>
      <circle cx="8" cy="9" r="2.2" />
      <circle cx="16" cy="9" r="2.2" />
      <path d="M4.5 18c.7-2.4 2.5-3.6 4.5-3.6s3.8 1.2 4.5 3.6M11 18c.7-2.4 2.5-3.6 4.5-3.6s3.8 1.2 4.5 3.6" />
    </svg>
  )
}

export function IconIntel(props: IconProps) {
  return (
    <svg {...shellGlyph(props)}>
      <circle cx="11" cy="11" r="6" />
      <path d="m20 20-3.6-3.6" />
    </svg>
  )
}

export function IconItems(props: IconProps) {
  return (
    <svg {...shellGlyph(props)}>
      <path d="M4 8 12 4l8 4-8 4z" />
      <path d="M4 8v8l8 4 8-4V8" />
      <path d="M12 12v8" />
    </svg>
  )
}

export function IconProperty(props: IconProps) {
  return (
    <svg {...shellGlyph(props)}>
      <path d="M4 20V9l8-5 8 5v11" />
      <path d="M10 20v-6h4v6" />
    </svg>
  )
}

export function IconFlame(props: IconProps) {
  return (
    <svg {...shellGlyph(props)}>
      <path d="M12 3s3 4 3 7a3 3 0 1 1-6 0c0-1.6.7-3 2-4.5C9.5 8 8 10 8 13a4 4 0 0 0 8 0c0-3.4-2.2-6.4-4-10z" />
    </svg>
  )
}
