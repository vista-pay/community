import type { Metadata } from 'next';
import { communityGet } from '@/server/portal-data';
import type { DashboardData, SavingsOverview, Statements } from '@/types';
import { ReportsClient } from './reports-client';

export const metadata: Metadata = { title: 'Reports' };

export default async function ReportsPage() {
  const [statements, dashboard, savings] = await Promise.all([
    communityGet<Statements>('/accounting/statements'),
    communityGet<DashboardData>('/dashboard'),
    communityGet<SavingsOverview>('/savings/accounts'),
  ]);

  return <ReportsClient statements={statements} dashboard={dashboard} savings={savings} />;
}
