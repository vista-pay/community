'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowUpRight,
  CalendarCheck,
  Download,
  HandCoins,
  PiggyBank,
  RefreshCw,
  Scale,
} from 'lucide-react';
import {
  Avatar,
  Badge,
  Card,
  CardHeader,
  EmptyState,
  KV,
  PageHeader,
  StatusBadge,
  Stat,
  Tabs,
} from '@/components/ui';
import { date, humanise, money } from '@/lib/format';
import { sumMoney } from '@/lib/money';
import { downloadCsv } from '@/lib/csv';
import type { MemberDetail } from '@/types';

type Tab = 'overview' | 'savings' | 'ajo' | 'loans' | 'conduct';

function savingsStatusTone(status: string): 'green' | 'amber' | 'slate' {
  if (status === 'ACTIVE') return 'green';
  if (status === 'DORMANT') return 'amber';
  return 'slate';
}

function isSavingsDebit(type: string) {
  return type === 'WITHDRAWAL';
}

export function MemberProfile({ member }: { member: MemberDetail }) {
  const [tab, setTab] = useState<Tab>('overview');

  const savingsTotal = sumMoney(member.savingsAccounts.map((a) => a.balance));
  const loanOutstanding = sumMoney(
    member.ajo.flatMap((g) =>
      g.loans
        .filter((l) => l.status === 'DISBURSED' || l.status === 'REPAYING')
        .map((l) => l.outstanding),
    ),
  );
  const contributed = sumMoney(
    member.ajo.flatMap((g) => g.obligations.filter((o) => o.status === 'PAID').map((o) => o.amountPaid)),
  );
  const arrears = member.ajo.flatMap((g) =>
    g.obligations.filter((o) => o.status === 'OVERDUE' || o.status === 'DUE'),
  );

  return (
    <>
      <PageHeader
        breadcrumb={
          <Link href="/members/all" className="inline-flex items-center gap-1 hover:text-navy-900">
            <ArrowLeft className="h-3.5 w-3.5" /> Members
          </Link>
        }
        title={
          <span className="flex items-center gap-3">
            <Avatar name={member.name} size="lg" />
            <span>
              {member.name}
              <span className="ml-3 align-middle">
                <StatusBadge status={member.status.toLowerCase()} />
              </span>
            </span>
          </span>
        }
        subtitle={`${member.title ?? humanise(member.role.replace('COMMUNITY_', ''))} · joined ${date(member.joinedAt, 'long')}`}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Savings" value={money(savingsTotal)} icon={<PiggyBank className="h-4 w-4" />} />
        <Stat
          label="Contributed"
          value={money(contributed)}
          hint={`${member.ajo.length} Ajo group${member.ajo.length === 1 ? '' : 's'}`}
          icon={<RefreshCw className="h-4 w-4" />}
        />
        <Stat
          label="Loan balance"
          value={money(loanOutstanding)}
          icon={<HandCoins className="h-4 w-4" />}
          tone={loanOutstanding === '0.0000' ? 'default' : 'warning'}
        />
        <Stat
          label="Unpaid fines"
          value={member.fines.filter((f) => f.status === 'UNPAID').length}
          hint={money(sumMoney(member.fines.filter((f) => f.status === 'UNPAID').map((f) => f.amount)))}
          icon={<Scale className="h-4 w-4" />}
          tone={member.fines.some((f) => f.status === 'UNPAID') ? 'warning' : 'default'}
        />
      </div>

      <Tabs
        className="mt-6"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'overview', label: 'Overview' },
          { value: 'savings', label: 'Savings', count: member.savingsAccounts.length },
          { value: 'ajo', label: 'Ajo', count: member.ajo.length },
          {
            value: 'loans',
            label: 'Loans',
            count: member.ajo.reduce((n, g) => n + g.loans.length, 0),
          },
          { value: 'conduct', label: 'Conduct' },
        ]}
      />

      <div className="mt-4 space-y-6">
        {tab === 'overview' && (
          <>
            <Card>
              <CardHeader title="Contact & identity" />
              <dl className="grid gap-4 px-5 py-4 sm:grid-cols-3">
                <KV label="Phone">{member.phone}</KV>
                <KV label="Email">{member.email}</KV>
                <KV label="KYC">
                  <StatusBadge status={member.kyc.toLowerCase()} />
                </KV>
                <KV label="Address">{member.address ?? '—'}</KV>
                <KV label="City">{member.city ?? '—'}</KV>
                <KV label="State">{member.state ?? '—'}</KV>
              </dl>
            </Card>

            {arrears.length > 0 && (
              <Card>
                <CardHeader
                  title="Outstanding contributions"
                  subtitle="Rounds this member still owes"
                />
                <ul className="divide-y divide-slate-100">
                  {arrears.map((o) => (
                    <li key={o.id} className="flex items-center gap-3 px-5 py-3">
                      <span className="min-w-0 flex-1 text-sm text-navy-800">
                        Round {o.periodNumber} · due {date(o.dueDate)}
                      </span>
                      <StatusBadge status={o.status.toLowerCase()} />
                      <span className="tnum text-sm font-medium text-navy-900">
                        {money(o.amountDue)}
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </>
        )}

        {tab === 'savings' && (
          <Card>
            <CardHeader
              title="Savings accounts"
              subtitle={
                member.savingsAccounts.length === 0
                  ? 'This member has no savings account yet'
                  : `${member.savingsAccounts.length} account${member.savingsAccounts.length === 1 ? '' : 's'} held with the community`
              }
              action={
                member.savingsAccounts.length > 0 ? (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        downloadCsv(
                          `${member.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-savings.csv`,
                          member.savingsAccounts.flatMap((account) =>
                            account.recent.map((entry) => ({
                              Account: account.accountNumber,
                              Product: account.product,
                              Date: date(entry.at, 'datetime'),
                              Type: humanise(entry.type),
                              Amount: money(entry.amount),
                              'Balance after': money(entry.balanceAfter),
                            })),
                          ),
                        )
                      }
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-navy-800 transition hover:bg-slate-50"
                    >
                      <Download className="h-3.5 w-3.5" /> Export CSV
                    </button>
                    <div className="rounded-lg bg-brand-50 px-3 py-1.5 text-right">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-brand-700">
                        Total saved
                      </p>
                      <p className="tnum text-sm font-semibold text-navy-900">{money(savingsTotal)}</p>
                    </div>
                  </div>
                ) : null
              }
            />
            {member.savingsAccounts.length === 0 ? (
              <EmptyState
                compact
                icon={<PiggyBank className="h-5 w-5" />}
                title="No savings account"
                body="Open one from the Savings screen."
              />
            ) : (
              <div className="space-y-4 p-4 sm:p-5">
                {member.savingsAccounts.map((a) => (
                  <section
                    key={a.id}
                    className="overflow-hidden rounded-xl border border-slate-200 bg-white"
                    aria-label={`${a.product} savings account`}
                  >
                    <div className="bg-gradient-to-br from-navy-900 to-navy-800 px-4 py-4 sm:px-5">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-gold-400 ring-1 ring-inset ring-white/10">
                            <PiggyBank className="h-5 w-5" />
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-white">{a.product}</p>
                            <p className="mt-0.5 text-xs text-slate-300">{a.accountNumber}</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3 sm:gap-5">
                          <Badge tone={savingsStatusTone(a.status)} dot>
                            {humanise(a.status)}
                          </Badge>
                          <div className="text-right">
                            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-300">
                              Available balance
                            </p>
                            <p className="tnum mt-0.5 text-xl font-semibold tracking-tight text-white">
                              {money(a.balance)}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="px-4 py-3 sm:px-5">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Recent activity
                        </p>
                        {a.recent.length > 0 && (
                          <p className="text-xs text-slate-400">Latest {Math.min(a.recent.length, 5)} entries</p>
                        )}
                      </div>
                      {a.recent.length === 0 ? (
                        <p className="rounded-lg bg-slate-50 px-3 py-2.5 text-[13px] text-slate-500">
                          No entries have been recorded for this account yet.
                        </p>
                      ) : (
                        <ul className="divide-y divide-slate-100">
                          {a.recent.slice(0, 5).map((t) => {
                            const debit = isSavingsDebit(t.type);
                            return (
                              <li key={t.id} className="flex items-center gap-3 py-3 first:pt-1">
                                <span
                                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                                    debit
                                      ? 'bg-red-50 text-red-600'
                                      : 'bg-emerald-50 text-emerald-600'
                                  }`}
                                >
                                  {debit ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownLeft className="h-4 w-4" />}
                                </span>
                                <span className="min-w-0 flex-1">
                                  <span className="block text-[13px] font-medium text-navy-900">
                                    {humanise(t.type)}
                                  </span>
                                  <span className="block text-xs text-slate-500">{date(t.at, 'datetime')}</span>
                                </span>
                                <span className="text-right">
                                  <span
                                    className={`tnum block text-[13px] font-semibold ${
                                      debit ? 'text-red-700' : 'text-emerald-700'
                                    }`}
                                  >
                                    {debit ? '−' : '+'}{money(t.amount)}
                                  </span>
                                  <span className="tnum block text-xs text-slate-500">
                                    Balance {money(t.balanceAfter)}
                                  </span>
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </Card>
        )}

        {tab === 'ajo' &&
          (member.ajo.length === 0 ? (
            <Card>
              <EmptyState
                compact
                icon={<RefreshCw className="h-5 w-5" />}
                title="Not in any Ajo group"
                body="This member has not joined a rotating savings group."
              />
            </Card>
          ) : (
            member.ajo.map((g) => (
              <Card key={g.membershipId}>
                <CardHeader
                  title={g.group.name}
                  subtitle={`${money(g.group.contributionAmount, g.group.currencyCode)} per round`}
                  action={
                    g.positions[0] ? (
                      <Badge tone="navy">Position #{g.positions[0].position}</Badge>
                    ) : null
                  }
                />
                <ul className="divide-y divide-slate-100">
                  {g.obligations.slice(0, 12).map((o) => (
                    <li key={o.id} className="flex items-center gap-3 px-5 py-2.5">
                      <span className="w-20 text-[13px] text-slate-500">Round {o.periodNumber}</span>
                      <span className="flex-1 text-[13px] text-slate-500">{date(o.dueDate)}</span>
                      <StatusBadge status={o.status.toLowerCase()} />
                      <span className="tnum w-28 text-right text-[13px] text-navy-900">
                        {money(o.amountPaid)} / {money(o.amountDue)}
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
            ))
          ))}

        {tab === 'loans' && (
          <Card>
            <CardHeader title="Loans" />
            {member.ajo.every((g) => g.loans.length === 0) ? (
              <EmptyState
                compact
                icon={<HandCoins className="h-5 w-5" />}
                title="No loans"
                body="This member has never borrowed from the community."
              />
            ) : (
              <ul className="divide-y divide-slate-100">
                {member.ajo.flatMap((g) =>
                  g.loans.map((l) => (
                    <li key={l.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-navy-900">{l.reference}</span>
                        <span className="block text-xs text-slate-500">
                          {g.group.name}
                          {l.dueDate ? ` · due ${date(l.dueDate)}` : ''}
                        </span>
                      </span>
                      <StatusBadge status={l.status.toLowerCase()} />
                      <span className="tnum text-sm text-navy-900">
                        {money(l.outstanding)} of {money(l.principal)}
                      </span>
                    </li>
                  )),
                )}
              </ul>
            )}
          </Card>
        )}

        {tab === 'conduct' && (
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader title="Fines" />
              {member.fines.length === 0 ? (
                <EmptyState compact title="No fines" body="Nothing has been issued against this member." />
              ) : (
                <ul className="divide-y divide-slate-100">
                  {member.fines.map((f) => (
                    <li key={f.id} className="flex items-center gap-3 px-5 py-3">
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13px] text-navy-800">{f.reason}</span>
                        <span className="block text-xs text-slate-400">{date(f.issuedAt)}</span>
                      </span>
                      <StatusBadge status={f.status.toLowerCase()} />
                      <span className="tnum text-sm">{money(f.amount)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card>
              <CardHeader title="Meeting attendance" />
              {member.attendance.length === 0 ? (
                <EmptyState
                  compact
                  icon={<CalendarCheck className="h-5 w-5" />}
                  title="No attendance recorded"
                  body="Attendance appears once a meeting is marked held."
                />
              ) : (
                <ul className="divide-y divide-slate-100">
                  {member.attendance.map((a) => (
                    <li key={a.meetingId} className="flex items-center gap-3 px-5 py-2.5">
                      <span className="min-w-0 flex-1 text-[13px] text-navy-800">{a.title}</span>
                      <span className="text-xs text-slate-400">{date(a.date)}</span>
                      <Badge
                        tone={
                          a.state === 'PRESENT' ? 'green' : a.state === 'APOLOGY' ? 'amber' : 'slate'
                        }
                      >
                        {humanise(a.state)}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        )}
      </div>
    </>
  );
}
