import type { ReactNode } from 'react'
import { Meta } from './primitives.tsx'

export type Column<Row> = {
  key: string
  header: string
  align?: 'left' | 'right'
  width?: string
  mono?: boolean
  cell: (row: Row, index: number) => ReactNode
  hideBelow?: 'sm' | 'md' | 'lg'
}

const hideClass = {
  sm: 'hidden sm:table-cell',
  md: 'hidden md:table-cell',
  lg: 'hidden lg:table-cell',
} as const

export function DataTable<Row>({
  columns,
  rows,
  rowKey,
  highlight,
  onRowClick,
  caption,
}: {
  columns: Column<Row>[]
  rows: Row[]
  rowKey: (row: Row, index: number) => string
  highlight?: (row: Row) => boolean
  onRowClick?: (row: Row) => void
  caption?: string
}) {
  return (
    <div className="-mx-3.5 overflow-x-auto sm:mx-0">
      <table className="w-full min-w-[420px] border-collapse text-left">
        {caption ? <caption className="meta px-3.5 pb-2 text-left text-faint">{caption}</caption> : null}
        <thead>
          <tr className="border-b border-line-2">
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                style={column.width ? { width: column.width } : undefined}
                className={`px-3.5 pb-2 align-bottom ${column.align === 'right' ? 'text-right' : ''} ${
                  column.hideBelow ? hideClass[column.hideBelow] : ''
                }`}
              >
                <Meta tone="faint">{column.header}</Meta>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const lit = highlight?.(row) ?? false
            return (
              <tr
                key={rowKey(row, index)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={`border-b border-line/70 transition-colors duration-150 ${
                  lit ? 'bg-gold/[0.07]' : 'hover:bg-paper/[0.022]'
                } ${onRowClick ? 'cursor-pointer' : ''}`}
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={`px-3.5 py-2.5 text-[12.5px] ${column.align === 'right' ? 'text-right' : ''} ${
                      column.mono ? 'tabular font-mono' : ''
                    } ${lit ? 'text-paper' : 'text-beige'} ${column.hideBelow ? hideClass[column.hideBelow] : ''}`}
                  >
                    {column.cell(row, index)}
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
