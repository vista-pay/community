import type { Metadata } from 'next';
import { communityGet } from '@/server/portal-data';
import type { BookAccount, PostingRule } from '@/types';
import { LedgerClient } from './ledger-client';

export const metadata: Metadata = { title: 'Ledger entries' };

export default async function LedgerPage() {
  // The endpoint returns the chart plus its posting rules, not a bare array.
  const chart = await communityGet<{ accounts: BookAccount[]; postingRules: PostingRule[] }>(
    '/accounting/accounts',
  );
  return <LedgerClient accounts={chart.accounts} />;
}
