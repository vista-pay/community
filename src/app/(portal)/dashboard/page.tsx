import type { Metadata } from 'next';
import { communityGet } from '@/server/portal-data';
import type { DashboardData } from '@/types';
import { DashboardClient } from './dashboard-client';

export const metadata: Metadata = { title: 'Dashboard' };

/**
 * Server component: fetches with the session cookie and hands the result to
 * the client view as its initial data, so the first paint is real figures
 * rather than a skeleton that resolves a moment later.
 */
export default async function DashboardPage() {
  const data = await communityGet<DashboardData>('/dashboard');
  return <DashboardClient initial={data} />;
}
