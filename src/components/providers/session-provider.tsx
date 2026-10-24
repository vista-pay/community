'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { authApi } from '@/lib/api';
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

/** The active community id, or throws — use inside the portal shell only. */
export function useCommunityId() {
  const { community } = useSession();
  if (!community) throw new Error('No active community');
  return community.id;
}
