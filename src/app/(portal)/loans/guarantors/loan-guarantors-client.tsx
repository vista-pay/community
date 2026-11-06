'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import { Phone, ShieldCheck, ShieldQuestion, ShieldX, UserCog } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  DataTable,
  EmptyState,
  PageHeader,
  Stat,
  StatusBadge,
  Tabs,
} from '@/components/ui';
import { useMutation, useQuery } from '@/hooks/use-query';
import { useCommunityId } from '@/components/providers/session-provider';
import { useToast } from '@/components/providers/toast-provider';
import { portalApi } from '@/services/portal';
import { date, money, relative } from '@/lib/format';
import type { LoanGuarantorRow } from '@/types';

/** Stable empty result: `?? []` inline re-runs the memos on every poll. */
const NONE: never[] = [];

type Filter = 'PENDING' | 'CONFIRMED' | 'DECLINED' | 'all';

/**
 * Who stands behind each loan.
 *
 * Flattened to one row per guarantor rather than nested under loans: the
 * question on this page is "who has not answered?", and a per-loan tree
 * makes that into a hunt.
 */
export function LoanGuarantorsClient({ initial }: { initial: LoanGuarantorRow[] }) {
  const communityId = useCommunityId();
  const { toast } = useToast();
  const [filter, setFilter] = useState<Filter>('PENDING');
  const [recording, setRecording] = useState<{ row: LoanGuarantorRow; confirm: boolean } | null>(
    null,
  );

  const { data, refresh } = useQuery<LoanGuarantorRow[]>(
    () => portalApi.loanGuarantors(communityId),
    [communityId],
    { initial },
  );
  const all = data ?? NONE;

  const counts = useMemo(
    () => ({
      PENDING: all.filter((g) => g.status === 'PENDING').length,
      CONFIRMED: all.filter((g) => g.status === 'CONFIRMED').length,
      DECLINED: all.filter((g) => g.status === 'DECLINED').length,
    }),
    [all],
  );

  const rows = useMemo(
    () => (filter === 'all' ? all : all.filter((g) => g.status === filter)),
    [all, filter],
  );

  // Recording the answer a guarantor gave off-platform — a call, a signed
  // form. It is the only path for an external guarantor, who has no app to
  // answer in, and it unblocks a platform one who cannot.
  const record = useMutation(
    (loanId: string, guarantorId: string, confirm: boolean) =>
      portalApi.reviewGuarantor(loanId, guarantorId, confirm),
    {
      onSuccess: async () => {
        toast('Answer recorded', 'success', 'The loan can move on.');
        setRecording(null);
        await refresh();
      },
      onError: (message) => toast('Could not record the answer', 'error', message),
    },
  );

  return (
    <>
      <PageHeader
        title="Guarantors"
        subtitle="Who stands behind each loan, and who has not answered yet"
        breadcrumb={
          <Link href={'/loans' as Route} className="hover:text-navy-700">
            Loans
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat
          label="Waiting on an answer"
          value={counts.PENDING}
          icon={<ShieldQuestion className="h-4 w-4" />}
          tone={counts.PENDING ? 'warning' : 'default'}
        />
        <Stat label="Confirmed" value={counts.CONFIRMED} icon={<ShieldCheck className="h-4 w-4" />} />
        <Stat label="Declined" value={counts.DECLINED} icon={<ShieldX className="h-4 w-4" />} />
      </div>

      <Tabs
        className="mt-6 mb-4"
        value={filter}
        onChange={setFilter}
        tabs={[
          { value: 'PENDING', label: 'Waiting', count: counts.PENDING },
          { value: 'CONFIRMED', label: 'Confirmed', count: counts.CONFIRMED },
          { value: 'DECLINED', label: 'Declined', count: counts.DECLINED },
          { value: 'all', label: 'All', count: all.length },
        ]}
      />

      <Card>
        <DataTable
          rows={rows}
          rowKey={(g) => g.id}
          columns={[
            {
              key: 'guarantor',
              header: 'Guarantor',
              cell: (g) => (
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate font-medium text-navy-900">{g.name}</span>
                    {g.isExternal && <Badge tone="slate">Not on Rendi</Badge>}
                  </span>
                  <span className="block truncate text-xs text-slate-500">
                    {g.email ?? g.phone ?? '—'}
                  </span>
                </span>
              ),
            },
            {
              key: 'loan',
              header: 'Stands behind',
              cell: (g) => (
                <span>
                  <span className="block text-[13px] font-medium text-navy-900">
                    {g.loanReference}
                  </span>
                  <span className="block text-xs text-slate-500">
                    {g.borrower ?? '—'} · {money(g.principal, g.currencyCode)}
                  </span>
                </span>
              ),
            },
            {
              key: 'loanStatus',
              header: 'Loan',
              hideOnMobile: true,
              cell: (g) => <StatusBadge status={g.loanStatus.toLowerCase()} />,
            },
            {
              key: 'asked',
              header: 'Asked',
              hideOnMobile: true,
              cell: (g) => (
                <span className="text-[12.5px] text-slate-600" title={date(g.createdAt)}>
                  {relative(g.createdAt)}
                </span>
              ),
            },
            {
              key: 'answer',
              header: 'Answer',
              cell: (g) =>
                g.status === 'PENDING' ? (
                  <Badge tone="amber">Waiting</Badge>
                ) : (
                  <span className="flex flex-col gap-0.5">
                    <Badge tone={g.status === 'CONFIRMED' ? 'green' : 'red'}>
                      {g.status === 'CONFIRMED' ? 'Confirmed' : 'Declined'}
                    </Badge>
                    {g.recordedByOfficer && (
                      <span className="inline-flex items-center gap-1 text-[11.5px] text-slate-500">
                        <UserCog className="h-3 w-3" />
                        recorded by an officer
                      </span>
                    )}
                  </span>
                ),
            },
            {
              key: 'actions',
              header: '',
              align: 'right',
              cell: (g) =>
                g.status === 'PENDING' ? (
                  <span className="flex flex-wrap justify-end gap-1.5">
                    <Button
                      size="xs"
                      variant="ghost"
                      onClick={() => setRecording({ row: g, confirm: false })}
                    >
                      They declined
                    </Button>
                    <Button
                      size="xs"
                      variant="secondary"
                      icon={<Phone className="h-3.5 w-3.5" />}
                      onClick={() => setRecording({ row: g, confirm: true })}
                    >
                      They confirmed
                    </Button>
                  </span>
                ) : null,
            },
          ]}
          empty={
            <EmptyState
              icon={<ShieldCheck className="h-5 w-5" />}
              title={
                filter === 'PENDING' ? 'Nobody is waiting to answer' : 'Nothing in this state'
              }
              body="Guarantors appear here as soon as a borrower names them on an application."
            />
          }
        />
      </Card>

      <ConfirmDialog
        open={Boolean(recording)}
        onClose={() => setRecording(null)}
        onConfirm={() =>
          recording &&
          void record.run(recording.row.loanId, recording.row.id, recording.confirm)
        }
        loading={record.pending}
        title={
          recording?.confirm ? 'Record a confirmation?' : 'Record a declined guarantee?'
        }
        confirmLabel={recording?.confirm ? 'Record confirmation' : 'Record decline'}
        tone={recording?.confirm ? 'primary' : 'danger'}
        body={
          recording ? (
            <>
              You are recording the answer {recording.row.name} gave you directly — by phone, in
              person or on a signed form. It is kept as an officer-recorded answer, not as one they
              gave in the app.
            </>
          ) : (
            ''
          )
        }
      />
    </>
  );
}
