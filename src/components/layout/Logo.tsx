'use client';

import { cn } from '@/lib/format';

export function LogoMark({ className }: { className?: string }) {
  return <img src="/Symbol.png" className={cn('h-8 w-8 rounded-lg', className)} alt="Rendi" />;
}

export function Logo({ dark, compact }: { dark?: boolean; compact?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <LogoMark />
      {!compact && (
        <span className="leading-none">
          <span className={cn('block text-[15px] font-semibold tracking-tight', dark ? 'text-white' : 'text-navy-900')}>Rendi</span>
          <span className={cn('mt-0.5 block text-[10.5px] font-medium uppercase tracking-[0.12em]', dark ? 'text-navy-300' : 'text-slate-500')}>Community Portal</span>
        </span>
      )}
    </span>
  );
}
