'use client';

import type { ReactNode } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Info, Loader2, RotateCw, XCircle } from 'lucide-react';
import { cn } from '@/lib/format';
import { Button } from './Button';

export function Spinner({ className, label = 'Loading' }: { className?: string; label?: string }) {
  return <Loader2 role="status" aria-label={label} className={cn('h-5 w-5 animate-spin text-brand-600', className)} />;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-md bg-slate-200/70', className)} aria-hidden />;
}

export function EmptyState({ icon, title, body, action, secondary, compact }: { icon?: ReactNode; title: string; body?: ReactNode; action?: ReactNode; secondary?: ReactNode; compact?: boolean }) {
  return (
    <div className={cn('flex flex-col items-center justify-center text-center', compact ? 'px-4 py-8' : 'px-6 py-14')}>
      {icon && <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-navy-50 text-navy-600 ring-8 ring-navy-50/50">{icon}</div>}
      <h3 className="text-[15px] font-semibold text-navy-900">{title}</h3>
      {body && <p className="mt-1.5 max-w-sm text-[13px] leading-relaxed text-slate-500">{body}</p>}
      {(action || secondary) && <div className="mt-5 flex flex-wrap justify-center gap-2">{action}{secondary}</div>}
    </div>
  );
}

export function ErrorState({ title = 'Something went wrong', body, onRetry }: { title?: string; body: ReactNode; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-600"><XCircle className="h-6 w-6" /></div>
      <h3 className="text-[15px] font-semibold text-navy-900">{title}</h3>
      <p className="mt-1.5 max-w-sm text-[13px] text-slate-500">{body}</p>
      {onRetry && <Button className="mt-5" variant="secondary" icon={<RotateCw className="h-4 w-4" />} onClick={onRetry}>Try again</Button>}
    </div>
  );
}

const calloutTone = {
  info: ['border-sky-200 bg-sky-50 text-sky-900', Info, 'text-sky-600'],
  success: ['border-emerald-200 bg-emerald-50 text-emerald-900', CheckCircle2, 'text-emerald-600'],
  warning: ['border-amber-200 bg-amber-50 text-amber-900', AlertTriangle, 'text-amber-600'],
  danger: ['border-red-200 bg-red-50 text-red-900', AlertCircle, 'text-red-600'],
} as const;

export function Callout({ tone = 'info', title, children, action, className }: { tone?: keyof typeof calloutTone; title?: ReactNode; children?: ReactNode; action?: ReactNode; className?: string }) {
  const [cls, Icon, ic] = calloutTone[tone];
  return (
    <div className={cn('flex gap-3 rounded-xl border px-4 py-3', cls, className)} role={tone === 'danger' ? 'alert' : undefined}>
      <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', ic)} aria-hidden />
      <div className="min-w-0 flex-1 text-[13px] leading-relaxed">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={cn(title ? 'mt-0.5' : '', 'opacity-90')}>{children}</div>}
      </div>
      {action && <div className="shrink-0 self-center">{action}</div>}
    </div>
  );
}

export function ProgressBar({ value, tone = 'brand', className }: { value: number; tone?: 'brand' | 'amber' | 'red' | 'navy'; className?: string }) {
  const c = { brand: 'bg-brand-500', amber: 'bg-amber-500', red: 'bg-red-500', navy: 'bg-navy-600' }[tone];
  return <div className={cn('h-1.5 w-full overflow-hidden rounded-full bg-slate-100', className)} role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100}><div className={cn('h-full rounded-full transition-all', c)} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} /></div>;
}