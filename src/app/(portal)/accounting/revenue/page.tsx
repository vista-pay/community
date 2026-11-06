import type { Metadata } from 'next';
import { communityGet } from '@/server/portal-data';
import type { Statements } from '@/types';
import { RevenueClient } from './revenue-client';

export const metadata: Metadata = { title: 'Revenue' };

export default async function RevenuePage() {
  const statements = await communityGet<Statements>('/accounting/statements');
  return <RevenueClient initial={statements} />;
}
