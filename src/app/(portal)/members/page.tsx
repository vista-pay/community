import type { Metadata } from 'next';
import { communityGet, communityGetSafe } from '@/server/portal-data';
import type { DashboardData, MemberRow } from '@/types';
import { MembersClient } from './all/members-client';

export const metadata: Metadata = { title: 'Members' };

export default async function MembersPage() {
  // Safe: the hub is still useful without counts, and a dashboard hiccup
  // should not stop an officer reaching the pages behind it.
  const dashboard = await communityGetSafe<DashboardData>('/dashboard');
  const members = await communityGet<MemberRow[]>('/members');
  return <MembersClient initial={members} counts={dashboard?.navigationCounts ?? null} />;
}
