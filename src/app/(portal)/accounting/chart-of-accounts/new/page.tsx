import type { Metadata } from 'next';
import { communityGet } from '@/server/portal-data';
import type { BookAccount, PostingRule } from '@/types';
import { AccountForm } from '../account-form';

export const metadata: Metadata = { title: 'Add an account' };

export default async function NewAccountPage() {
  // The whole chart: needed to suggest a free code, catch a clash before the
  // request, and offer the sections already in use.
  const chart = await communityGet<{ accounts: BookAccount[]; postingRules: PostingRule[] }>(
    '/accounting/accounts',
  );
  return <AccountForm account={null} chart={chart.accounts} />;
}
