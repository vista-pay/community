'use client';

import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/format';
import type { Money } from '@/types';

/**
 * Whether anything has ever posted to an account.
 *
 * A seeded chart is mostly empty — a community that runs no Ajo and owns no
 * equipment still carries accounts for both — so every accounting page has
 * to separate the accounts holding figures from the ones merely available.
 * One predicate so they cannot disagree about what "used" means.
 *
 * Reads whichever the caller has: the chart ships an entry count, the
 * statements rows ship the two sides. A balance of zero is not the test —
 * an account money passed through nets to zero and has very much been used.
 */
export const hasMovement = (row: {
  entries?: number;
  debit?: Money;
  credit?: Money;
  debits?: Money;
  credits?: Money;
}): boolean =>
  (row.entries ?? 0) > 0 ||
  Number(row.debit ?? row.debits ?? 0) !== 0 ||
  Number(row.credit ?? row.credits ?? 0) !== 0;

/**
 * The fold that holds accounts nothing has posted to.
 *
 * Shown rather than hidden, just not first. An account that exists and has
 * never been used is a fact worth being able to see — to check it really is
 * empty, or before posting to it — just not one worth scrolling past thirty
 * times to reach the figures.
 */
export function UnusedDisclosure({
  count,
  open,
  onToggle,
  noun = 'account',
  children,
}: {
  count: number;
  open: boolean;
  onToggle: () => void;
  /** What is being folded, for the label. */
  noun?: string;
  children: React.ReactNode;
}) {
  if (count === 0) return null;

  return (
    <div className="border-t border-slate-200">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-2 px-4 py-3 text-left transition hover:bg-slate-50 focus-ring"
      >
        <ChevronRight
          className={cn('h-4 w-4 text-slate-400 transition-transform', open && 'rotate-90')}
        />
        <span className="flex-1 text-[13px] font-medium text-navy-900">
          {count} {noun}
          {count === 1 ? '' : 's'} with nothing posted
        </span>
        <span className="text-[12.5px] text-slate-500">{open ? 'Hide' : 'Show'}</span>
      </button>
      {open ? children : null}
    </div>
  );
}
