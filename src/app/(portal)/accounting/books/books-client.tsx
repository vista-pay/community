'use client';

import Link from 'next/link';
import { Landmark, PiggyBank, Scale } from 'lucide-react';
import { Badge, Card, CardHeader, DataTable, PageHeader, Stat } from '@/components/ui';
import { money } from '@/lib/format';
import type { Statements } from '@/types';

/**
 * The balance sheet position.
 *
 * Assets = Liabilities + Equity + Surplus is stated explicitly and checked,
 * because a balance sheet that does not balance is the single most useful
 * thing this page can tell an officer — and the old summary cards reported
 * the figures without ever comparing them.
 */
export function BooksClient({ initial }: { initial: Statements }) {
  const sheet = initial.balanceSheet;
  const assets = Number(sheet.assets);
  const funded = Number(sheet.liabilities) + Number(sheet.equity) + Number(sheet.surplus);
  const gap = assets - funded;
  const balances = Math.abs(gap) < 0.005;

  const byClass = (type: string) => initial.rows.filter((r) => r.type === type);

  return (
    <>
      <PageHeader
        title="Books"
        subtitle="What the community owns, owes and has built up"
        breadcrumb={
          <Link href="/accounting" className="hover:text-navy-900">
            Accounting
          </Link>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Total assets" value={money(sheet.assets, 'NGN')} icon={<Landmark className="h-4 w-4" />} tone={assets < 0 ? 'danger' : 'default'} hint={assets < 0 ? 'Negative — the books are missing deposits' : undefined} />
        <Stat label="Owed to members" value={money(sheet.liabilities, 'NGN')} icon={<Scale className="h-4 w-4" />} />
        <Stat label="Equity" value={money(sheet.equity, 'NGN')} icon={<PiggyBank className="h-4 w-4" />} />
        <Stat
          label="Surplus this period"
          value={money(sheet.surplus, 'NGN')}
          tone={Number(sheet.surplus) < 0 ? 'warning' : 'positive'}
        />
      </div>

      <Card className="mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div>
            <p className="text-[15px] font-semibold text-navy-900">
              Assets = Liabilities + Equity + Surplus
            </p>
            <p className="tnum mt-1 text-[13px] text-slate-600">
              {money(sheet.assets, 'NGN')} = {money(sheet.liabilities, 'NGN')} +{' '}
              {money(sheet.equity, 'NGN')} + {money(sheet.surplus, 'NGN')}
            </p>
          </div>
          <Badge tone={balances ? 'green' : 'red'} dot>
            {balances ? 'Balances' : `Out by ${money(Math.abs(gap), 'NGN')}`}
          </Badge>
        </div>
      </Card>

      {[
        ['ASSET', 'Assets'],
        ['LIABILITY', 'Liabilities'],
        ['EQUITY', 'Equity'],
      ].map(([type, label]) => {
        const rows = byClass(type);
        if (!rows.length) return null;
        return (
          <Card key={type} className="mb-5">
            <CardHeader title={label} subtitle={`${rows.length} accounts`} />
            <DataTable
              rows={rows}
              rowKey={(r) => r.code}
              columns={[
                { key: 'code', header: 'Code', cell: (r) => <span className="tnum">{r.code}</span> },
                { key: 'name', header: 'Account', cell: (r) => r.name },
                {
                  key: 'bal',
                  header: 'Balance',
                  align: 'right',
                  cell: (r) => (
                    <span className={Number(r.balance) < 0 ? 'font-semibold text-red-600' : 'font-semibold'}>
                      {money(r.balance, 'NGN')}
                    </span>
                  ),
                },
              ]}
            />
          </Card>
        );
      })}
    </>
  );
}
