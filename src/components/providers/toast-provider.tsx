'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { cn } from '@/lib/format';

export type ToastKind = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: string;
  kind: ToastKind;
  title: string;
  body?: string;
}

interface ToastApi {
  toast: (title: string, kind?: ToastKind, body?: string) => void;
  dismiss: (id: string) => void;
  toasts: Toast[];
}

const Ctx = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: string) => {
    setToasts((list) => list.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const toast = useCallback(
    (title: string, kind: ToastKind = 'success', body?: string) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      // Cap the stack: four is already more than anyone reads.
      setToasts((list) => [...list.slice(-3), { id, kind, title, body }]);
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), 5000),
      );
    },
    [dismiss],
  );

  // Clear outstanding timers on unmount so a navigation mid-toast does not
  // leave a callback holding a dead setState.
  useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach(clearTimeout);
      pending.clear();
    };
  }, []);

  const value = useMemo(() => ({ toast, dismiss, toasts }), [toast, dismiss, toasts]);

  return (
    <Ctx.Provider value={value}>
      {children}
      <Toaster toasts={toasts} dismiss={dismiss} />
    </Ctx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}

function Toaster({ toasts, dismiss }: { toasts: Toast[]; dismiss: (id: string) => void }) {
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-60 flex flex-col items-center gap-2 p-4 sm:items-end"
    >
      {toasts.map((t) => {
        const Icon =
          t.kind === 'error'
            ? XCircle
            : t.kind === 'warning'
              ? AlertTriangle
              : t.kind === 'info'
                ? Info
                : CheckCircle2;
        const color =
          t.kind === 'error'
            ? 'text-red-500'
            : t.kind === 'warning'
              ? 'text-amber-500'
              : t.kind === 'info'
                ? 'text-sky-400'
                : 'text-brand-400';
        return (
          <div
            key={t.id}
            className="pointer-events-auto flex w-full max-w-sm animate-fade-in items-start gap-3 rounded-xl bg-navy-900 px-4 py-3 text-white shadow-pop"
          >
            <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', color)} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{t.title}</p>
              {t.body && <p className="mt-0.5 text-[13px] text-navy-200">{t.body}</p>}
            </div>
            <button
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss"
              className="rounded p-0.5 text-navy-300 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
