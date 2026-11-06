import type { Metadata } from 'next';
import { communityGet, communityGetSafe } from '@/server/portal-data';
import type { JoinRequest, PendingInvitation } from '@/types';
import { PendingMembersClient } from './pending-members-client';

export const metadata: Metadata = { title: 'Pending members' };

export default async function PendingMembersPage() {
  // Applications are the page's reason to exist, so a failure there should
  // surface. Invitations are the second tab — safe, so a hiccup there does
  // not take the review queue down with it.
  const [requests, invitations] = await Promise.all([
    communityGet<JoinRequest[]>('/join-review'),
    communityGetSafe<PendingInvitation[]>('/members/invitations'),
  ]);

  return <PendingMembersClient requests={requests} invitations={invitations ?? []} />;
}
