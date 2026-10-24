import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { communityGetSafe } from '@/server/portal-data';
import type { MemberDetail } from '@/types';
import { MemberProfile } from './member-profile';

export const metadata: Metadata = { title: 'Member' };

export default async function MemberPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const member = await communityGetSafe<MemberDetail>(`/members/${id}`);
  if (!member) notFound();
  return <MemberProfile member={member} />;
}
