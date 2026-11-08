'use client';

import { useState } from 'react';
import { Activity, AlertCircle, CheckCircle2, ChevronRight, Layers3 } from 'lucide-react';
import { Badge, Button, Card, Modal } from '@/components/ui';
import { ACCOUNT_TYPE_LABELS } from '@/data/catalog';
import { money } from '@/lib/format';
import { isZeroMoney } from '@/lib/money';
import type { Statements } from '@/types';

export function ServiceControlSchedule({ data }: { data: Statements }) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const mappedServices = data.modules.filter((module) => module.accountCodes.length > 0).length;
  const activeServices = data.modules.filter((module) =>
    data.rows.some(
      (row) =>
        module.accountCodes.includes(row.code) &&
        (!isZeroMoney(row.debit) || !isZeroMoney(row.credit)),
    ),
  ).length;
  const selectedModule = data.modules.find((module) => module.key === selectedKey) ?? null;
  const selectedAccounts = selectedModule
    ? data.rows.filter((row) => selectedModule.accountCodes.includes(row.code))
    : [];

  return (
    <section className="mt-8" aria-labelledby="service-control-title">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="service-control-title" className="text-base font-semibold text-navy-900">
            Service control accounts
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-5 text-slate-500">
            See which ledger accounts support each community service and how their closing balances
            are made up.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Badge tone="blue">{mappedServices} mapped</Badge>
          <Badge tone={activeServices ? 'green' : 'slate'}>{activeServices} with activity</Badge>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {data.modules.map((module) => {
          const accounts = data.rows.filter((row) => module.accountCodes.includes(row.code));
          const hasMovement = accounts.some(
            (row) => !isZeroMoney(row.debit) || !isZeroMoney(row.credit),
          );

          return (
            <Card key={module.key} className="overflow-hidden">
              <div className="flex flex-wrap items-start justify-between gap-3 px-5 py-4">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-navy-50 text-navy-700">
                    <Layers3 className="h-4.5 w-4.5" />
                  </span>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-navy-900">{module.label}</h3>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {accounts.length
                        ? `${accounts.length} control account${accounts.length === 1 ? '' : 's'} linked`
                        : 'No ledger accounts linked'}
                    </p>
                  </div>
                </div>
                <Badge tone={hasMovement ? 'green' : 'slate'} dot>
                  {hasMovement ? 'Activity posted' : 'No activity'}
                </Badge>
              </div>

              {accounts.length ? (
                <>
                  <div className="grid grid-cols-3 border-y border-slate-100 bg-slate-50/70">
                    <Metric label="Debit" value={money(module.debit)} />
                    <Metric label="Credit" value={money(module.credit)} bordered />
                    <Metric label="Closing balance" value={money(module.balance)} bordered strong />
                  </div>

                  <div className="divide-y divide-slate-100">
                    {accounts.slice(0, 2).map((account) => (
                      <PreviewAccount key={account.id} account={account} />
                    ))}
                  </div>
                  <div className="flex items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/60 px-5 py-3">
                    <span className="text-xs text-slate-500">
                      {accounts.length === 1 ? '1 linked account' : `${accounts.length} linked accounts`}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      iconRight={<ChevronRight className="h-4 w-4" />}
                      onClick={() => setSelectedKey(module.key)}
                    >
                      View all
                    </Button>
                  </div>
                </>
              ) : (
                <div className="flex items-start gap-3 border-t border-slate-100 bg-slate-50/50 px-5 py-5">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                  <div>
                    <p className="text-sm font-medium text-slate-700">No control account mapped</p>
                    <p className="mt-1 text-[13px] leading-5 text-slate-500">
                      This service may have operational records, but it cannot appear in the trial
                      balance until its ledger accounts are mapped.
                    </p>
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      <Modal
        open={selectedModule !== null}
        onClose={() => setSelectedKey(null)}
        size="xl"
        title={selectedModule ? `${selectedModule.label} control accounts` : 'Control accounts'}
        description={selectedModule ? `${selectedAccounts.length} linked account${selectedAccounts.length === 1 ? '' : 's'} and their closing positions` : undefined}
        footer={<Button variant="secondary" onClick={() => setSelectedKey(null)}>Close</Button>}
      >
        {selectedModule && (
          <div className="space-y-5">
            <div className="grid grid-cols-3 overflow-hidden rounded-xl border border-slate-200 bg-slate-50/70">
              <Metric label="Total debit" value={money(selectedModule.debit)} />
              <Metric label="Total credit" value={money(selectedModule.credit)} bordered />
              <Metric label="Closing balance" value={money(selectedModule.balance)} bordered strong />
            </div>
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div className="border-b border-slate-100 px-4 py-3">
                <p className="text-sm font-semibold text-navy-900">Account breakdown</p>
                <p className="mt-0.5 text-xs text-slate-500">Debit and credit movement for the selected reporting period.</p>
              </div>
              <div className="divide-y divide-slate-100">
                {selectedAccounts.map((account) => <FullAccount key={account.id} account={account} />)}
              </div>
            </div>
          </div>
        )}
      </Modal>

      {data.modules.length > 0 && (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-xs leading-5 text-slate-500">
          {activeServices === data.modules.length ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
          ) : (
            <Activity className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
          )}
          A service marked “No activity” is mapped correctly but had no debit or credit movement in
          the selected reporting period.
        </div>
      )}
    </section>
  );
}

type Account = Statements['rows'][number];

function PreviewAccount({ account }: { account: Account }) {
  const negative = Number(account.balance) < 0;
  const noPosition = isZeroMoney(account.balance);
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-3.5">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="tnum text-xs font-semibold text-brand-700">{account.code}</span>
          <Badge tone={accountTone(account.type)}>{ACCOUNT_TYPE_LABELS[account.type]}</Badge>
        </div>
        <p className="mt-1.5 truncate text-sm font-medium text-navy-900">{account.name}</p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-[11px] text-slate-400">Balance</p>
        <p className={`tnum mt-0.5 text-sm font-semibold ${negative ? 'text-red-600' : noPosition ? 'text-slate-400' : 'text-navy-900'}`}>
          {money(account.balance)}
        </p>
      </div>
    </div>
  );
}

function FullAccount({ account }: { account: Account }) {
  const noPosition = isZeroMoney(account.balance);
  const negative = Number(account.balance) < 0;
  return (
    <div className="px-4 py-4 sm:px-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="tnum text-xs font-semibold text-brand-700">{account.code}</span>
            <Badge tone={accountTone(account.type)}>{ACCOUNT_TYPE_LABELS[account.type]}</Badge>
          </div>
          <p className="mt-1.5 text-sm font-medium text-navy-900">{account.name}</p>
          <p className="mt-0.5 text-xs text-slate-500">{account.group}</p>
        </div>
        <div className="grid w-full grid-cols-3 gap-3 rounded-lg bg-slate-50 px-3 py-2.5 sm:w-auto sm:min-w-[360px]">
          <AccountValue label="Debit" value={money(account.debit)} muted={noPosition} />
          <AccountValue label="Credit" value={money(account.credit)} muted={noPosition} />
          <AccountValue label="Balance" value={money(account.balance)} strong negative={negative} />
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, bordered, strong }: { label: string; value: string; bordered?: boolean; strong?: boolean }) {
  return (
    <div className={`min-w-0 px-3 py-3.5 sm:px-5 ${bordered ? 'border-l border-slate-200' : ''}`}>
      <p className="truncate text-[11px] font-medium text-slate-500">{label}</p>
      <p className={`tnum mt-1 truncate text-sm ${strong ? 'font-semibold text-navy-900' : 'font-medium text-slate-700'}`} title={value}>{value}</p>
    </div>
  );
}

function AccountValue({ label, value, muted, strong, negative, mobileOnly }: { label: string; value: string; muted?: boolean; strong?: boolean; negative?: boolean; mobileOnly?: boolean }) {
  return (
    <div className={mobileOnly ? 'sm:hidden' : undefined}>
      <p className="text-[11px] text-slate-400">{label}</p>
      <p className={`tnum mt-0.5 text-xs ${negative ? 'font-semibold text-red-600' : muted ? 'text-slate-400' : strong ? 'font-semibold text-navy-900' : 'text-slate-700'}`}>{value}</p>
    </div>
  );
}

function accountTone(type: Statements['rows'][number]['type']): 'blue' | 'purple' | 'green' | 'gold' | 'navy' {
  if (type === 'ASSET') return 'blue';
  if (type === 'LIABILITY') return 'purple';
  if (type === 'INCOME') return 'green';
  if (type === 'EXPENSE') return 'gold';
  return 'navy';
}
