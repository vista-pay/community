'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/format';

export function Popover({ trigger, children, align = 'right', width = 'w-56', open: controlled, onOpenChange }: { trigger: (p: { open: boolean; toggle: () => void }) => ReactNode; children: ReactNode | ((close: () => void) => ReactNode); align?: 'left' | 'right'; width?: string; open?: boolean; onOpenChange?: (o: boolean) => void }) {
  const [inner, setInner] = useState(false);
  const open = controlled ?? inner;
  const set = (o: boolean) => { setInner(o); onOpenChange?.(o); };
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) set(false); };
    const k = (e: KeyboardEvent) => e.key === 'Escape' && set(false);
    document.addEventListener('mousedown', h); document.addEventListener('keydown', k);
    return () => { document.removeEventListener('mousedown', h); document.removeEventListener('keydown', k); };
  });
  return (
    <div className="relative" ref={ref}>
      {trigger({ open, toggle: () => set(!open) })}
      {open && (
        <div className={cn('absolute z-40 mt-2 animate-fade-in rounded-xl border border-slate-200 bg-white py-1 shadow-pop', align === 'right' ? 'right-0' : 'left-0', width)}>
          {typeof children === 'function' ? children(() => set(false)) : children}
        </div>
      )}
    </div>
  );
}

export function MenuItem({ icon, children, onClick, danger }: { icon?: ReactNode; children: ReactNode; onClick?: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick} className={cn('flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-slate-50 focus:bg-slate-50 focus:outline-none', danger ? 'text-red-600' : 'text-navy-800')}>
      {icon && <span className="text-slate-500 [&>svg]:h-4 [&>svg]:w-4">{icon}</span>}{children}
    </button>
  );
}