'use client';

import { cn, initials } from '@/lib/format';
const palette = ['bg-navy-100 text-navy-800', 'bg-brand-100 text-brand-800', 'bg-gold-100 text-gold-600', 'bg-sky-100 text-sky-800', 'bg-violet-100 text-violet-800', 'bg-rose-100 text-rose-800', 'bg-teal-100 text-teal-800'];
export function Avatar({ name, size = 'md', src, className }: { name: string; size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'; src?: string; className?: string }) {
  const s = { xs: 'h-6 w-6 text-[10px]', sm: 'h-8 w-8 text-xs', md: 'h-9 w-9 text-[13px]', lg: 'h-12 w-12 text-base', xl: 'h-16 w-16 text-lg' }[size];
  const hash = [...name].reduce((a, c) => a + c.charCodeAt(0), 0);
  // Avatars come from arbitrary member-supplied URLs; next/image would need
  // every one of those hosts allow-listed, so a plain tag is correct here.
  if (src)
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt="" className={cn('shrink-0 rounded-full object-cover', s, className)} />
    );
  return <span aria-hidden className={cn('inline-flex shrink-0 items-center justify-center rounded-full font-semibold', s, palette[hash % palette.length], className)}>{initials(name) || '?'}</span>;
}