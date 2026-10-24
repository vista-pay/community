'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CalendarCheck, HandCoins, PiggyBank, RefreshCw, Scale } from 'lucide-react';
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
import type { MemberDetail } from '@/types';

type Tab = 'overview' | 'savings' | 'ajo' | 'loans' | 'conduct';

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
          <Link href="/members" className="inline-flex items-center gap-1 hover:text-navy-900">
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
            <CardHeader title="Savings accounts" />
            {member.savingsAccounts.length === 0 ? (
              <EmptyState
                compact
                icon={<PiggyBank className="h-5 w-5" />}
                title="No savings account"
                body="Open one from the Savings screen."
              />
            ) : (
              member.savingsAccounts.map((a) => (
                <div key={a.id} className="border-b border-slate-100 px-5 py-4 last:border-0">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-navy-900">{a.product}</p>
                      <p className="text-xs text-slate-500">{a.accountNumber}</p>
                    </div>
                    <span className="tnum text-base font-semibold text-navy-900">
                      {money(a.balance)}
                    </span>
                  </div>
                  {a.recent.length > 0 && (
                    <ul className="mt-3 space-y-1">
                      {a.recent.slice(0, 5).map((t) => (
                        <li
                          key={t.id}
                          className="flex items-center justify-between text-[13px] text-slate-600"
                        >
                          <span>
                            {humanise(t.type)} · {date(t.at)}
                          </span>
                          <span className="tnum">{money(t.amount)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))
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
