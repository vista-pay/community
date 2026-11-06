'use client';

import Link from 'next/link';
import { Receipt, TrendingDown, TrendingUp } from 'lucide-react';
import { Badge, Card, CardHeader, DataTable, EmptyState, PageHeader, ProgressBar, Stat } from '@/components/ui';
import { money } from '@/lib/format';
import type { Statements } from '@/types';

/**
 * Where income came from and what it cost to earn.
 *
 * Income and expense are shown as a share of the total as well as an amount:
 * "₦2,000 of welfare" means little until you can see it is most of what the
 * community spent.
 */
export function RevenueClient({ initial }: { initial: Statements }) {
  const pnl = initial.profitAndLoss;
  const income = Number(pnl.totalIncome);
  const expense = Number(pnl.totalExpense);
  const net = Number(pnl.netResult);

  const share = (amount: string, total: number) =>
    total > 0 ? Math.min(100, (Number(amount) / total) * 100) : 0;

  return (
    <>
      <PageHeader
        title="Revenue"
        subtitle="Income earned, what it cost, and what is left"
        breadcrumb={
          <Link href="/accounting" className="hover:text-navy-900">
            Accounting
          </Link>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Total income" value={money(pnl.totalIncome, 'NGN')} icon={<TrendingUp className="h-4 w-4" />} tone="positive" />
        <Stat label="Total expense" value={money(pnl.totalExpense, 'NGN')} icon={<TrendingDown className="h-4 w-4" />} />
        <Stat
          label="Net result"
          value={money(pnl.netResult, 'NGN')}
          tone={net < 0 ? 'danger' : net > 0 ? 'positive' : 'default'}
          hint={pnl.status === 'BREAK_EVEN' ? 'Break even' : pnl.status === 'PROFIT' ? 'Surplus' : 'Deficit'}
        />
        <Stat
          label="Margin"
          value={`${pnl.marginPercent}%`}
          hint="Net result as a share of income"
          footer={
            <Badge tone={Number(pnl.marginPercent) < 0 ? 'red' : 'green'}>
              {pnl.status.replace('_', ' ').toLowerCase()}
            </Badge>
          }
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Where income came from" subtitle="Each source as a share of total income" />
          {!pnl.incomeSources?.length ? (
            <EmptyState icon={<TrendingUp className="h-5 w-5" />} title="No income recorded yet" />
          ) : (
            <div className="space-y-3 px-5 py-4">
              {pnl.incomeSources.map((s) => (
                <div key={s.key}>
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="truncate text-[13px] font-medium text-navy-900">{s.label}</p>
                    <p className="tnum shrink-0 text-[13px] font-semibold text-navy-900">
                      {money(s.amount, 'NGN')}
                    </p>
                  </div>
                  <ProgressBar value={share(s.amount, income)} tone="brand" className="mt-1.5" />
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <CardHeader title="What it cost" subtitle="Each expense as a share of total cost" />
          {!pnl.expenseSources?.length ? (
            <EmptyState icon={<Receipt className="h-5 w-5" />} title="No expenses recorded yet" />
          ) : (
            <div className="space-y-3 px-5 py-4">
              {pnl.expenseSources.map((s) => (
                <div key={s.key}>
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="truncate text-[13px] font-medium text-navy-900">{s.label}</p>
                    <p className="tnum shrink-0 text-[13px] font-semibold text-navy-900">
                      {money(s.amount, 'NGN')}
                    </p>
                  </div>
                  <ProgressBar value={share(s.amount, expense)} tone="amber" className="mt-1.5" />
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card className="mt-5">
        <CardHeader title="Income accounts" subtitle="Every account in the income class" />
        <DataTable
          rows={initial.rows.filter((r) => r.type === 'INCOME')}
          rowKey={(r) => r.code}
          empty={<EmptyState icon={<TrendingUp className="h-5 w-5" />} title="No income accounts" />}
          columns={[
            { key: 'code', header: 'Code', cell: (r) => <span className="tnum">{r.code}</span> },
            { key: 'name', header: 'Account', cell: (r) => r.name },
            { key: 'cr', header: 'Credit', align: 'right', cell: (r) => money(r.credit, 'NGN') },
            {
              key: 'bal',
              header: 'Balance',
              align: 'right',
              cell: (r) => <span className="font-semibold">{money(r.balance, 'NGN')}</span>,
            },
          ]}
        />
      </Card>
    </>
  );
}
