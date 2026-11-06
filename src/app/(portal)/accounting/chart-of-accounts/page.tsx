import type { Metadata } from 'next';
import { communityGet } from '@/server/portal-data';
import type { BookAccount, PostingRule } from '@/types';
import { ChartOfAccountsClient } from './chart-of-accounts-client';

export const metadata: Metadata = { title: 'Chart of accounts' };

export default async function ChartOfAccountsPage() {
  // The endpoint returns the chart plus its posting rules, not a bare array.
  const chart = await communityGet<{ accounts: BookAccount[]; postingRules: PostingRule[] }>(
    '/accounting/accounts',
  );
  return <ChartOfAccountsClient initial={chart.accounts} />;
}
