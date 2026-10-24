'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Bell,
  CheckCircle2,
  Dices,
  ListOrdered,
  Wallet,
} from 'lucide-react';
import {
  Badge,
  Button,
  Callout,
  Card,
  CardHeader,
  ConfirmDialog,
  DataTable,
  EmptyState,
  PageHeader,
  ProgressBar,
  StatusBadge,
  Stat,
  Tabs,
} from '@/components/ui';
import { useMutation, useQuery } from '@/hooks/use-query';
import { useToast } from '@/components/providers/toast-provider';
import { portalApi } from '@/services/portal';
import { date, humanise, money } from '@/lib/format';
import { percentOf } from '@/lib/money';
import { InvitePanel } from '@/components/ajo/invite-panel';
import type { AjoGroupDetail, ContributionBoard, PayoutPosition } from '@/types';

type Tab = 'board' | 'positions' | 'members';

export function AjoGroupClient({
  group,
  cycleId,
  initialBoard,
  initialPositions,
}: {
  group: AjoGroupDetail;
  cycleId: string | null;
  initialBoard: ContributionBoard | null;
  initialPositions: PayoutPosition[];
}) {
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>('board');
  const [drawing, setDrawing] = useState(false);

  const board = useQuery<ContributionBoard | null>(
    () => (cycleId ? portalApi.contributionBoard(cycleId) : Promise.resolve(null)),
    [cycleId],
    { initial: initialBoard, enabled: Boolean(cycleId) },
  );

  const positions = useQuery<PayoutPosition[]>(
    () => (cycleId ? portalApi.positions(cycleId) : Promise.resolve([])),
    [cycleId],
    { initial: initialPositions, enabled: Boolean(cycleId) },
  );

  const remind = useMutation(() => portalApi.sendReminders(cycleId!), {
    onSuccess: (result) =>
      // The server caps reminders per member per day, so the message may say
      // some were skipped. Show what it actually did.
      toast('Reminders processed', 'info', result.message),
    onError: (message) => toast('Could not send reminders', 'error', message),
  });

  const runDraw = useMutation(() => portalApi.runDraw(cycleId!), {
    onSuccess: async () => {
      toast('Draw complete', 'success', 'The result is recorded and cannot be re-rolled.');
      setDrawing(false);
      await positions.refresh();
    },
    onError: (message) => toast('The draw did not run', 'error', message),
  });

  const autoAssign = useMutation(() => portalApi.autoAssignPositions(cycleId!), {
    onSuccess: async () => {
      toast('Positions assigned', 'success');
      await positions.refresh();
    },
    onError: (message) => toast('Could not assign positions', 'error', message),
  });

  const b = board.data;
  const collectedPercent = b ? percentOf(b.collected, b.expected) : 0;
  const unpaid = (b?.members ?? []).filter((m) => m.status !== 'PAID');

  return (
    <>
      <PageHeader
        breadcrumb={
          <Link href="/contributions" className="inline-flex items-center gap-1 hover:text-navy-900">
            <ArrowLeft className="h-3.5 w-3.5" /> Contributions
          </Link>
        }
        title={group.name}
        subtitle={`${money(group.contributionAmount, group.currencyCode)} ${humanise(group.frequency)} · ${group.members.length} members`}
        actions={
          cycleId ? (
            <>
              <Button
                variant="secondary"
                icon={<Bell className="h-4 w-4" />}
                loading={remind.pending}
                disabled={unpaid.length === 0}
                onClick={() => void remind.run()}
              >
                Remind {unpaid.length || ''}
              </Button>
              <Button icon={<Dices className="h-4 w-4" />} onClick={() => setDrawing(true)}>
                Run draw
              </Button>
            </>
          ) : null
        }
      />

      {!cycleId && (
        <Callout tone="warning" title="No cycle is running" className="mb-6">
          A cycle is what members actually contribute to. Create one to start collecting.
        </Callout>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat
          label="Group pool"
          value={money(group.pool?.balance ?? '0', group.currencyCode)}
          hint="Held in the group's own wallet"
          icon={<Wallet className="h-4 w-4" />}
        />
        <Stat
          label="Collected this round"
          value={b ? money(b.collected, group.currencyCode) : '—'}
          hint={b ? `of ${money(b.expected, group.currencyCode)} expected` : undefined}
          icon={<CheckCircle2 className="h-4 w-4" />}
        />
        <Stat
          label="Still to pay"
          value={unpaid.length}
          icon={<Bell className="h-4 w-4" />}
          tone={unpaid.length ? 'warning' : 'positive'}
        />
      </div>

      {b && (
        <div className="mt-4">
          <ProgressBar value={collectedPercent} />
          <p className="mt-1.5 text-xs text-slate-500">
            Round {b.round} · {Math.round(collectedPercent)}% collected
          </p>
        </div>
      )}

      <Tabs
        className="mt-6"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'board', label: 'Contribution board', count: unpaid.length || undefined },
          { value: 'positions', label: 'Payout order', count: positions.data?.length },
          { value: 'members', label: 'Members', count: group.members.length },
        ]}
      />

      <div className="mt-4">
        {tab === 'board' && (
          <Card>
            <DataTable
              rows={b?.members ?? []}
              rowKey={(m) => m.membershipId}
              loading={board.loading}
              columns={[
                { key: 'name', header: 'Member', cell: (m) => m.name },
                {
                  key: 'due',
                  header: 'Due',
                  hideOnMobile: true,
                  cell: (m) => <span className="text-slate-500">{date(m.dueDate)}</span>,
                },
                {
                  key: 'amount',
                  header: 'Paid',
                  align: 'right',
                  cell: (m) => (
                    <span>
                      {money(m.amountPaid, group.currencyCode)}
                      <span className="text-slate-400">
                        {' '}
                        / {money(m.amountDue, group.currencyCode)}
                      </span>
                    </span>
                  ),
                },
                { key: 'status', header: 'Status', cell: (m) => <StatusBadge status={m.status.toLowerCase()} /> },
              ]}
              empty={
                <EmptyState
                  title={cycleId ? 'Nobody is due yet' : 'No cycle running'}
                  body={
                    cycleId
                      ? 'Obligations appear once the cycle opens its first round.'
                      : 'Create a cycle to start collecting contributions.'
                  }
                />
              }
            />
          </Card>
        )}

        {tab === 'positions' && (
          <Card>
            <CardHeader
              title="Payout order"
              subtitle="Who collects the pool, and when"
              action={
                cycleId && (positions.data ?? []).every((p) => !p.holder) ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={<ListOrdered className="h-3.5 w-3.5" />}
                    loading={autoAssign.pending}
                    onClick={() => void autoAssign.run()}
                  >
                    Auto-assign
                  </Button>
                ) : null
              }
            />
            <DataTable
              rows={positions.data ?? []}
              rowKey={(p) => p.id}
              loading={positions.loading}
              columns={[
                {
                  key: 'position',
                  header: '#',
                  cell: (p) => <span className="tnum font-medium">{p.position}</span>,
                },
                { key: 'holder', header: 'Member', cell: (p) => p.holder?.name ?? '— unassigned —' },
                {
                  key: 'date',
                  header: 'Scheduled',
                  hideOnMobile: true,
                  cell: (p) => (p.scheduledPayoutDate ? date(p.scheduledPayoutDate) : '—'),
                },
                {
                  key: 'payout',
                  header: 'Payout',
                  align: 'right',
                  cell: (p) =>
                    p.payout ? money(p.payout.netAmount, group.currencyCode) : '—',
                },
                {
                  key: 'status',
                  header: 'Status',
                  cell: (p) => (
                    <Badge tone={p.payout?.status === 'PAID' ? 'green' : 'slate'}>
                      {humanise(p.payout?.status ?? p.status)}
                    </Badge>
                  ),
                },
              ]}
              empty={
                <EmptyState
                  icon={<ListOrdered className="h-5 w-5" />}
                  title="No positions yet"
                  body="Assign the payout order, or run a draw to decide it fairly."
                />
              }
            />
          </Card>
        )}

        {tab === 'members' && (
          <div className="space-y-6">
            <InvitePanel
              groupId={group.id}
              groupName={group.name}
              invitationCode={group.invitationCode}
              memberCount={group.members.length}
              memberLimit={group.memberLimit}
            />

            <Card>
            <DataTable
              rows={group.members}
              rowKey={(m) => m.membershipId}
              columns={[
                { key: 'name', header: 'Member', cell: (m) => m.name },
                { key: 'role', header: 'Role', cell: (m) => <Badge tone="slate">{humanise(m.role)}</Badge> },
                { key: 'status', header: 'Status', cell: (m) => <StatusBadge status={m.status.toLowerCase()} /> },
                {
                  key: 'joined',
                  header: 'Joined',
                  hideOnMobile: true,
                  cell: (m) => (m.joinedAt ? date(m.joinedAt) : '—'),
                },
              ]}
              empty={
                <EmptyState
                  title="No members yet"
                  body="Share the code or QR above, or invite people by email."
                />
              }
            />
            </Card>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={drawing}
        onClose={() => setDrawing(false)}
        title="Run the draw?"
        confirmLabel="Run draw"
        loading={runDraw.pending}
        onConfirm={() => void runDraw.run()}
        body={
          <>
            The server picks the winner and records the result with a commitment hash. It cannot be
            re-run or reversed, and every member can see the outcome.
          </>
        }
      />
    </>
  );
}
