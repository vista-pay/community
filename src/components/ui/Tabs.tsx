'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/format';

export function Tabs<T extends string>({ value, onChange, tabs, className }: { value: T; onChange: (v: T) => void; tabs: { value: T; label: ReactNode; count?: number }[]; className?: string }) {
  return (
    <div className={cn('-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0', className)}>
      <div role="tablist" className="flex min-w-max gap-1 border-b border-slate-200">
        {tabs.map((t) => (
          <button key={t.value} role="tab" aria-selected={value === t.value} onClick={() => onChange(t.value)}
            className={cn('relative -mb-px flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium transition focus-ring rounded-t-md',
              value === t.value ? 'border-brand-600 text-navy-900' : 'border-transparent text-slate-500 hover:text-navy-800')}>
            {t.label}
            {t.count !== undefined && <span className={cn('rounded-full px-1.5 text-[11px] tnum', value === t.value ? 'bg-brand-100 text-brand-800' : 'bg-slate-100 text-slate-600')}>{t.count}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}