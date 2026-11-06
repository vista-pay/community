'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle, ArrowLeftRight, CheckCircle2, Download, Scale } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  DataTable,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Select,
  Stat,
  Toggle,
} from '@/components/ui';
import { useCommunityId } from '@/components/providers/session-provider';
import { useQuery } from '@/hooks/use-query';
import { portalApi } from '@/services/portal';
import { downloadCsv } from '@/lib/csv';
import { money } from '@/lib/format';
import { compareMoney, isZeroMoney, subtractMoney } from '@/lib/money';
import { ACCOUNT_TYPE_LABELS } from '@/data/catalog';
import type { BookAccountType, Statements } from '@/types';
import { ServiceControlSchedule } from '@/components/accounting/service-control-schedule';

type Row = Statements['rows'][number];
type TypeFilter = 'ALL' | BookAccountType;

export function TrialBalanceClient({ initial }: { initial: Statements }) {
  const communityId = useCommunityId();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [query, setQuery] = useState('');
  const [type, setType] = useState<TypeFilter>('ALL');
  const [showZero, setShowZero] = useState(false);

  const statements = useQuery(
    () => portalApi.statements(communityId, { from: from || undefined, to: to || undefined }),
    [communityId, from, to],
    { initial },
  );
  const data = statements.data ?? initial;

  const rows = useMemo(() => {
    const term = query.trim().toLowerCase();
    return data.rows.filter((row) => {
      if (!showZero && isZeroMoney(row.debit) && isZeroMoney(row.credit)) return false;
      if (type !== 'ALL' && row.type !== type) return false;
      if (term && !`${row.code} ${row.name} ${row.group}`.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [data.rows, query, showZero, type]);

  const difference = subtractMoney(data.trialBalance.debit, data.trialBalance.credit);

  // Movement is not value. Every entry posts equal debits and credits, so the
  // two totals always match and both grow with activity — a reversal pair
  // adds twice its own amount while changing the position by nothing. The
  // numbers officers actually want are the net balances.
  const netOf = (types: BookAccountType[]) =>
    data.rows
      .filter((r) => types.includes(r.type))
      .reduce((sum, r) => sum + Number(r.balance || 0), 0);
  const netAssets = netOf(['ASSET']);
  const netLiabilities = netOf(['LIABILITY']);

  // Accounts that netted to zero: money passed straight through them, or an
  // entry was reversed. They inflate the movement totals and tell you nothing
  // about the position, which is the single most confusing thing on this page.
  const passThrough = data.rows.filter(
    (r) =>
      (!isZeroMoney(r.debit) || !isZeroMoney(r.credit)) && isZeroMoney(r.balance),
  );
  const passThroughMovement = passThrough.reduce((sum, r) => sum + Number(r.debit || 0), 0);

  // Balancing proves each entry was internally consistent. It proves nothing
  // about whether everything that happened was recorded — which is exactly
  // how a community reporting negative assets still showed a green tick.
  const looksIncomplete = data.trialBalance.balanced && (netAssets < 0 || netLiabilities < 0);
  const movementCount = data.rows.filter(
    (row) => !isZeroMoney(row.debit) || !isZeroMoney(row.credit),
  ).length;
  const periodLabel = from || to
    ? `${from || 'Books opened'} to ${to || 'Today'}`
    : 'All posted entries';

  const exportRows = () =>
    downloadCsv(
      'trial-balance.csv',
      rows.map((row) => ({
        Code: row.code,
        Account: row.name,
        Group: row.group,
        Type: ACCOUNT_TYPE_LABELS[row.type],
        Debit: row.debit,
        Credit: row.credit,
        Balance: row.balance,
      })),
    );

  return (
    <>
      <PageHeader
        title="Trial balance"
        subtitle="Movement and net balance for every account. Balancing proves the entries are consistent, not that they are complete."
        actions={
          <Button
            variant="secondary"
            icon={<Download className="h-4 w-4" />}
            onClick={exportRows}
            disabled={!rows.length}
          >
            Export CSV
          </Button>
        }
      />

      {!data.trialBalance.balanced && (
        <Card className="mb-5 border-red-200 bg-red-50">
          <div className="flex items-start gap-3 px-5 py-4">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
            <div>
              <p className="text-sm font-semibold text-red-900">Trial balance is out of balance</p>
              <p className="mt-1 text-[13px] leading-5 text-red-800">
                Debits and credits differ by {money(difference)}. Review direct adjustments and
                recently imported entries before closing the accounting period.
              </p>
            </div>
          </div>
        </Card>
      )}

      {looksIncomplete && (
        <Card className="mb-5 border-amber-300 bg-amber-50">
          <div className="flex items-start gap-3 px-5 py-4">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <div>
              <p className="text-sm font-semibold text-amber-900">
                The books balance, but they look incomplete
              </p>
              <p className="mt-1 text-[13px] leading-5 text-amber-800">
                Debits equal credits, so every entry is internally consistent. But{' '}
                {netAssets < 0 ? 'assets' : 'the amount owed to members'} is negative, which means
                money left the books that never entered them — a movement reached the wallet
                without being recorded here. Balancing cannot detect that.
              </p>
            </div>
          </div>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Balance status"
          value={data.trialBalance.balanced ? 'Balanced' : 'Out of balance'}
          hint={
            data.trialBalance.balanced
              ? 'Every entry posts equal debits and credits. This does not prove everything was recorded.'
              : periodLabel
          }
          icon={
            data.trialBalance.balanced ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <AlertTriangle className="h-4 w-4" />
            )
          }
          tone={data.trialBalance.balanced ? 'positive' : 'danger'}
        />
        <Stat
          // "Volume" is the word most officers reach for, and pairing it
          // with "movement" removes the last reading where this looks like a
          // balance the community holds.
          label="Total movement (volume)"
          value={money(data.trialBalance.debit)}
          hint="Everything posted, both sides. Not what the community holds."
          icon={<ArrowLeftRight className="h-4 w-4" />}
          footer={
            passThroughMovement > 0 ? (
              <span className="text-slate-500">
                {money(String(passThroughMovement))} passed through accounts that net to zero
              </span>
            ) : undefined
          }
        />
        <Stat
          label="Net position"
          value={money(String(netAssets))}
          hint={`Assets, after offsetting. Owed to members ${money(String(netLiabilities))}.`}
          icon={<Scale className="h-4 w-4" />}
          tone={netAssets < 0 ? 'danger' : 'default'}
        />
        <Stat
          label="Difference"
          value={money(difference)}
          hint={`${movementCount} of ${data.rows.length} accounts have movement`}
          tone={compareMoney(difference, '0') === 0 ? 'positive' : 'danger'}
        />
      </div>

      <ServiceControlSchedule data={data} />

      <Card className="mt-6">
        <CardHeader title="Reporting period" subtitle="Dates apply to posted journal entries" />
        <div className="grid gap-4 px-5 py-4 sm:grid-cols-2 lg:grid-cols-[180px_180px_minmax(220px,1fr)_190px_auto] lg:items-end">
          <Field label="From" htmlFor="tb-from">
            <Input
              id="tb-from"
              type="date"
              value={from}
              max={to || undefined}
              onChange={(event) => setFrom(event.target.value)}
            />
          </Field>
          <Field label="To" htmlFor="tb-to">
            <Input
              id="tb-to"
              type="date"
              value={to}
              min={from || undefined}
              onChange={(event) => setTo(event.target.value)}
            />
          </Field>
          <Field label="Search accounts" htmlFor="tb-search">
            <Input
              id="tb-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Code, account or group"
            />
          </Field>
          <Field label="Account type" htmlFor="tb-type">
            <Select
              id="tb-type"
              value={type}
              onChange={(event) => setType(event.target.value as TypeFilter)}
            >
              <option value="ALL">All account types</option>
              {(Object.keys(ACCOUNT_TYPE_LABELS) as BookAccountType[]).map((value) => (
                <option key={value} value={value}>
                  {ACCOUNT_TYPE_LABELS[value]}
                </option>
              ))}
            </Select>
          </Field>
          <div className="flex items-center pb-2">
            <Toggle checked={showZero} onChange={setShowZero} label="Show zero accounts" />
            <span className="ml-2 text-xs text-slate-600">Show zero accounts</span>
          </div>
        </div>
      </Card>

      <Card className="mt-6">
        <CardHeader
          title="Account balances"
          subtitle={`${rows.length} account${rows.length === 1 ? '' : 's'} shown · ${periodLabel}`}
          action={
            from || to || query || type !== 'ALL' || showZero ? (
              <Button
                variant="ghost"
                onClick={() => {
                  setFrom('');
                  setTo('');
                  setQuery('');
                  setType('ALL');
                  setShowZero(false);
                }}
              >
                Clear filters
              </Button>
            ) : undefined
          }
        />
        <DataTable
          rows={rows}
          rowKey={(row) => row.id}
          loading={statements.loading}
          columns={[
            {
              key: 'code',
              header: 'Code',
              cell: (row) => <span className="tnum font-medium">{row.code}</span>,
            },
            {
              key: 'account',
              header: 'Account',
              cell: (row) => (
                <div>
                  <p className="font-medium text-navy-900">{row.name}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{row.group}</p>
                </div>
              ),
            },
            {
              key: 'type',
              header: 'Type',
              cell: (row) => <Badge tone="slate">{ACCOUNT_TYPE_LABELS[row.type]}</Badge>,
            },
            {
              key: 'debit',
              header: 'Debit',
              align: 'right',
              // Dimmed when it nets to nothing: the figure is real movement
              // but contributes nothing to the position, and showing it at
              // full weight is what makes the totals look inexplicable.
              cell: (row) => (
                <span className={isZeroMoney(row.balance) ? 'text-slate-400' : undefined}>
                  {money(row.debit)}
                </span>
              ),
            },
            {
              key: 'credit',
              header: 'Credit',
              align: 'right',
              cell: (row) => (
                <span className={isZeroMoney(row.balance) ? 'text-slate-400' : undefined}>
                  {money(row.credit)}
                </span>
              ),
            },
            {
              key: 'balance',
              header: 'Balance',
              align: 'right',
              cell: (row) => {
                const zero = isZeroMoney(row.balance);
                const wrongSide = Number(row.balance) < 0;
                return (
                  <span
                    className={
                      wrongSide
                        ? 'font-semibold text-red-600'
                        : zero
                          ? 'text-slate-400'
                          : 'font-semibold text-navy-900'
                    }
                    // A balance on the wrong side of its own account class is
                    // a real signal, not a formatting quirk.
                    title={
                      wrongSide
                        ? `Negative for a ${ACCOUNT_TYPE_LABELS[row.type]} account — worth investigating`
                        : zero
                          ? 'Nets to zero — money passed through, or an entry was reversed'
                          : undefined
                    }
                  >
                    {money(row.balance)}
                  </span>
                );
              },
            },
          ]}
          mobile={(row: Row) => (
            <div className="space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-navy-900">
                    {row.code} · {row.name}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">{row.group}</p>
                </div>
                <Badge tone="slate">{ACCOUNT_TYPE_LABELS[row.type]}</Badge>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <Value label="Debit" value={money(row.debit)} />
                <Value label="Credit" value={money(row.credit)} />
                <Value label="Balance" value={money(row.balance)} align="right" strong />
              </div>
            </div>
          )}
          empty={
            <EmptyState
              compact
              title="No matching accounts"
              body="Adjust the filters or post journal entries for this period."
            />
          }
        />
        <div className="grid gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4 text-sm sm:grid-cols-3">
          <p className="font-semibold text-navy-900">Trial balance totals</p>
          <p className="tnum text-right">
            <span className="mr-2 text-xs text-slate-500">Debit</span>
            {money(data.trialBalance.debit)}
          </p>
          <p className="tnum text-right">
            <span className="mr-2 text-xs text-slate-500">Credit</span>
            {money(data.trialBalance.credit)}
          </p>
        </div>
      </Card>
    </>
  );
}

function Value({
  label,
  value,
  align,
  strong,
}: {
  label: string;
  value: string;
  align?: 'right';
  strong?: boolean;
}) {
  return (
    <div className={align === 'right' ? 'text-right' : undefined}>
      <p className="text-slate-400">{label}</p>
      <p className={`tnum mt-0.5 ${strong ? 'font-semibold text-navy-900' : 'text-slate-700'}`}>
        {value}
      </p>
    </div>
  );
}
