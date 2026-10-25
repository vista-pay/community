'use client';

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/format';

type Variant = 'primary' | 'blue' | 'secondary' | 'ghost' | 'danger' | 'navy' | 'link' | 'soft';
type Size = 'xs' | 'sm' | 'md' | 'lg';

const variants: Record<Variant, string> = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700 shadow-sm disabled:bg-brand-600/50',
  /** The suite-wide auth blue, matching the admin and business consoles. */
  blue: 'bg-[#2563EB] text-white hover:bg-[#1D4ED8] shadow-sm disabled:bg-[#2563EB]/50',
  navy: 'bg-navy-800 text-white hover:bg-navy-900 shadow-sm disabled:bg-navy-800/50',
  secondary: 'bg-white text-navy-800 border border-slate-300 hover:bg-slate-50 hover:border-slate-400 shadow-sm disabled:text-slate-400',
  soft: 'bg-brand-50 text-brand-800 hover:bg-brand-100',
  ghost: 'text-navy-700 hover:bg-slate-100 disabled:text-slate-400',
  danger: 'bg-red-600 text-white hover:bg-red-700 shadow-sm disabled:bg-red-600/50',
  link: 'text-brand-700 hover:text-brand-800 underline-offset-4 hover:underline px-0 py-0 h-auto',
};
const sizes: Record<Size, string> = {
  xs: 'h-7 px-2.5 text-xs gap-1.5 rounded-md',
  sm: 'h-8 px-3 text-[13px] gap-1.5 rounded-lg',
  md: 'h-10 px-4 text-sm gap-2 rounded-lg',
  lg: 'h-12 px-5 text-[15px] gap-2 rounded-xl',
};

/** The class list behind both Button and LinkButton, so the two never drift. */
export function buttonClass(variant: Variant = 'primary', size: Size = 'md', block?: boolean, className?: string) {
  return cn(
    'inline-flex items-center justify-center font-medium transition-colors focus-ring disabled:cursor-not-allowed select-none whitespace-nowrap',
    variants[variant],
    variant !== 'link' && sizes[size],
    block && 'w-full',
    className,
  );
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant; size?: Size; loading?: boolean; icon?: ReactNode; iconRight?: ReactNode; block?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading, icon, iconRight, block, className, children, disabled, type = 'button', ...rest }, ref,
) {
  return (
    <button ref={ref} type={type} disabled={disabled || loading} aria-busy={loading || undefined}
      className={buttonClass(variant, size, block, className)} {...rest}>
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : icon}
      {children}
      {!loading && iconRight}
    </button>
  );
});

export function IconButton({ label, className, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button type="button" aria-label={label} title={label} className={cn('inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 hover:text-navy-900 focus-ring transition-colors', className)} {...rest}>
      {children}
    </button>
  );
}
/**
 * A link that looks like a button. Kept separate from Button rather than
 * given an `as` prop: a navigation is an anchor, and screen readers and
 * middle-click both depend on it actually being one.
 */
export function LinkButton<T extends string>({
  href,
  variant = 'primary',
  size = 'md',
  block,
  icon,
  iconRight,
  className,
  children,
}: {
  href: Route<T>;
  variant?: Variant;
  size?: Size;
  block?: boolean;
  icon?: ReactNode;
  iconRight?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={buttonClass(variant, size, block, className)}>
      {icon}
      {children}
      {iconRight}
    </Link>
  );
}
