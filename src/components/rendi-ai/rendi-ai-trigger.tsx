'use client';

import { Compass } from 'lucide-react';
import { cn } from '@/lib/format';

/**
 * Rendi AI's entry point in the header, beside the notifications bell.
 *
 * A compass rather than the usual AI sparkle, because sparkle has come to
 * mean "this writes things for you" — and that is the one thing Rendi AI
 * does not do. It orients you: it says where you are, what you are looking
 * at, and takes you where you need to go. The glyph should promise that and
 * not generation.
 *
 * It carries its name rather than standing alone: a bell is a universally
 * understood glyph, a compass in a header is not, and an officer should not
 * have to hover a mystery button to discover the product has a guide. The
 * label collapses away below `sm`, where header width is the scarcer thing.
 *
 * Navy, not `brand-*` — in this theme `brand` is an emerald accent used for
 * badge counts and primary buttons, while the Rendi identity (the logo, the
 * sidebar) is navy.
 */
export function RendiAiTrigger({
  open,
  onToggle,
}: {
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label="Rendi AI"
      aria-expanded={open}
      className={cn(
        'flex h-10 items-center gap-2 rounded-lg px-2.5 focus-ring transition',
        open
          ? 'bg-navy-50 text-navy-700'
          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
      )}
    >
      <Compass className="h-5 w-5 shrink-0" />
      <span className="hidden text-[13px] font-semibold sm:inline">Rendi AI</span>
    </button>
  );
}
