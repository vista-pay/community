'use client';

import Link from 'next/link';
import type { Route } from 'next';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bell,
  CalendarDays,
  HandCoins,
  HeartHandshake,
  PiggyBank,
  Receipt,
  Sparkles,
  TrendingUp,
  UserPlus,
  Users,
  Wallet,
} from 'lucide-react';
import { Card, CardHeader, EmptyState, LinkButton, PageHeader, Stat } from '@/components/ui';
import { useQuery } from '@/hooks/use-query';
import { useCommunityId } from '@/components/providers/session-provider';
import { portalApi } from '@/services/portal';
import { date, humanise, money, relative } from '@/lib/format';
import { isZeroMoney } from '@/lib/money';
import { Bars, C } from '@/components/charts/Charts';
import type { DashboardData } from '@/types';

export function DashboardClient({ initial }: { initial: DashboardData }) {
  const communityId = useCommunityId();
  const { data } = useQuery<DashboardData>(() => portalApi.dashboard(communityId), [communityId], {
    initial,
  });

  const d = data ?? initial;
  // The operating balance is naira: accounts exist per active currency and
  // their order is arbitrary, so index 0 was sometimes AUD.
  const wallet =
    d.wallet?.accounts.find((a) => a.currencyCode === 'NGN') ?? d.wallet?.accounts[0];
  const metrics = d.metrics ?? {
    activityLast7Days: d.recentActivity.length,
    newMembersLast30Days: 0,
    activeSavingsAccounts: 0,
    activeOpportunities: 0,
    activeWelfareRequests: 0,
    unreadNotifications: 0,
  };
  const activitySeries = d.activitySeries ?? [];
  const attentionCount =
    d.navigationCounts?.dashboard ??
    (d.actions.pendingApplications +
      d.actions.loansAwaitingReview +
      d.actions.expensesAwaitingApproval +
      d.actions.unpaidFines +
      d.ajo.obligationsOutstanding +
      d.lending.defaulted);

  return (
    <>
      <PageHeader
        title={d.community.name}
        subtitle={[d.community.category, d.community.city].filter(Boolean).join(' · ') || undefined}
        actions={
          <>
            <LinkButton variant="secondary" href="/wallet">
              Fund wallet
            </LinkButton>
            <LinkButton variant="secondary" href="/reports">
              Reports
            </LinkButton>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Operating balance"
          value={wallet ? money(wallet.available, wallet.currencyCode) : '—'}
          hint={
            wallet && !isZeroMoney(wallet.held)
              ? `${money(wallet.held, wallet.currencyCode)} held`
              : 'In the community wallet'
          }
          icon={<Wallet className="h-4 w-4" />}
        />
        <Stat
          label="Active members"
          value={d.members.active}
          hint={
            d.members.pendingApplications
              ? `${d.members.pendingApplications} awaiting review`
              : 'No applications waiting'
          }
          icon={<Users className="h-4 w-4" />}
          tone={d.members.pendingApplications ? 'warning' : 'default'}
        />
        <Stat
          label="Contribution arrears"
          value={money(d.ajo.arrears)}
          hint={`${d.ajo.obligationsOutstanding} unpaid across ${d.ajo.groups} group${d.ajo.groups === 1 ? '' : 's'}`}
          icon={<TrendingUp className="h-4 w-4" />}
          tone={isZeroMoney(d.ajo.arrears) ? 'default' : 'warning'}
        />
        <Stat
          label="Loans outstanding"
          value={money(d.lending.outstanding)}
          hint={
            d.lending.defaulted
              ? `${d.lending.defaulted} in default`
              : `${d.lending.applications} application${d.lending.applications === 1 ? '' : 's'} all time`
          }
          icon={<HandCoins className="h-4 w-4" />}
          tone={d.lending.defaulted ? 'danger' : 'default'}
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(320px,0.85fr)]">
        <Card>
          <CardHeader
            title="Application activity"
            subtitle={`${metrics.activityLast7Days} recorded action${metrics.activityLast7Days === 1 ? '' : 's'} in the last 7 days`}
          />
          <div className="px-3 pb-4 pt-2 sm:px-5">
            <Bars
              data={activitySeries}
              x="label"
              height={270}
              currency={false}
              stacked
              series={[
                { key: 'members', name: 'Members', color: C.green },
                { key: 'finance', name: 'Finance', color: C.navy },
                { key: 'governance', name: 'Governance', color: C.gold },
                { key: 'other', name: 'Other', color: C.slate },
              ]}
            />
          </div>
        </Card>

        <Card>
          <CardHeader title="Community pulse" subtitle="Current activity across the workspace" />
          <div className="grid grid-cols-2 gap-px bg-slate-100">
            <PulseMetric
              icon={UserPlus}
              label="New members"
              value={metrics.newMembersLast30Days}
              hint="Last 30 days"
              href="/members/all"
            />
            <PulseMetric
              icon={PiggyBank}
              label="Savings accounts"
              value={metrics.activeSavingsAccounts}
              hint="Active"
              href="/savings"
            />
            <PulseMetric
              icon={Sparkles}
              label="Opportunities"
              value={metrics.activeOpportunities}
              hint="Published"
              href="/opportunities"
            />
            <PulseMetric
              icon={HeartHandshake}
              label="Welfare requests"
              value={metrics.activeWelfareRequests}
              hint="Still open"
              href="/welfare"
            />
            <PulseMetric
              icon={Activity}
              label="Activity"
              value={metrics.activityLast7Days}
              hint="Last 7 days"
              href="/reports"
            />
            <PulseMetric
              icon={Bell}
              label="Notifications"
              value={metrics.unreadNotifications}
              hint="Unread"
              href="/notifications"
            />
          </div>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Needs your attention"
            subtitle={`${attentionCount} item${attentionCount === 1 ? '' : 's'} need follow-up from an officer`}
          />
          <ActionList data={d} />
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Next meeting" />
            {d.upcomingMeeting ? (
              <div className="px-5 py-4">
                <p className="text-sm font-medium text-navy-900">{d.upcomingMeeting.title}</p>
                <p className="mt-1 text-[13px] text-slate-500">
                  {date(d.upcomingMeeting.scheduledFor, 'datetime')}
                </p>
                <p className="mt-0.5 text-[13px] text-slate-500">{d.upcomingMeeting.venue}</p>
                <Link
                  href="/governance"
                  className="mt-3 inline-flex items-center gap-1 text-[13px] font-medium text-brand-700 hover:underline"
                >
                  Open governance <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            ) : (
              <EmptyState
                compact
                icon={<CalendarDays className="h-5 w-5" />}
                title="Nothing scheduled"
                body="Schedule your next general meeting or AGM."
                action={
                  <LinkButton size="sm" variant="secondary" href="/governance">
                    Schedule
                  </LinkButton>
                }
              />
            )}
          </Card>

          <Card>
            <CardHeader title="Recent activity" />
            {d.recentActivity.length === 0 ? (
              <p className="px-5 py-6 text-[13px] text-slate-500">Nothing recorded yet.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {d.recentActivity.slice(0, 7).map((a) => (
                  <li key={a.id} className="px-5 py-2.5">
                    <p className="text-[13px] text-navy-800">{humanise(a.action)}</p>
                    <p className="text-[11px] text-slate-400">
                      {humanise(a.entityType)} · {relative(a.at)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}

function ActionList({ data }: { data: DashboardData }) {
  const actions = [
    {
      key: 'applications',
      count: data.actions.pendingApplications,
      icon: UserPlus,
      label: 'Membership applications to review',
      href: '/members/requests' as Route,
    },
    {
      key: 'contributions',
      count:
        data.actions.contributionObligationsOutstanding ?? data.ajo.obligationsOutstanding,
      icon: TrendingUp,
      label: `Contribution obligation${(data.actions.contributionObligationsOutstanding ?? data.ajo.obligationsOutstanding) === 1 ? '' : 's'} overdue or unpaid`,
      href: '/contributions' as Route,
    },
    {
      key: 'savings',
      count: data.actions.savingsWithdrawalsAwaitingReview ?? 0,
      icon: PiggyBank,
      label: 'Savings withdrawal requests awaiting review',
      href: '/savings' as Route,
    },
    {
      key: 'loans',
      count: data.actions.loansAwaitingReview,
      icon: HandCoins,
      label: 'Loan applications awaiting a decision',
      href: '/loans' as Route,
    },
    {
      key: 'defaulted-loans',
      count: data.actions.defaultedLoans ?? data.lending.defaulted,
      icon: AlertTriangle,
      label: 'Defaulted loans requiring follow-up',
      href: '/loans' as Route,
    },
    {
      key: 'welfare',
      count: data.actions.welfareRequestsAwaitingAction ?? 0,
      icon: HeartHandshake,
      label: 'Welfare requests awaiting review or disbursement',
      href: '/welfare' as Route,
    },
    {
      key: 'expenses',
      count: data.actions.expensesAwaitingApproval,
      icon: Receipt,
      label: 'Expenses awaiting approval',
      href: '/accounting' as Route,
    },
    {
      key: 'fines',
      count: data.actions.unpaidFines,
      icon: AlertTriangle,
      label: `Unpaid fines (${money(data.actions.unpaidFinesValue)})`,
      href: '/governance' as Route,
    },
  ].filter((a) => a.count > 0);

  if (actions.length === 0) {
    return (
      <EmptyState
        compact
        title="Nothing waiting"
        body="No join requests, overdue contributions, withdrawal reviews, welfare decisions, loan follow-ups, expense approvals or unpaid fines."
      />
    );
  }

  return (
    <ul className="divide-y divide-slate-100">
      {actions.map((a) => (
        <li key={a.key}>
          <Link
            href={a.href}
            className="flex items-center gap-3 px-5 py-3.5 transition hover:bg-slate-50"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
              <a.icon className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1 text-sm text-navy-800">{a.label}</span>
            <span className="tnum rounded-full bg-navy-900 px-2 py-0.5 text-xs font-semibold text-white">
              {a.count}
            </span>
            <ArrowRight className="h-4 w-4 shrink-0 text-slate-400" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

function PulseMetric({
  icon: Icon,
  label,
  value,
  hint,
  href,
}: {
  icon: typeof Users;
  label: string;
  value: number;
  hint: string;
  href: Route;
}) {
  return (
    <Link href={href} className="bg-white px-4 py-4 transition hover:bg-slate-50">
      <span className="flex items-center gap-2 text-xs font-medium text-slate-500">
        <Icon className="h-4 w-4 text-brand-600" />
        {label}
      </span>
      <span className="tnum mt-2 block text-2xl font-bold text-navy-900">{value}</span>
      <span className="mt-0.5 block text-[11px] text-slate-400">{hint}</span>
    </Link>
  );
}
