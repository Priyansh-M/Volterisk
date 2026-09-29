export function AssetGlyph({ id }: { id: string }) {
  const common = 'h-16 w-16 text-primary'
  if (id === 'car') {
    return (
      <svg viewBox="0 0 64 64" className={common} aria-hidden="true">
        <path d="M10 38h44l-4-12H18L10 38z" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M8 38h48v8H8z" fill="none" stroke="currentColor" strokeWidth="2" />
        <circle cx="18" cy="48" r="4" fill="none" stroke="currentColor" strokeWidth="2" />
        <circle cx="46" cy="48" r="4" fill="none" stroke="currentColor" strokeWidth="2" />
      </svg>
    )
  }
  if (id === 'bike') {
    return (
      <svg viewBox="0 0 64 64" className={common} aria-hidden="true">
        <circle cx="16" cy="42" r="8" fill="none" stroke="currentColor" strokeWidth="2" />
        <circle cx="46" cy="42" r="8" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M16 42l10-16h12l8 16M26 26l8 16" fill="none" stroke="currentColor" strokeWidth="2" />
      </svg>
    )
  }
  if (id === 'truck') {
    return (
      <svg viewBox="0 0 64 64" className={common} aria-hidden="true">
        <path d="M6 40V24h28v16" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M34 30h12l8 8v6H34" fill="none" stroke="currentColor" strokeWidth="2" />
        <circle cx="18" cy="44" r="4" fill="none" stroke="currentColor" strokeWidth="2" />
        <circle cx="46" cy="44" r="4" fill="none" stroke="currentColor" strokeWidth="2" />
      </svg>
    )
  }
  if (id === 'airplane') {
    return (
      <svg viewBox="0 0 64 64" className={common} aria-hidden="true">
        <path d="M8 36l48-10-6 8 6 4-48 6 8-8z" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M28 28l-6-10M30 40l-8 12" fill="none" stroke="currentColor" strokeWidth="2" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 64 64" className={common} aria-hidden="true">
      <path d="M12 28h40v22H12z" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M20 28V18h24v10" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M28 50V36h8v14" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  )
}
