import { ArrowDownRight, ArrowUpRight, Minus, TrendingUp } from 'lucide-react';
import { Badge, Card, CardHeader } from '@/components/ui';
import { money } from '@/lib/format';
import type { Statements } from '@/types';

export function ProfitAndLoss({ data }: { data?: Statements['profitAndLoss'] }) {
  if (!data) return null;
  const profitable = data.status === 'PROFIT';
  const loss = data.status === 'LOSS';

  return (
    <section className="mt-6 grid gap-4 xl:grid-cols-[340px_minmax(0,1fr)]">
      <Card className={profitable ? 'border-emerald-200' : loss ? 'border-red-200' : undefined}>
        <CardHeader title="Profit & loss position" subtitle="Income earned less operating expenses" />
        <div className="px-5 pb-5">
          <div className="flex items-center justify-between gap-3">
            <span
              className={`flex h-11 w-11 items-center justify-center rounded-xl ${
                profitable
                  ? 'bg-emerald-50 text-emerald-700'
                  : loss
                    ? 'bg-red-50 text-red-700'
                    : 'bg-slate-100 text-slate-600'
              }`}
            >
              {profitable ? <TrendingUp className="h-5 w-5" /> : loss ? <ArrowDownRight className="h-5 w-5" /> : <Minus className="h-5 w-5" />}
            </span>
            <Badge tone={profitable ? 'green' : loss ? 'red' : 'slate'}>
              {data.status === 'BREAK_EVEN' ? 'Break even' : data.status.toLowerCase()}
            </Badge>
          </div>
          <p className="tnum mt-5 text-3xl font-bold text-navy-900">{money(data.netResult)}</p>
          <p className="mt-1 text-sm text-slate-500">Net result · {data.marginPercent}% margin</p>
          <dl className="mt-5 space-y-2 border-t border-slate-100 pt-4 text-sm">
            <Row label="Total earned" value={money(data.totalIncome)} positive />
            <Row label="Total expenses" value={money(data.totalExpense)} />
            <Row label="Pending organizer fees" value={money(data.pendingFeeIncome)} muted />
          </dl>
        </div>
      </Card>

      <Card>
        <CardHeader title="Where the result came from" subtitle="Income and cost sources in the current reporting period" />
        <div className="grid divide-y divide-slate-100 md:grid-cols-2 md:divide-x md:divide-y-0">
          <SourceList title="Income sources" rows={data.incomeSources} income />
          <SourceList title="Expense sources" rows={data.expenseSources} />
        </div>
      </Card>
    </section>
  );
}

function Row({ label, value, positive, muted }: { label: string; value: string; positive?: boolean; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className={muted ? 'text-slate-400' : 'text-slate-600'}>{label}</dt>
      <dd className={`tnum font-semibold ${positive ? 'text-emerald-700' : muted ? 'text-slate-500' : 'text-navy-900'}`}>{value}</dd>
    </div>
  );
}

function SourceList({
  title,
  rows,
  income,
}: {
  title: string;
  rows: Array<{ key: string; label: string; accountCode: string; amount: string }>;
  income?: boolean;
}) {
  return (
    <div className="p-5">
      <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-navy-900">
        {income ? <ArrowUpRight className="h-4 w-4 text-emerald-600" /> : <ArrowDownRight className="h-4 w-4 text-red-500" />}
        {title}
      </p>
      {rows.length ? (
        <ul className="space-y-3">
          {rows.map((row) => (
            <li key={row.key} className="flex items-center justify-between gap-4 text-sm">
              <span className="min-w-0">
                <span className="block truncate text-slate-700">{row.label}</span>
                <span className="text-[11px] text-slate-400">{row.accountCode}</span>
              </span>
              <span className={`tnum shrink-0 font-semibold ${income ? 'text-emerald-700' : 'text-red-700'}`}>
                {money(row.amount)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-slate-500">No {income ? 'income' : 'expenses'} recorded for this period.</p>
      )}
    </div>
  );
}
