import type { Metadata } from 'next';
import { communityGet } from '@/server/portal-data';
import type { MemberRow } from '@/types';
import { MembersClient } from './members-client';

export const metadata: Metadata = { title: 'Members' };

export default async function MembersPage() {
  const members = await communityGet<MemberRow[]>('/members');
  return <MembersClient initial={members} />;
}
