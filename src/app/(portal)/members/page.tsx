import type { Metadata } from 'next';
import { communityGetSafe } from '@/server/portal-data';
import type { DashboardData } from '@/types';
import { MembersHubClient } from './members-hub-client';

export const metadata: Metadata = { title: 'Members' };

export default async function MembersPage() {
  // Safe: the hub is still useful without counts, and a dashboard hiccup
  // should not stop an officer reaching the pages behind it.
  const dashboard = await communityGetSafe<DashboardData>('/dashboard');
  return <MembersHubClient counts={dashboard?.navigationCounts ?? null} />;
}
