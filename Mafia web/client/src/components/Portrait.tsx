const marks: Record<string, string> = {
  crest: 'M8 4 L14 6 L14 12 L8 16 L2 12 L2 6 Z',
  crow: 'M3 12 Q8 4 14 8 L12 14 Q8 16 3 12',
  vault: 'M4 6 H12 V14 H4 Z M6 14 V10 H10 V14',
  wire: 'M2 12 H14 M8 4 V14',
}

export function Portrait({ name, url, className = '' }: { name: string; url?: string | null; className?: string }) {
  const initial = name.slice(0, 2).toUpperCase()
  if (url?.startsWith('icon:') && marks[url.slice(5)]) {
    return (
      <span className={`inline-flex items-center justify-center overflow-hidden bg-[#14110e] text-[#cbb89a] ${className}`}>
        <svg viewBox="0 0 16 16" className="h-2/3 w-2/3" aria-hidden="true">
          <path d={marks[url.slice(5)]} fill="none" stroke="currentColor" strokeWidth="1.2" />
        </svg>
      </span>
    )
  }
  if (url) {
    return <img src={url} alt="" className={`object-cover ${className}`} />
  }
  return <span className={`inline-flex items-center justify-center font-display ${className}`}>{initial}</span>
}
