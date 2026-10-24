'use client';

import { useState } from 'react';
import { Download } from 'lucide-react';
import {
  Button,
  Card,
  CardHeader,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Stat,
} from '@/components/ui';
import { Bars, C, Donut, Legendary } from '@/components/charts/Charts';
import { useQuery } from '@/hooks/use-query';
import { useCommunityId } from '@/components/providers/session-provider';
import { portalApi } from '@/services/portal';
import { downloadCsv } from '@/lib/csv';
import { money } from '@/lib/format';
import { moneyToNumber } from '@/lib/money';
import { ACCOUNT_TYPE_LABELS } from '@/data/catalog';
import type { DashboardData, SavingsOverview, Statements } from '@/types';

export function ReportsClient({
  statements: initial,
  dashboard,
  savings,
}: {
  statements: Statements;
  dashboard: DashboardData;
  savings: SavingsOverview;
}) {
  const communityId = useCommunityId();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const statements = useQuery(
    () => portalApi.statements(communityId, { from: from || undefined, to: to || undefined }),
    [communityId, from, to],
    { initial },
  );

  const s = statements.data ?? initial;

  // Charts need plain numbers; the exact figures beside them still come
  // from the decimal strings, so nothing displayed has been rounded twice.
  const palette = [C.green, C.navy, C.gold, C.slate, C.amber, C.red];

  const incomeRows = s.rows
    .filter((r) => r.type === 'INCOME' && Number(r.balance) !== 0)
    .map((r, i) => ({ name: r.name, value: moneyToNumber(r.balance), color: palette[i % palette.length]! }));

  const expenseRows = s.rows
    .filter((r) => r.type === 'EXPENSE' && Number(r.balance) !== 0)
    .map((r) => ({ name: r.name, amount: moneyToNumber(r.balance) }));

  return (
    <>
      <PageHeader
        title="Reports"
        subtitle="Built from the books, not from a separate copy of the numbers"
        actions={
          <Button
            variant="secondary"
            icon={<Download className="h-4 w-4" />}
            onClick={() =>
              downloadCsv(
                'trial-balance.csv',
                s.rows.map((r) => ({
                  Code: r.code,
                  Account: r.name,
                  Type: ACCOUNT_TYPE_LABELS[r.type],
                  Debit: r.debit,
                  Credit: r.credit,
                  Balance: r.balance,
                })),
              )
            }
          >
            Export trial balance
          </Button>
        }
      />

      <Card className="mb-6">
        <div className="flex flex-wrap items-end gap-4 px-5 py-4">
          <Field label="From" htmlFor="rp-from" className="w-44">
            <Input id="rp-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label="To" htmlFor="rp-to" className="w-44">
            <Input id="rp-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </Field>
          {(from || to) && (
            <Button
              variant="ghost"
              onClick={() => {
                setFrom('');
                setTo('');
              }}
            >
              Clear
            </Button>
          )}
          <p className="ml-auto text-xs text-slate-500">
            {from || to
              ? 'Figures below cover the selected dates only.'
              : 'Showing everything since the books opened.'}
          </p>
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Income" value={money(s.incomeStatement.income)} />
        <Stat label="Expenditure" value={money(s.incomeStatement.expense)} />
        <Stat
          label="Surplus"
          value={money(s.incomeStatement.surplus)}
          tone={Number(s.incomeStatement.surplus) < 0 ? 'danger' : 'positive'}
        />
        <Stat label="Member savings" value={money(savings.totals.savingsLedger)} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Where income comes from" />
          <div className="px-5 py-4">
            {incomeRows.length === 0 ? (
              <EmptyState compact title="No income recorded" body="Posted income appears here." />
            ) : (
              <>
                <Donut
                  data={incomeRows}
                  center={{ label: 'Total', value: money(s.incomeStatement.income, 'NGN', { compact: true }) }}
                />
                <Legendary
                  items={incomeRows.map((r) => ({
                    name: r.name,
                    color: r.color,
                    value: money(r.value),
                  }))}
                />
              </>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Where money goes" />
          <div className="px-5 py-4">
            {expenseRows.length === 0 ? (
              <EmptyState compact title="No expenditure recorded" body="Posted expenses appear here." />
            ) : (
              <Bars
                data={expenseRows}
                x="name"
                series={[{ key: 'amount', name: 'Spent', color: C.navy }]}
              />
            )}
          </div>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader title="Membership" />
          <dl className="divide-y divide-slate-100">
            <ReportRow label="Active members" value={String(dashboard.members.active)} />
            <ReportRow
              label="Applications in review"
              value={String(dashboard.members.pendingApplications)}
            />
            <ReportRow label="Savings accounts" value={String(savings.totals.members)} />
          </dl>
        </Card>

        <Card>
          <CardHeader title="Contributions" />
          <dl className="divide-y divide-slate-100">
            <ReportRow label="Ajo groups" value={String(dashboard.ajo.groups)} />
            <ReportRow label="Running" value={String(dashboard.ajo.active)} />
            <ReportRow label="Arrears" value={money(dashboard.ajo.arrears)} />
          </dl>
        </Card>

        <Card>
          <CardHeader title="Lending" />
          <dl className="divide-y divide-slate-100">
            <ReportRow label="Applications" value={String(dashboard.lending.applications)} />
            <ReportRow label="Outstanding" value={money(dashboard.lending.outstanding)} />
            <ReportRow label="In default" value={String(dashboard.lending.defaulted)} />
          </dl>
        </Card>
      </div>
    </>
  );
}

function ReportRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-5 py-2.5">
      <dt className="text-[13px] text-slate-600">{label}</dt>
      <dd className="tnum text-[13px] font-medium text-navy-900">{value}</dd>
    </div>
  );
}
