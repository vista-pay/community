'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/format';

export type Tone = 'green' | 'amber' | 'red' | 'blue' | 'slate' | 'purple' | 'gold' | 'navy';
const tones: Record<Tone, string> = {
  green: 'bg-emerald-50 text-emerald-800 ring-emerald-600/20',
  amber: 'bg-amber-50 text-amber-800 ring-amber-600/25',
  red: 'bg-red-50 text-red-700 ring-red-600/20',
  blue: 'bg-sky-50 text-sky-800 ring-sky-600/20',
  slate: 'bg-slate-100 text-slate-700 ring-slate-500/20',
  purple: 'bg-violet-50 text-violet-800 ring-violet-600/20',
  gold: 'bg-gold-50 text-gold-600 ring-gold-500/30',
  navy: 'bg-navy-50 text-navy-700 ring-navy-600/20',
};
const dots: Record<Tone, string> = { green: 'bg-emerald-500', amber: 'bg-amber-500', red: 'bg-red-500', blue: 'bg-sky-500', slate: 'bg-slate-400', purple: 'bg-violet-500', gold: 'bg-gold-500', navy: 'bg-navy-500' };

export function Badge({ tone = 'slate', children, dot, className }: { tone?: Tone; children: ReactNode; dot?: boolean; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset', tones[tone], className)}>
      {dot && <span className={cn('h-1.5 w-1.5 rounded-full', dots[tone])} aria-hidden />}
      {children}
    </span>
  );
}

// One mapping for every status in the product so the same word always looks the same.
const STATUS: Record<string, [Tone, string]> = {
  successful: ['green', 'Successful'], active: ['green', 'Active'], paid: ['green', 'Paid'], verified: ['green', 'Verified'], reconciled: ['green', 'Reconciled'], open: ['green', 'Open'], closed_ok: ['green', 'Closed'], uploaded: ['blue', 'Uploaded'],
  pending: ['amber', 'Pending'], awaiting_approval: ['amber', 'Awaiting approval'], in_transit: ['amber', 'In transit'], under_review: ['amber', 'Under review'], partial: ['amber', 'Part-paid'], submitted: ['amber', 'Submitted'], invited: ['amber', 'Invited'], in_review: ['amber', 'In review'], needs_attention: ['amber', 'Needs attention'], unreconciled: ['amber', 'Unreconciled'], limited: ['amber', 'Limited'], verifying: ['amber', 'Verifying…'], forming: ['amber', 'Forming'],
  failed: ['red', 'Failed'], overdue: ['red', 'Overdue'], rejected: ['red', 'Rejected'], suspended: ['red', 'Suspended'], mismatch: ['red', 'Mismatch'], revoked: ['red', 'Revoked'],
  processing: ['blue', 'Processing'], approved: ['blue', 'Approved'], selected: ['blue', 'Selected'], disbursed: ['blue', 'Disbursed'], uploading: ['blue', 'Uploading…'],
  reversed: ['purple', 'Reversed'],
  draft: ['slate', 'Draft'], scheduled: ['slate', 'Scheduled'], closed: ['slate', 'Closed'], inactive: ['slate', 'Inactive'], ended: ['slate', 'Ended'], paused: ['slate', 'Paused'], not_started: ['slate', 'Not started'], not_submitted: ['slate', 'Not submitted'], coming_soon: ['slate', 'Coming soon'], completed: ['green', 'Completed'],
};

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  const [tone, text] = STATUS[status] ?? ['slate', status];
  return <Badge tone={tone} dot>{label ?? text}</Badge>;
}