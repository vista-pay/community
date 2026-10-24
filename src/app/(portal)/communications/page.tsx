import type { Metadata } from 'next';
import { communityGet } from '@/server/portal-data';
import { apiServerSafe } from '@/lib/server-api';
import { getActiveCommunityId } from '@/lib/session';
import type { Announcement, Broadcast } from '@/types';
import { CommunicationsClient } from './communications-client';

export const metadata: Metadata = { title: 'Communications' };

export default async function CommunicationsPage() {
  const communityId = await getActiveCommunityId();
  const [broadcasts, announcements] = await Promise.all([
    communityGet<Broadcast[]>('/broadcasts'),
    apiServerSafe<Announcement[]>('/announcements', { params: { communityId: communityId ?? '' } }),
  ]);

  return <CommunicationsClient broadcasts={broadcasts} announcements={announcements ?? []} />;
}
