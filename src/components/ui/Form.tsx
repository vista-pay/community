'use client';

import { useId, useState, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { AlertCircle, Check, Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/format';

export function Field({ label, htmlFor, required, optional, hint, error, children, className }: {
  label?: ReactNode; htmlFor?: string; required?: boolean; optional?: boolean; hint?: ReactNode; error?: string | null | false; children: ReactNode; className?: string;
}) {
  return (
    <div className={cn('min-w-0', className)}>
      {label && (
        <label htmlFor={htmlFor} className="label">
          {label}
          {required && <span className="ml-0.5 text-red-600" aria-hidden>*</span>}
          {optional && <span className="ml-1.5 text-xs font-normal text-slate-400">Optional</span>}
        </label>
      )}
      {children}
      {error ? (
        <p role="alert" id={htmlFor ? `${htmlFor}-err` : undefined} className="mt-1.5 flex items-start gap-1.5 text-[13px] text-red-600">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />{error}
        </p>
      ) : hint ? <p className="mt-1.5 text-[13px] text-slate-500">{hint}</p> : null}
    </div>
  );
}

type InputProps = InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean; prefix?: ReactNode; suffix?: ReactNode };
export function Input({ invalid, className, prefix, suffix, id, ...rest }: InputProps) {
  if (prefix || suffix) {
    return (
      <div className={cn('flex items-stretch overflow-hidden rounded-lg border bg-white shadow-sm transition focus-within:ring-2', invalid ? 'border-red-400 focus-within:ring-red-500/20' : 'border-slate-300 focus-within:border-brand-500 focus-within:ring-brand-500/25', className)}>
        {prefix && <span className="flex items-center border-r border-slate-200 bg-slate-50 px-3 text-sm text-slate-600">{prefix}</span>}
        <input id={id} aria-invalid={invalid || undefined} aria-describedby={invalid && id ? `${id}-err` : undefined} className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm text-navy-900 placeholder:text-slate-400 focus:outline-none" {...rest} />
        {suffix && <span className="flex items-center px-3 text-sm text-slate-500">{suffix}</span>}
      </div>
    );
  }
  return <input id={id} aria-invalid={invalid || undefined} aria-describedby={invalid && id ? `${id}-err` : undefined} className={cn('input', invalid && 'input-error', className)} {...rest} />;
}

export function PasswordInput(props: InputProps) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input {...props} type={show ? 'text' : 'password'} className={cn('pr-10', props.className)} />
      <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'} className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-slate-500 hover:text-navy-800 focus-ring rounded-r-lg">
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

export function Select({ invalid, className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }) {
  return (
    <select aria-invalid={invalid || undefined} className={cn('input appearance-none bg-[url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2716%27 height=%2716%27 fill=%27none%27 stroke=%27%2364748b%27 stroke-width=%272%27%3E%3Cpath d=%27m4 6 4 4 4-4%27/%3E%3C/svg%3E")] bg-[right_0.6rem_center] bg-no-repeat pr-9', invalid && 'input-error', className)} {...rest}>
      {children}
    </select>
  );
}

export function Textarea({ invalid, className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }) {
  return <textarea aria-invalid={invalid || undefined} className={cn('input min-h-[88px] resize-y', invalid && 'input-error', className)} {...rest} />;
}

export function Checkbox({ checked, onChange, label, description, id, invalid }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; description?: ReactNode; id?: string; invalid?: boolean }) {
  const auto = useId(); const cid = id ?? auto;
  return (
    <label htmlFor={cid} className="flex cursor-pointer items-start gap-3">
      <span className="relative mt-0.5 flex h-[18px] w-[18px] shrink-0">
        <input id={cid} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} aria-invalid={invalid || undefined}
          className={cn('peer h-[18px] w-[18px] cursor-pointer appearance-none rounded border bg-white transition checked:border-brand-600 checked:bg-brand-600 focus-ring', invalid ? 'border-red-400' : 'border-slate-300')} />
        <Check className="pointer-events-none absolute inset-0 m-auto h-3 w-3 text-white opacity-0 peer-checked:opacity-100" strokeWidth={3} />
      </span>
      <span className="text-sm">
        <span className="text-navy-800">{label}</span>
        {description && <span className="mt-0.5 block text-[13px] text-slate-500">{description}</span>}
      </span>
    </label>
  );
}

export function Toggle({ checked, onChange, label, disabled, size = 'md' }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean; size?: 'sm' | 'md' }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} onClick={() => onChange(!checked)}
      className={cn('relative inline-flex shrink-0 items-center rounded-full transition-colors focus-ring disabled:cursor-not-allowed disabled:opacity-50', size === 'sm' ? 'h-5 w-9' : 'h-6 w-11', checked ? 'bg-brand-600' : 'bg-slate-300')}>
      <span className={cn('inline-block transform rounded-full bg-white shadow transition-transform', size === 'sm' ? 'h-4 w-4' : 'h-5 w-5', checked ? (size === 'sm' ? 'translate-x-[18px]' : 'translate-x-[22px]') : 'translate-x-0.5')} />
    </button>
  );
}

export function Segmented<T extends string>({ value, onChange, options, label, size = 'md' }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode; disabled?: boolean }[]; label: string; size?: 'sm' | 'md' }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex max-w-full flex-wrap rounded-lg border border-slate-200 bg-slate-100/70 p-0.5">
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value} disabled={o.disabled}
          onClick={() => !o.disabled && onChange(o.value)}
          className={cn('rounded-md font-medium transition focus-ring', size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-[13px]',
            o.disabled ? 'cursor-not-allowed text-slate-400' : value === o.value ? 'bg-white text-navy-900 shadow-sm' : 'text-slate-600 hover:text-navy-900')}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function RadioCard({ selected, onSelect, title, description, icon, badge, className }: { selected: boolean; onSelect: () => void; title: ReactNode; description?: ReactNode; icon?: ReactNode; badge?: ReactNode; className?: string }) {
  return (
    <button type="button" role="radio" aria-checked={selected} onClick={onSelect}
      className={cn('relative flex w-full items-start gap-3 rounded-xl border p-4 text-left transition focus-ring',
        selected ? 'border-brand-600 bg-brand-50/40 ring-1 ring-brand-600' : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60', className)}>
      {icon && <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg', selected ? 'bg-brand-600 text-white' : 'bg-navy-50 text-navy-700')}>{icon}</span>}
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2 text-sm font-semibold text-navy-900">{title}{badge}</span>
        {description && <span className="mt-1 block text-[13px] leading-relaxed text-slate-600">{description}</span>}
      </span>
      <span className={cn('mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2', selected ? 'border-brand-600 bg-brand-600' : 'border-slate-300')}>
        {selected && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
      </span>
    </button>
  );
}

/**
 * Money input that keeps its value as a decimal *string*.
 *
 * The previous version parsed to a number and stripped anything after the
 * decimal point, so "1500.50" silently became ₦1,500. Amounts here go
 * straight to the API, which does exact decimal arithmetic, so the input must
 * not round on the way in.
 */
export function AmountInput({
  value,
  onChange,
  currency = '₦',
  invalid,
  id,
  placeholder,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  currency?: string;
  invalid?: boolean;
  id?: string;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <Input
      id={id}
      inputMode="decimal"
      prefix={currency}
      invalid={invalid}
      disabled={disabled}
      placeholder={placeholder ?? '0.00'}
      value={value}
      onChange={(e) => {
        // Digits and at most one decimal point, up to two places.
        const raw = e.target.value.replace(/[^\d.]/g, '');
        const [whole, ...rest] = raw.split('.');
        const next = rest.length ? `${whole}.${rest.join('').slice(0, 2)}` : whole;
        onChange(next ?? '');
      }}
    />
  );
}
