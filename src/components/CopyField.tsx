'use client';

import { useRef, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Button } from '@/components/ui';

export function CopyField({ value, label }: { value: string; label: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(value); setCopied(true); }
    catch { ref.current?.select(); setCopied(true); }
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="flex gap-2">
      <input ref={ref} readOnly value={value} aria-label={label} onFocus={(e) => e.target.select()} className="input min-w-0 flex-1 bg-slate-50 font-mono text-[13px]" />
      <Button variant="secondary" onClick={copy} icon={copied ? <Check className="h-4 w-4 text-brand-600" /> : <Copy className="h-4 w-4" />}>{copied ? 'Copied' : 'Copy'}</Button>
    </div>
  );
}