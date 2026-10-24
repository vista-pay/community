import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import type { Route } from 'next';
import { AppShell } from '@/components/layout/app-shell';
import { SessionProvider } from '@/components/providers/session-provider';
import { NoWorkspace } from '@/components/layout/no-workspace';
import { loadSession } from '@/server/portal-data';

/**
 * Every portal page renders inside this. The session is read once here, on
 * the server, so the shell knows the officer and their community before the
 * first byte goes out — no signed-out flash, no client round trip.
 */
export default async function PortalLayout({ children }: { children: ReactNode }) {
  const session = await loadSession();

  // The cookie said there was a session but the API disagrees. Exit through
  // the route handler that can actually clear the cookies — redirecting
  // straight to /signin leaves the flag cookie set, and the middleware
  // bounces it back here forever.
  // typedRoutes only knows pages, not route handlers.
  if (!session) redirect('/api/auth/expired' as Route);

  if (!session.community) {
    return <NoWorkspace email={session.user.email} />;
  }

  return (
    <SessionProvider session={session}>
      <AppShell>{children}</AppShell>
    </SessionProvider>
  );
}
