import type { Metadata } from 'next';
import { communityGet } from '@/server/portal-data';
import type { Statements } from '@/types';
import { TrialBalanceClient } from './trial-balance-client';

export const metadata: Metadata = { title: 'Trial balance' };

export default async function TrialBalancePage() {
  const statements = await communityGet<Statements>('/accounting/statements');
  return <TrialBalanceClient initial={statements} />;
}
