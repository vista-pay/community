'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import { Undo2 } from 'lucide-react';
import {
  Card,
  DataTable,
  EmptyState,
  Input,
  PageHeader,
  Stat,
  StatusBadge,
} from '@/components/ui';
import { useQuery } from '@/hooks/use-query';
import { useCommunityId } from '@/components/providers/session-provider';
import { portalApi } from '@/services/portal';
import { date, money } from '@/lib/format';
import { sumMoney } from '@/lib/money';
import type { LoanRepaymentRow } from '@/types';

/** Stable empty result: `?? []` inline re-runs the memos on every poll. */
const NONE: never[] = [];

/**
 * What came back.
 *
 * Kept separate from the loan list because a settled loan drops out of
 * "what is outstanding" — and its repayments are precisely what proves it
 * was settled.
 */
export function LoanRepaymentsClient({ initial }: { initial: LoanRepaymentRow[] }) {
  const communityId = useCommunityId();
  const [search, setSearch] = useState('');

  const { data } = useQuery<LoanRepaymentRow[]>(
    () => portalApi.loanRepayments(communityId),
    [communityId],
    { initial },
  );
  const all = data ?? NONE;

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return all;
    return all.filter(
      (r) =>
        r.loanReference.toLowerCase().includes(needle) ||
        (r.borrower ?? '').toLowerCase().includes(needle),
    );
  }, [all, search]);

  const total = useMemo(() => sumMoney(rows.map((r) => r.amount)), [rows]);

  return (
    <>
      <PageHeader
        title="Loan repayments"
        subtitle="Every repayment recorded, including on loans already settled"
        breadcrumb={
          <Link href={'/loans' as Route} className="hover:text-navy-700">
            Loans
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Repayments" value={rows.length} icon={<Undo2 className="h-4 w-4" />} />
        <Stat label="Total repaid" value={money(total)} />
        <Stat
          label="Loans repaying"
          value={new Set(rows.map((r) => r.loanId)).size}
          hint="Distinct loans on this page"
        />
      </div>

      <Card className="mt-6">
        <div className="border-b border-slate-100 p-4">
          <Input
            placeholder="Search by reference or borrower"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="max-w-xs"
          />
        </div>
        <DataTable
          rows={rows}
          rowKey={(r) => r.id}
          columns={[
            {
              key: 'paid',
              header: 'Paid',
              cell: (r) => <span className="text-[12.5px] text-slate-600">{date(r.paidAt)}</span>,
            },
            {
              key: 'ref',
              header: 'Loan',
              cell: (r) => (
                <span>
                  <span className="block font-medium text-navy-900">{r.loanReference}</span>
                  <span className="block text-xs text-slate-500">{r.borrower ?? '—'}</span>
                </span>
              ),
            },
            {
              key: 'amount',
              header: 'Amount',
              align: 'right',
              cell: (r) => money(r.amount, r.currencyCode),
            },
            {
              key: 'outstanding',
              header: 'Still owed',
              align: 'right',
              hideOnMobile: true,
              cell: (r) => money(r.outstanding, r.currencyCode),
            },
            {
              key: 'status',
              header: 'Loan status',
              cell: (r) => <StatusBadge status={r.loanStatus.toLowerCase()} />,
            },
          ]}
          empty={
            <EmptyState
              icon={<Undo2 className="h-5 w-5" />}
              title={search ? 'Nothing matches that search' : 'No repayments yet'}
              body={
                search
                  ? 'Try a loan reference or part of a borrower’s name.'
                  : 'Repayments appear here as soon as a borrower pays, in full or in part.'
              }
            />
          }
        />
      </Card>
    </>
  );
}
