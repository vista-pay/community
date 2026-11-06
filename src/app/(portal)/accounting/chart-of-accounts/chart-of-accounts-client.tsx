'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Landmark, PiggyBank, Receipt, Scale, TrendingUp, Wallet } from 'lucide-react';
import { Badge, Card, CardHeader, DataTable, EmptyState, Input, PageHeader } from '@/components/ui';
import { money } from '@/lib/format';
import type { BookAccount } from '@/types';

/**
 * The five account classes, in the order a balance sheet reads them.
 *
 * `normal` is which side increases the account. It is shown because a
 * negative balance is only meaningful once you know which way the account is
 * supposed to lean — a liability with a debit balance means something is
 * wrong, and nothing on the page said so before.
 */
const CLASSES = [
  {
    type: 'ASSET',
    label: 'Assets',
    normal: 'Debit',
    icon: Landmark,
    blurb: 'What the community owns or is owed.',
  },
  {
    type: 'LIABILITY',
    label: 'Liabilities',
    normal: 'Credit',
    icon: Scale,
    blurb: 'What it owes members and others.',
  },
  {
    type: 'EQUITY',
    label: 'Equity',
    normal: 'Credit',
    icon: PiggyBank,
    blurb: "Members' capital and accumulated reserves.",
  },
  {
    type: 'INCOME',
    label: 'Income',
    normal: 'Credit',
    icon: TrendingUp,
    blurb: 'Dues, charges and other earnings.',
  },
  {
    type: 'EXPENSE',
    label: 'Expenses',
    normal: 'Debit',
    icon: Receipt,
    blurb: 'What it costs to run the community.',
  },
] as const;

type Tab = 'all' | (typeof CLASSES)[number]['type'];

export function ChartOfAccountsClient({ initial }: { initial: BookAccount[] }) {
  const [tab, setTab] = useState<Tab>('all');
  const [search, setSearch] = useState('');

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of initial) map.set(a.type, (map.get(a.type) ?? 0) + 1);
    return map;
  }, [initial]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return initial
      .filter((a) => (tab === 'all' ? true : a.type === tab))
      .filter((a) => !q || a.code.includes(q) || a.name.toLowerCase().includes(q))
      .sort((a, b) => a.code.localeCompare(b.code));
  }, [initial, tab, search]);

  return (
    <>
      <PageHeader
        title="Chart of accounts"
        subtitle="Every account the books post to"
        breadcrumb={
          <Link href="/accounting" className="hover:text-navy-900">
            Accounting
          </Link>
        }
      />

      {/* One card per class. The counts come from the data rather than being
          hardcoded, so an account added to the chart shows up here. */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {CLASSES.map((c) => (
          <button
            key={c.type}
            type="button"
            onClick={() => setTab(tab === c.type ? 'all' : c.type)}
            className={`rounded-xl border bg-white p-4 text-left shadow-card transition focus-ring ${
              tab === c.type ? 'border-brand-500 ring-2 ring-brand-500/20' : 'border-slate-200/80 hover:border-slate-300'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-navy-50 text-navy-700">
                <c.icon className="h-4 w-4" />
              </span>
              <Badge tone={c.normal === 'Debit' ? 'blue' : 'purple'}>{c.normal}</Badge>
            </div>
            <p className="mt-3 text-[15px] font-semibold text-navy-900">{c.label}</p>
            <p className="mt-0.5 text-xs text-slate-500">{c.blurb}</p>
            <p className="tnum mt-2 text-[13px] font-semibold text-navy-900">
              {counts.get(c.type) ?? 0}
              <span className="ml-1 text-xs font-normal text-slate-500">accounts</span>
            </p>
          </button>
        ))}
      </div>

      <Card>
        <CardHeader
          title={tab === 'all' ? 'All accounts' : CLASSES.find((c) => c.type === tab)?.label}
          subtitle="Select an account to see every posting against it."
          action={
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search code or name"
              className="w-56"
              aria-label="Search accounts"
            />
          }
        />
        {rows.length === 0 ? (
          <EmptyState
            icon={<Wallet className="h-5 w-5" />}
            title="No accounts match"
            body="Clear the search, or pick a different account class."
          />
        ) : (
          <DataTable
            rows={rows}
            rowKey={(a) => a.id}
            columns={[
              {
                key: 'code',
                header: 'Code',
                cell: (a) => <span className="tnum font-semibold text-navy-900">{a.code}</span>,
              },
              {
                key: 'name',
                header: 'Account',
                cell: (a) => (
                  <Link
                    // Object form: typed routes reject a template literal
                    // carrying a query string.
                    href={{ pathname: '/accounting/ledger', query: { account: a.id } }}
                    className="font-medium text-navy-900 hover:text-brand-700"
                  >
                    {a.name}
                  </Link>
                ),
              },
              { key: 'group', header: 'Group', cell: (a) => a.group },
              {
                key: 'type',
                header: 'Class',
                cell: (a) => <Badge tone="slate">{a.type}</Badge>,
              },
              {
                key: 'balance',
                header: 'Balance',
                align: 'right',
                cell: (a) => (
                  <span
                    className={
                      Number(a.balance) < 0 ? 'tnum font-semibold text-red-600' : 'tnum'
                    }
                    // A balance on the wrong side of its own account is a
                    // signal, not a formatting quirk.
                    title={
                      Number(a.balance) < 0
                        ? 'Negative for this account class — worth investigating'
                        : undefined
                    }
                  >
                    {money(a.balance, 'NGN')}
                  </span>
                ),
              },
            ]}
          />
        )}
      </Card>
    </>
  );
}
