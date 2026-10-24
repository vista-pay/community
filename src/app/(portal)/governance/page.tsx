import type { Metadata } from 'next';
import { communityGet } from '@/server/portal-data';
import type { CommunityDocument, Fine, MemberRow, Meeting, Poll } from '@/types';
import { GovernanceClient } from './governance-client';

export const metadata: Metadata = { title: 'Governance' };

export default async function GovernancePage() {
  const [meetings, polls, documents, fines, members] = await Promise.all([
    communityGet<Meeting[]>('/governance/meetings'),
    communityGet<Poll[]>('/governance/polls'),
    communityGet<CommunityDocument[]>('/governance/documents'),
    communityGet<Fine[]>('/governance/fines'),
    communityGet<MemberRow[]>('/members'),
  ]);

  return <GovernanceClient initial={{ meetings, polls, documents, fines, members }} />;
}
