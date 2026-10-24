'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, X } from 'lucide-react';
import { cn } from '@/lib/format';
import { Button } from './Button';
import { Field, Textarea } from './Form';

function useLockAndEsc(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow; document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);
}

export function Modal({ open, onClose, title, description, children, footer, size = 'md' }: {
  open: boolean; onClose: () => void; title: ReactNode; description?: ReactNode; children?: ReactNode; footer?: ReactNode; size?: 'sm' | 'md' | 'lg' | 'xl';
}) {
  useLockAndEsc(open, onClose);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (open) setTimeout(() => { if (ref.current && !ref.current.contains(document.activeElement)) ref.current.querySelector<HTMLElement>('input,select,textarea,button:not([data-close])')?.focus(); }, 30); }, [open]);
  if (!open) return null;
  const w = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }[size];
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined}>
      <div className="absolute inset-0 bg-navy-950/50 backdrop-blur-[2px]" onClick={onClose} />
      <div ref={ref} className={cn('relative flex max-h-[92vh] w-full animate-fade-in flex-col rounded-t-2xl bg-white shadow-pop sm:rounded-2xl', w)}>
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-navy-900">{title}</h2>
            {description && <p className="mt-1 text-[13px] text-slate-500">{description}</p>}
          </div>
          <button data-close onClick={onClose} aria-label="Close" className="-mr-1 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 focus-ring"><X className="h-4 w-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 bg-slate-50/60 px-5 py-3.5 sm:px-6 rounded-b-2xl">{footer}</div>}
      </div>
    </div>, document.body);
}

export function Drawer({ open, onClose, title, subtitle, children, footer, width = 'max-w-xl' }: { open: boolean; onClose: () => void; title: ReactNode; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode; width?: string }) {
  useLockAndEsc(open, onClose);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-navy-950/40" onClick={onClose} />
      <div className={cn('absolute inset-y-0 right-0 flex w-full flex-col bg-white shadow-pop animate-fade-in', width)}>
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div className="min-w-0"><h2 className="text-base font-semibold text-navy-900">{title}</h2>{subtitle && <p className="mt-0.5 text-[13px] text-slate-500">{subtitle}</p>}</div>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 focus-ring"><X className="h-4 w-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 bg-slate-50/60 px-5 py-3.5">{footer}</div>}
      </div>
    </div>, document.body);
}

/** Confirmation for sensitive or destructive actions. Optional typed reason is recorded in the audit log. */
export function ConfirmDialog(props: {
  open: boolean; onClose: () => void; onConfirm: (reason: string) => void; title: string; body: ReactNode; confirmLabel?: string; tone?: 'primary' | 'danger'; requireReason?: boolean; reasonLabel?: string; loading?: boolean;
}) {
  // Mounting the body only while open is what clears the typed reason between
  // uses. Resetting it from an effect meant a half-typed reason could flash
  // back on reopen, and reason text ends up in the audit log.
  if (!props.open) return null;
  return <ConfirmDialogBody {...props} />;
}

function ConfirmDialogBody({ open, onClose, onConfirm, title, body, confirmLabel = 'Confirm', tone = 'primary', requireReason, reasonLabel = 'Reason', loading }: {
  open: boolean; onClose: () => void; onConfirm: (reason: string) => void; title: string; body: ReactNode; confirmLabel?: string; tone?: 'primary' | 'danger'; requireReason?: boolean; reasonLabel?: string; loading?: boolean;
}) {
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  const invalid = requireReason && reason.trim().length < 5;
  return (
    <Modal open={open} onClose={onClose} size="sm" title={
      <span className="flex items-center gap-2">{tone === 'danger' && <AlertTriangle className="h-4 w-4 text-red-600" />}{title}</span>}
      footer={<>
        <Button variant="secondary" onClick={onClose} disabled={loading}>Cancel</Button>
        <Button variant={tone === 'danger' ? 'danger' : 'primary'} loading={loading} onClick={() => { setTouched(true); if (!invalid) onConfirm(reason.trim()); }}>{confirmLabel}</Button>
      </>}>
      <div className="space-y-4 text-sm leading-relaxed text-slate-600">
        <div>{body}</div>
        {requireReason && (
          <Field label={reasonLabel} htmlFor="confirm-reason" required error={touched && invalid ? 'Enter a reason of at least 5 characters. It is saved to the audit log.' : null}>
            <Textarea id="confirm-reason" value={reason} onChange={(e) => setReason(e.target.value)} invalid={touched && !!invalid} placeholder="This will be visible in the audit log" />
          </Field>
        )}
      </div>
    </Modal>
  );
}
