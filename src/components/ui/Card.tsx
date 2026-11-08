'use client';

import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/format';

export function Card({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('min-w-0 rounded-xl border border-slate-200/80 bg-white shadow-card', className)} {...rest}>{children}</div>;
}

export function CardHeader({ title, subtitle, action, className }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4', className)}>
      <div className="min-w-0">
        <h3 className="text-[15px] font-semibold text-navy-900">{title}</h3>
        {subtitle && <p className="mt-0.5 text-[13px] text-slate-500">{subtitle}</p>}
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </div>
  );
}

export function Stat({ label, value, hint, icon, tone = 'default', footer, onClick, rendiId }: {
  label: string; value: ReactNode; hint?: ReactNode; icon?: ReactNode; tone?: 'default' | 'warning' | 'danger' | 'positive'; footer?: ReactNode; onClick?: () => void;
  /**
   * Marks this card as a region Rendi AI may scroll to or outline. Set on the
   * card element itself rather than a wrapper, so adding an anchor cannot
   * change the grid cell a Stat occupies or its height against its siblings.
   */
  rendiId?: string;
}) {
  const toneRing = { default: 'bg-navy-50 text-navy-700', warning: 'bg-amber-50 text-amber-700', danger: 'bg-red-50 text-red-700', positive: 'bg-brand-50 text-brand-700' }[tone];
  const Comp = onClick ? 'button' : 'div';
  return (
    <Comp onClick={onClick} data-rendi-id={rendiId} className={cn('group flex flex-col rounded-xl border border-slate-200/80 bg-white p-4 text-left shadow-card', onClick && 'hover:border-slate-300 focus-ring transition')}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[13px] font-medium text-slate-600">{label}</p>
        {icon && <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', toneRing)}>{icon}</span>}
      </div>
      <p className="tnum mt-2 text-[22px] font-semibold tracking-tight text-navy-900">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
      {footer && <div className="mt-3 border-t border-slate-100 pt-2.5 text-xs">{footer}</div>}
    </Comp>
  );
}

export function PageHeader({ title, subtitle, actions, breadcrumb }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; breadcrumb?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {breadcrumb && <div className="mb-1.5 text-[13px] text-slate-500">{breadcrumb}</div>}
        <h1 className="text-xl font-semibold tracking-tight text-navy-900 sm:text-2xl">{title}</h1>
        {subtitle && <p className="mt-1 max-w-2xl text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function KV({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn('min-w-0', className)}>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-0.5 break-words text-sm font-medium text-navy-900">{children}</dd>
    </div>
  );
}