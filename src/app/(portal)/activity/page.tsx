import type { Metadata } from 'next';
import { communityGetSafe } from '@/server/portal-data';
import type { ActivityFeed } from '@/types';
import { ActivityClient } from './activity-client';

export const metadata: Metadata = { title: 'Activity' };

/**
 * Everything the community has done, not the dashboard's last seven rows.
 *
 * Fetched here so the first page of the trail is already on screen; the
 * client refetches whenever a filter changes.
 */
export default async function ActivityPage() {
  const initial = await communityGetSafe<ActivityFeed>('/activity', { page: 1, limit: 50 });
  return <ActivityClient initial={initial ?? undefined} />;
}
