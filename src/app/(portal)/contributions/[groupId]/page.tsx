import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { apiServerSafe } from '@/server/portal-data';
import type { AjoGroupDetail, ContributionBoard, PayoutPosition } from '@/types';
import { AjoGroupClient } from './ajo-group-client';

export const metadata: Metadata = { title: 'Ajo group' };

export default async function AjoGroupPage({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;

  const group = await apiServerSafe<AjoGroupDetail>(`/ajo-groups/${groupId}`);
  if (!group) notFound();

  const activeCycle = group.cycles.find((c) => c.status === 'ACTIVE') ?? group.cycles[0] ?? null;

  const [board, positions] = activeCycle
    ? await Promise.all([
        apiServerSafe<ContributionBoard>(`/ajo-cycles/${activeCycle.id}/contribution-board`),
        apiServerSafe<PayoutPosition[]>(`/ajo-cycles/${activeCycle.id}/positions`),
      ])
    : [null, null];

  return (
    <AjoGroupClient
      group={group}
      cycleId={activeCycle?.id ?? null}
      initialBoard={board}
      initialPositions={positions ?? []}
    />
  );
}
