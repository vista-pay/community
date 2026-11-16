import type { Metadata } from 'next';
import { apiServerSafe } from '@/lib/server-api';
import { communityGet } from '@/server/portal-data';
import type { DashboardData, Subscription, SubscriptionPlan } from '@/types';
import { BillingClient } from './billing-client';

export const metadata: Metadata = { title: 'Billing' };

export default async function BillingPage() {
  const [dashboard, plans] = await Promise.all([
    communityGet<DashboardData>('/dashboard'),
    apiServerSafe<SubscriptionPlan[]>('/community-subscriptions/plans'),
  ]);

  const subscription = dashboard.subscription
    ? await apiServerSafe<Subscription>(`/community-subscriptions/${dashboard.subscription.id}`)
    : null;

  /**
   * What the community is actually using, against the limits its tier grants.
   * Taken from the dashboard it already loads rather than a second round of
   * counting queries — a plan limit nobody can see their position against is
   * a number, not an answer.
   */
  const usage = {
    members: dashboard.members.active,
    ajoGroups: dashboard.ajo.groups,
    walletBalance:
      dashboard.wallet?.accounts.find((account) => account.currencyCode === 'NGN')?.available ??
      null,
  };

  return <BillingClient plans={plans ?? []} subscription={subscription} usage={usage} />;
}
