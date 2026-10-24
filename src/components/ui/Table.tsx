'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/format';

export interface Column<T> { key: string; header: ReactNode; cell: (row: T) => ReactNode; align?: 'left' | 'right' | 'center'; className?: string; hideOnMobile?: boolean }

/** Desktop: full table with horizontal scroll. Mobile: stacked cards via `mobile` renderer. */
export function DataTable<T>({ rows, columns, rowKey, onRowClick, mobile, empty, dense, loading }: {
  rows: T[]; columns: Column<T>[]; rowKey: (r: T) => string; onRowClick?: (r: T) => void; mobile?: (r: T) => ReactNode; empty?: ReactNode; dense?: boolean; loading?: boolean;
}) {
  // Only show skeletons on a first load. A refetch keeps the current rows on
  // screen, because replacing a populated table with grey bars reads as data
  // loss rather than as loading.
  if (loading && rows.length === 0) return <TableSkeleton columns={columns.length} />;
  if (rows.length === 0 && empty) return <>{empty}</>;
  return (
    <>
      <div className={cn('overflow-x-auto', mobile && 'hidden md:block')}>
        <table className="w-full min-w-[640px] border-collapse">
          <thead className="bg-slate-50/80">
            <tr className="border-b border-slate-200">
              {columns.map((c) => <th key={c.key} scope="col" className={cn('th', c.align === 'right' && 'text-right', c.align === 'center' && 'text-center', c.className)}>{c.header}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <tr key={rowKey(r)} onClick={onRowClick ? () => onRowClick(r) : undefined}
                onKeyDown={onRowClick ? (e) => { if (e.key === 'Enter') onRowClick(r); } : undefined} tabIndex={onRowClick ? 0 : undefined}
                className={cn('transition-colors', onRowClick && 'cursor-pointer hover:bg-slate-50 focus:bg-slate-50 focus:outline-none')}>
                {columns.map((c) => <td key={c.key} className={cn('td', dense && 'py-2', c.align === 'right' && 'text-right tnum', c.align === 'center' && 'text-center', c.className)}>{c.cell(r)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {mobile && (
        <ul className="divide-y divide-slate-100 md:hidden">
          {rows.map((r) => (
            <li key={rowKey(r)}>
              {onRowClick ? <button className="block w-full px-4 py-3 text-left hover:bg-slate-50 focus-ring" onClick={() => onRowClick(r)}>{mobile(r)}</button> : <div className="px-4 py-3">{mobile(r)}</div>}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
function TableSkeleton({ columns }: { columns: number }) {
  return (
    <div className="divide-y divide-slate-100" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading</span>
      {Array.from({ length: 6 }, (_, row) => (
        <div key={row} className="flex items-center gap-4 px-4 py-3.5">
          {Array.from({ length: columns }, (_, col) => (
            <div
              key={col}
              className="h-3.5 flex-1 animate-pulse rounded bg-slate-200/70"
              style={{ maxWidth: col === 0 ? '14rem' : '8rem' }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
