import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { communityGet, isKycRequired } from '@/server/portal-data';
import type { PollDetail } from '@/types';
import { PollResultClient } from './poll-result-client';

export const metadata: Metadata = { title: 'Ballot result' };

export default async function PollResultPage({
  params,
}: {
  params: Promise<{ pollId: string }>;
}) {
  const { pollId } = await params;
  let poll: PollDetail;
  try {
    poll = await communityGet<PollDetail>(`/governance/polls/${pollId}`);
  } catch (error) {
    // A ballot that is not this community's reads as missing, not as an
    // error — it is the same answer either way and says less about what
    // other communities are running.
    if (!isKycRequired(error)) notFound();
    throw error;
  }

  return <PollResultClient initial={poll} />;
}
