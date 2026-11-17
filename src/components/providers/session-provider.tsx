'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { authApi } from '@/lib/api';
import { useRealtimeEvent } from '@/hooks/use-realtime';
import type { PortalSession } from '@/types';

interface SessionApi extends PortalSession {
  /** Switch which community the officer is administering. */
  switchCommunity: (communityId: string) => Promise<void>;
  signOut: () => Promise<void>;
  switching: boolean;
}

const Ctx = createContext<SessionApi | null>(null);

/**
 * The signed-in officer and the community they are working in.
 *
 * The values come from the server layout, which read them from the session
 * cookie — so the first render already knows who you are, with no flash of a
 * signed-out shell and no client fetch on every page.
 */
export function SessionProvider({
  session,
  children,
}: {
  session: PortalSession;
  children: ReactNode;
}) {
  const router = useRouter();
  const [switching, setSwitching] = useState(false);

  const switchCommunity = useCallback(
    async (communityId: string) => {
      if (communityId === session.community?.id) return;
      setSwitching(true);
      try {
        await authApi.switchCommunity(communityId);
        // The cookie decides which community the server renders, so a plain
        // refresh is what actually swaps the workspace.
        router.refresh();
      } finally {
        setSwitching(false);
      }
    },
    [router, session.community?.id],
  );

  const signOut = useCallback(async () => {
    await authApi.signOut();
    router.replace('/signin');
    router.refresh();
  }, [router]);

  /**
   * A platform decision landed on this community, or on this officer's
   * standing in it — a suspension, a deactivation, a restore, a change to
   * their administrator access.
   *
   * `router.refresh()` rather than patching local state: the session is read
   * by the server layout, so a refresh re-reads it from the API and the halt
   * banner, the navigation and the officer's permissions all come back
   * consistent. Patching one field here would leave the other two stale,
   * which is exactly the "one app shows a different status" problem this
   * whole path exists to prevent.
   *
   * The event is a hint carrying ids only; the API decides what this officer
   * may now see.
   */
  const onPlatformChange = useCallback(
    (payload: { communityId?: string }) => {
      if (payload.communityId && payload.communityId !== session.community?.id) return;
      router.refresh();
    },
    [router, session.community?.id],
  );

  useRealtimeEvent('community.status.changed', onPlatformChange);
  useRealtimeEvent('membership.changed', onPlatformChange);

  const value = useMemo<SessionApi>(
    () => ({ ...session, switchCommunity, signOut, switching }),
    [session, switchCommunity, signOut, switching],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useSession must be used inside SessionProvider');
  return ctx;
}

/**
 * Whether the active officer may act on a resource.
 *
 * Mirrors the API's rule: `*` matches anything, and `write` implies `read`.
 * A community whose payload predates permissions returns true, so an older
 * server cannot lock officers out of their own portal — the API remains the
 * authority either way; this only decides what the UI offers.
 */
export function useCan(): (resource: string, action: 'read' | 'write') => boolean {
  const { community } = useSession();
  return (resource, action) => {
    const permissions = community?.permissions;
    if (!permissions) return true;
    return permissions.some(
      (p) =>
        (p.resource === resource || p.resource === '*') &&
        (p.action === '*' || p.action === action || (action === 'read' && p.action === 'write')),
    );
  };
}

/** The active community id, or throws — use inside the portal shell only. */
export function useCommunityId() {
  const { community } = useSession();
  if (!community) throw new Error('No active community');
  return community.id;
}
