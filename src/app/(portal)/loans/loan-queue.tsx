'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import { HandCoins, Send } from 'lucide-react';
import {
  Button,
  Card,
  ConfirmDialog,
  DataTable,
  EmptyState,
  PageHeader,
  Stat,
  StatusBadge,
} from '@/components/ui';
import { useMutation, useQuery } from '@/hooks/use-query';
import { useCommunityId } from '@/components/providers/session-provider';
import { useToast } from '@/components/providers/toast-provider';
import { MoneyOutOtpDialog, useMoneyOutOtp } from '@/components/money-out-otp';
import { portalApi } from '@/services/portal';
import { date, money } from '@/lib/format';
import { sumMoney } from '@/lib/money';
import type { Loan, LoanStatus } from '@/types';
import { LoanDetailModal } from './loan-detail-modal';

/** Stable empty result: `?? []` inline re-runs the memos on every poll. */
const NONE: never[] = [];

const DECIDABLE: LoanStatus[] = ['SUBMITTED', 'UNDER_REVIEW'];

/**
 * One stage of the loan book.
 *
 * Every stage is the same list filtered differently, so filtering happens
 * here rather than in six near-identical pages — and the review, disburse and
 * detail actions exist once, which is what keeps "approve" meaning the same
 * thing on whichever page an officer happens to be standing.
 */
export function LoanQueue({
  title,
  subtitle,
  statuses,
  initial,
  emptyTitle,
  emptyBody,
}: {
  title: string;
  subtitle: string;
  statuses: LoanStatus[];
  initial: Loan[];
  emptyTitle: string;
  emptyBody: string;
}) {
  const communityId = useCommunityId();
  const { toast } = useToast();
  const [deciding, setDeciding] = useState<{ loan: Loan; approve: boolean } | null>(null);
  const [viewing, setViewing] = useState<Loan | null>(null);

  const { data, refresh } = useQuery<Loan[]>(
    () => portalApi.communityLoans(communityId),
    [communityId],
    { initial },
  );
  const all = data ?? NONE;

  // Keyed on the contents, not the array: `statuses` arrives as a fresh
  // literal from the server component on every render, so depending on its
  // identity would defeat the memo entirely.
  const stageKey = statuses.join(',');
  const rows = useMemo(
    () => all.filter((l) => stageKey.split(',').includes(l.status)),
    [all, stageKey],
  );
  const outstanding = useMemo(() => sumMoney(rows.map((l) => l.outstanding)), [rows]);
  const principal = useMemo(() => sumMoney(rows.map((l) => l.principal)), [rows]);

  const review = useMutation(
    (loanId: string, approve: boolean, notes?: string) =>
      portalApi.reviewLoan(loanId, approve, undefined, notes),
    {
      onSuccess: async () => {
        toast('Decision recorded', 'success');
        setDeciding(null);
        await refresh();
      },
      onError: (message) => toast('Could not record the decision', 'error', message),
    },
  );

  // Disbursing takes money out of the community, so it goes through the owner
  // approval gate rather than straight to the API. The gate makes the first
  // call itself and only prompts if the server asks for a code.
  const disburse = useMoneyOutOtp<string>({
    perform: (extra, loanId) => portalApi.disburseLoan(loanId, extra),
    onDone: refresh,
    successMessage: 'Loan disbursed — the money has left the community',
  });

  return (
    <>
      <PageHeader
        title={title}
        subtitle={subtitle}
        breadcrumb={
          <Link href={'/loans' as Route} className="hover:text-navy-700">
            Loans
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat
          label="Loans on this page"
          value={rows.length}
          icon={<HandCoins className="h-4 w-4" />}
          tone={rows.length && statuses.includes('SUBMITTED') ? 'warning' : 'default'}
        />
        <Stat label="Principal" value={money(principal)} />
        <Stat label="Still outstanding" value={money(outstanding)} />
      </div>

      <Card className="mt-6">
        <DataTable
          rows={rows}
          rowKey={(l) => l.id}
          onRowClick={(l) => setViewing(l)}
          columns={[
            {
              key: 'ref',
              header: 'Reference',
              cell: (l) => (
                <span>
                  <span className="block font-medium text-navy-900">{l.loanReference}</span>
                  {l.purpose && (
                    <span className="block truncate text-xs text-slate-500">{l.purpose}</span>
                  )}
                </span>
              ),
            },
            { key: 'borrower', header: 'Borrower', cell: (l) => l.borrower ?? '—' },
            {
              key: 'principal',
              header: 'Principal',
              align: 'right',
              cell: (l) => money(l.principal, l.currencyCode),
            },
            {
              key: 'outstanding',
              header: 'Outstanding',
              align: 'right',
              hideOnMobile: true,
              cell: (l) => money(l.outstanding, l.currencyCode),
            },
            {
              key: 'due',
              header: 'Due',
              hideOnMobile: true,
              cell: (l) => (l.dueDate ? date(l.dueDate) : '—'),
            },
            {
              key: 'status',
              header: 'Status',
              cell: (l) => <StatusBadge status={l.status.toLowerCase()} />,
            },
            {
              key: 'actions',
              header: '',
              align: 'right',
              cell: (l) => (
                <span className="flex flex-wrap justify-end gap-1.5">
                  {DECIDABLE.includes(l.status) && (
                    <>
                      <Button
                        size="xs"
                        variant="ghost"
                        onClick={() => setDeciding({ loan: l, approve: false })}
                      >
                        Reject
                      </Button>
                      <Button
                        size="xs"
                        variant="secondary"
                        onClick={() => setDeciding({ loan: l, approve: true })}
                      >
                        Approve
                      </Button>
                    </>
                  )}
                  {l.status === 'APPROVED' && (
                    <Button
                      size="xs"
                      icon={<Send className="h-3.5 w-3.5" />}
                      loading={disburse.pending}
                      onClick={() => void disburse.run(l.id)}
                    >
                      Disburse
                    </Button>
                  )}
                  <Button size="xs" variant="secondary" onClick={() => setViewing(l)}>
                    Open
                  </Button>
                </span>
              ),
            },
          ]}
          empty={
            <EmptyState
              icon={<HandCoins className="h-5 w-5" />}
              title={emptyTitle}
              body={emptyBody}
            />
          }
        />
      </Card>

      {viewing && (
        <LoanDetailModal
          loan={viewing}
          onClose={() => setViewing(null)}
          onDecide={(approve) => {
            setDeciding({ loan: viewing, approve });
            setViewing(null);
          }}
          onDisburse={() => {
            void disburse.run(viewing.id);
            setViewing(null);
          }}
        />
      )}

      <ConfirmDialog
        open={Boolean(deciding)}
        onClose={() => setDeciding(null)}
        title={deciding?.approve ? 'Approve this loan?' : 'Reject this loan?'}
        confirmLabel={deciding?.approve ? 'Approve' : 'Reject'}
        tone={deciding?.approve ? 'primary' : 'danger'}
        requireReason={!deciding?.approve}
        reasonLabel="Reason"
        loading={review.pending}
        onConfirm={(reason) =>
          deciding && void review.run(deciding.loan.id, deciding.approve, reason || undefined)
        }
        body={
          deciding?.approve ? (
            <>
              {deciding.loan.borrower ?? 'The member'} would be approved for{' '}
              {money(deciding.loan.principal, deciding.loan.currencyCode)}. Approving does not move
              money — you disburse it as a separate step.
            </>
          ) : (
            <>The applicant is told the decision. Give a reason they can act on.</>
          )
        }
      />
      {/* One dialog per screen; the gate decides when it opens. */}
      <MoneyOutOtpDialog gate={disburse} />
    </>
  );
}
