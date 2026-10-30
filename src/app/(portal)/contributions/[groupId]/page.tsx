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

  // The cycle whose lifecycle the page drives: a running one first, then a
  // locked one awaiting activation, then a draft awaiting lock.
  const cycle =
    group.cycles.find((c) => c.status === 'ACTIVE') ??
    group.cycles.find((c) => c.status === 'LOCKED') ??
    group.cycles.find((c) => c.status === 'DRAFT') ??
    group.cycles[0] ??
    null;

  // A draft has no obligations or positions yet — they exist from lock onward.
  const hasSchedule = cycle && (cycle.status === 'ACTIVE' || cycle.status === 'LOCKED');
  const [board, positions] = hasSchedule
    ? await Promise.all([
        apiServerSafe<ContributionBoard>(`/ajo-cycles/${cycle.id}/contribution-board`),
        apiServerSafe<PayoutPosition[]>(`/ajo-cycles/${cycle.id}/positions`),
      ])
    : [null, null];

  return (
    <AjoGroupClient
      group={group}
      cycle={cycle}
      initialBoard={board}
      initialPositions={positions ?? []}
    />
  );
}
