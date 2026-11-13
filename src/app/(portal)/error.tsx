'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui';

/**
 * What an officer sees when a portal page fails to render.
 *
 * Without this, a server component that throws hands the whole route to the
 * browser, which shows "This page couldn't load" and two buttons that do not
 * help — no navigation, no sign of which community they were in, no way
 * anywhere except Back. That happened in production on the payouts screen,
 * which is precisely where someone is standing when they most need the rest
 * of the portal to still work.
 *
 * Scoped to the (portal) group so the shell and its navigation survive: the
 * failure is confined to the page, not the application.
 */
export default function PortalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // The digest is the only handle on the server-side stack, which Next
    // deliberately withholds from the browser. Without logging it, a
    // production failure leaves nothing to search the server logs for.
    console.error('Portal page failed to render', error.digest ?? '', error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-lg flex-col items-center px-4 py-16 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
        <AlertTriangle className="h-6 w-6" aria-hidden />
      </span>
      <h1 className="mt-4 text-lg font-bold text-navy-900">This page didn&rsquo;t load</h1>
      <p className="mt-2 text-[13.5px] leading-relaxed text-slate-500">
        Something went wrong fetching it. Your community&rsquo;s money and records are not
        affected — this is the page failing to draw, not an action failing to save.
      </p>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Button onClick={reset} icon={<RefreshCw className="h-4 w-4" />}>
          Try again
        </Button>
        <Link href="/dashboard">
          <Button variant="secondary">Back to dashboard</Button>
        </Link>
      </div>

      {error.digest && (
        <p className="mt-6 font-mono text-[11.5px] text-slate-400">
          Reference {error.digest}
        </p>
      )}
    </div>
  );
}
