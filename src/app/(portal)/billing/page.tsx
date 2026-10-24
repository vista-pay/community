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

  return <BillingClient plans={plans ?? []} subscription={subscription} />;
}
