import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link } from 'react-router-dom'

type Variant = 'gold' | 'outline' | 'danger' | 'ghost' | 'secure'
type Size = 'sm' | 'md'

const base =
  'meta inline-flex cursor-pointer items-center justify-center gap-2 rounded-[4px] border transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-40'

const variants: Record<Variant, string> = {
  gold: 'border-gold/60 bg-gold/15 text-gold hover:border-gold hover:bg-gold/25',
  outline: 'border-line-2 bg-paper/[0.03] text-beige hover:border-beige/45 hover:text-paper',
  danger: 'border-danger/60 bg-danger/15 text-danger hover:border-danger hover:bg-danger/25',
  ghost: 'border-transparent bg-transparent text-muted hover:text-paper',
  secure: 'border-line-2 bg-ink text-beige hover:border-intel/50 hover:text-paper',
}

const sizes: Record<Size, string> = {
  sm: 'px-2.5 py-1.5',
  md: 'px-3.5 py-2.5',
}

export function Button({
  variant = 'outline',
  size = 'md',
  className = '',
  type = 'button',
  icon,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; icon?: ReactNode }) {
  return (
    <button type={type} {...props} className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}>
      {icon}
      {children}
    </button>
  )
}

export function ButtonLink({
  to,
  variant = 'outline',
  size = 'md',
  className = '',
  icon,
  children,
}: {
  to: string
  variant?: Variant
  size?: Size
  className?: string
  icon?: ReactNode
  children: ReactNode
}) {
  return (
    <Link to={to} className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}>
      {icon}
      {children}
    </Link>
  )
}

export function IconButton({
  label,
  className = '',
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      {...props}
      className={`inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-[4px] border border-line text-muted transition-colors duration-150 hover:border-line-2 hover:text-paper disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
    >
      {children}
    </button>
  )
}
