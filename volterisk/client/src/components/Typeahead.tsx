import { useMemo, useState } from 'react'

type Option = { id: string; label: string; sub?: string }

/** Letter-by-letter filter dropdown for marketplace stalls. */
export function Typeahead({
  options,
  value,
  onChange,
  placeholder = 'Search…',
  className = '',
}: {
  options: Option[]
  value: string
  onChange: (id: string, label: string) => void
  placeholder?: string
  className?: string
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const selected = options.find((o) => o.id === value)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options.slice(0, 24)
    return options.filter((o) => o.label.toLowerCase().includes(q) || (o.sub ?? '').toLowerCase().includes(q)).slice(0, 24)
  }, [options, query])

  return (
    <div className={`relative ${className}`}>
      <input
        className="w-full border border-border bg-background px-3 py-2 text-sm"
        value={open ? query : selected?.label ?? query}
        placeholder={placeholder}
        onFocus={() => {
          setOpen(true)
          setQuery(selected?.label ?? '')
        }}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
          if (!e.target.value) onChange('', '')
        }}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
      />
      {open && filtered.length > 0 ? (
        <ul className="absolute z-30 mt-1 max-h-56 w-full overflow-auto border border-border bg-card shadow-lg">
          {filtered.map((opt) => (
            <li key={opt.id}>
              <button
                type="button"
                className="block w-full cursor-pointer px-3 py-2 text-left text-sm hover:bg-accent"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(opt.id, opt.label)
                  setQuery(opt.label)
                  setOpen(false)
                }}
              >
                <span className="font-medium">{opt.label}</span>
                {opt.sub ? <span className="ml-2 text-muted-foreground">{opt.sub}</span> : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
