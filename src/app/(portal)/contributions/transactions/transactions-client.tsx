'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowUpRight,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Download,
  ReceiptText,
} from 'lucide-react';
import {
  Button,
  Card,
  CardHeader,
  type Column,
  DataTable,
  EmptyState,
  Input,
  PageHeader,
  Select,
  Stat,
  StatusBadge,
} from '@/components/ui';
import { useQuery } from '@/hooks/use-query';
import { useDebounced } from '@/hooks/use-debounced';
import { useCommunityId } from '@/components/providers/session-provider';
import { portalApi } from '@/services/portal';
import { date, humanise, money, num } from '@/lib/format';
import { sumMoney } from '@/lib/money';
import { downloadCsv } from '@/lib/csv';
import type { ContributionTransaction, ContributionTransactionPage } from '@/types';

const PAGE_SIZE = 50;

const TYPE_LABELS: Record<string, string> = {
  AJO_CONTRIBUTION: 'Contribution paid in',
  AJO_PAYOUT: 'Payout to member',
  AJO_LOAN_DISBURSEMENT: 'Loan from the pool',
  AJO_LOAN_REPAYMENT: 'Loan repaid',
  AJO_FINE: 'Late fine',
  REVERSAL: 'Reversal',
};

const typeLabel = (t: { type: string }) => TYPE_LABELS[t.type] ?? humanise(t.type);

/**
 * The contribution pools' own transaction history.
 *
 * It needs to exist separately because the money is separate: each Ajo group
 * banks into its own pool wallet, so none of this passes through the merchant
 * account and none of it appears in that history. An officer looking for a
 * member's contribution in the merchant list finds nothing and reasonably
 * concludes a payment went missing.
 *
 * Deliberately the same shape as the merchant history — same filters, same
 * columns, same paging — so the two read as two views of one idea rather than
 * two different screens that happen to list money.
 */
export function ContributionTransactionsClient({
  initial,
}: {
  initial: ContributionTransactionPage;
}) {
  const communityId = useCommunityId();

  const [page, setPage] = useState(1);
  const [direction, setDirection] = useState<'all' | 'in' | 'out'>('all');
  const [groupId, setGroupId] = useState('all');
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const debouncedSearch = useDebounced(search, 350);

  const untouched =
    page === 1 &&
    direction === 'all' &&
    groupId === 'all' &&
    !debouncedSearch &&
    !from &&
    !to;

  const { data, loading } = useQuery<ContributionTransactionPage>(
    () =>
      portalApi.contributionTransactions(communityId, {
        page,
        limit: PAGE_SIZE,
        direction,
        groupId,
        search: debouncedSearch.trim() || undefined,
        from: from || undefined,
        to: to || undefined,
      }),
    [communityId, page, direction, groupId, debouncedSearch, from, to],
    { initial: untouched ? initial : undefined },
  );

  const rows = data?.items ?? [];
  const total = data?.total ?? 0;
  const lastPage = Math.max(1, data?.pages ?? 1);
  const groups = data?.groups ?? initial.groups;

  // Totals for what is on screen, so a filtered view reports its own sum
  // rather than a figure that silently belongs to the whole table.
  const paidIn = sumMoney(rows.filter((r) => r.credit).map((r) => r.amount));
  const paidOut = sumMoney(rows.filter((r) => !r.credit).map((r) => r.amount));

  const resetTo =
    <T,>(setter: (value: T) => void) =>
    (value: T) => {
      setter(value);
      setPage(1);
    };

  const columns: Column<ContributionTransaction>[] = [
    {
      key: 'what',
      header: 'Movement',
      cell: (t) => (
        <div className="flex items-center gap-3">
          <span
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
              t.credit ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-600'
            }`}
          >
            {t.credit ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
          </span>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-medium text-navy-900">{typeLabel(t)}</p>
            {(t.member || t.narration) && (
              <p className="truncate text-xs text-slate-500">{t.member ?? t.narration}</p>
            )}
            <p className="mt-1 truncate text-[11.5px] text-slate-400 md:hidden">
              {t.group?.name ?? '—'}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: 'group',
      header: 'Group',
      hideOnMobile: true,
      cell: (t) =>
        t.group ? (
          <Link
            href={`/contributions/${t.group.id}`}
            className="text-[12.5px] font-medium text-brand-700 hover:underline"
          >
            {t.group.name}
          </Link>
        ) : (
          <span className="text-xs text-slate-400">—</span>
        ),
    },
    {
      key: 'reference',
      header: 'Reference',
      hideOnMobile: true,
      cell: (t) => <span className="font-mono text-xs text-slate-500">{t.reference}</span>,
    },
    {
      key: 'account',
      header: 'Chart of account',
      hideOnMobile: true,
      cell: (t) =>
        t.coaAccount ? (
          <Link
            href={{ pathname: '/accounting/ledger', query: { account: t.coaAccount.id } }}
            className="inline-flex items-center gap-1 text-[12.5px] font-medium text-brand-700 hover:underline"
          >
            <BookOpen className="h-3.5 w-3.5 shrink-0" />
            <span className="font-mono">{t.coaAccount.code}</span>
            <span className="truncate">· {t.coaAccount.name}</span>
          </Link>
        ) : (
          <span className="text-xs text-slate-400">—</span>
        ),
    },
    {
      key: 'status',
      header: 'Status',
      hideOnMobile: true,
      cell: (t) => <StatusBadge status={t.status.toLowerCase()} />,
    },
    {
      key: 'date',
      header: 'Date',
      hideOnMobile: true,
      cell: (t) => <span className="text-slate-500">{date(t.createdAt)}</span>,
    },
    {
      key: 'amount',
      header: 'Amount',
      align: 'right',
      cell: (t) => (
        <span
          className={`tnum text-[13px] font-semibold ${
            t.credit ? 'text-emerald-600' : 'text-navy-900'
          }`}
        >
          {t.credit ? '+' : '−'}
          {money(t.amount, t.currencyCode)}
        </span>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Contribution transactions"
        subtitle="Every movement through the community's contribution pools"
        breadcrumb={
          <Link
            href="/contributions"
            className="inline-flex items-center gap-1.5 hover:text-navy-900"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Contributions &amp; Ajo
          </Link>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat
          label="Movements"
          value={num(total)}
          hint={untouched ? 'All time' : 'Matching your filters'}
          icon={<ReceiptText className="h-4 w-4" />}
        />
        <Stat
          label="Paid in"
          value={money(paidIn)}
          hint="Contributions on this page"
          icon={<ArrowDownLeft className="h-4 w-4" />}
          tone="positive"
        />
        <Stat
          label="Paid out"
          value={money(paidOut)}
          hint="Payouts and loans on this page"
          icon={<ArrowUpRight className="h-4 w-4" />}
        />
      </div>

      <Card>
        <CardHeader
          title="Pool movements"
          subtitle="Each group banks into its own pool, so none of this passes through the merchant account"
          action={
            <Button
              size="sm"
              variant="secondary"
              icon={<Download className="h-3.5 w-3.5" />}
              disabled={rows.length === 0}
              onClick={() =>
                downloadCsv(
                  `contribution-transactions-page-${page}.csv`,
                  rows.map((t) => ({
                    Date: date(t.createdAt, 'datetime'),
                    Group: t.group?.name ?? null,
                    Movement: typeLabel(t),
                    Direction: t.credit ? 'In' : 'Out',
                    Amount: money(t.amount, t.currencyCode),
                    Member: t.member,
                    Status: humanise(t.status),
                    Reference: t.reference,
                    'Chart of account': t.coaAccount
                      ? `${t.coaAccount.code} · ${t.coaAccount.name}`
                      : 'Unassigned',
                  })),
                )
              }
            >
              Export this page
            </Button>
          }
        />

        <div className="grid gap-3 border-b border-slate-100 px-5 py-4 md:grid-cols-[minmax(0,1fr)_10rem_9rem] lg:grid-cols-[minmax(0,1fr)_10rem_9rem_9rem_9rem]">
          <Input
            value={search}
            onChange={(event) => resetTo(setSearch)(event.target.value)}
            placeholder="Search reference or member"
            aria-label="Search contribution transactions"
          />
          <Select
            value={groupId}
            onChange={(event) => resetTo(setGroupId)(event.target.value)}
            aria-label="Filter by group"
          >
            <option value="all">All groups</option>
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </Select>
          <Select
            value={direction}
            onChange={(event) => resetTo(setDirection)(event.target.value as 'all' | 'in' | 'out')}
            aria-label="Filter by direction"
          >
            <option value="all">All movements</option>
            <option value="in">Paid in</option>
            <option value="out">Paid out</option>
          </Select>
          <Input
            type="date"
            value={from}
            onChange={(event) => resetTo(setFrom)(event.target.value)}
            aria-label="From date"
          />
          <Input
            type="date"
            value={to}
            onChange={(event) => resetTo(setTo)(event.target.value)}
            aria-label="To date"
          />
        </div>

        <DataTable
          rows={rows}
          rowKey={(t) => t.id}
          columns={columns}
          loading={loading && !data}
          empty={
            <EmptyState
              icon={<ReceiptText className="h-5 w-5" />}
              title={untouched ? 'No contribution movements yet' : 'No matching movements'}
              body={
                untouched
                  ? 'Contributions, payouts and pool loans appear here once a cycle is running.'
                  : 'Try changing or clearing the filters.'
              }
            />
          }
          mobile={(t) => (
            <div className="space-y-1">
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium text-navy-900">{typeLabel(t)}</p>
                <span
                  className={`tnum text-[13px] font-semibold ${
                    t.credit ? 'text-emerald-600' : 'text-navy-900'
                  }`}
                >
                  {t.credit ? '+' : '−'}
                  {money(t.amount, t.currencyCode)}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                {t.group?.name ?? '—'}
                {t.member ? ` · ${t.member}` : ''}
              </p>
              <p className="text-xs text-slate-400">
                {date(t.createdAt, 'datetime')} · {humanise(t.status)}
              </p>
            </div>
          )}
        />

        {lastPage > 1 && (
          <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-4 py-3">
            <p className="text-sm text-slate-500">
              Page {data?.page ?? page} of {num(lastPage)}
            </p>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="h-4 w-4" /> Previous
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={page >= lastPage || loading}
                onClick={() => setPage((p) => p + 1)}
              >
                Next <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </>
  );
}
