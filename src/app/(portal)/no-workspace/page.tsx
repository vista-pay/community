import type { Metadata } from 'next';
import { NoWorkspace } from '@/components/layout/no-workspace';
import { apiServerSafe } from '@/lib/server-api';

export const metadata: Metadata = { title: 'No community' };

/**
 * Shown when the signed-in account administers no community.
 *
 * A real page rather than a thrown error: `requireCommunityId` used to throw,
 * which crashed whichever page called it and produced a stack trace instead
 * of an explanation.
 */
export default async function NoWorkspacePage() {
  const user = await apiServerSafe<{ email: string }>('/auth/me');
  return <NoWorkspace email={user?.email ?? 'This account'} />;
}
