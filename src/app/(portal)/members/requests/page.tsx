import type { Metadata } from 'next';
import { communityGet } from '@/server/portal-data';
import type { JoinRequest } from '@/types';
import { JoinRequestsClient } from './join-requests-client';

export const metadata: Metadata = { title: 'Join requests' };

export default async function JoinRequestsPage() {
  const requests = await communityGet<JoinRequest[]>('/join-review');
  return <JoinRequestsClient initial={requests} />;
}
