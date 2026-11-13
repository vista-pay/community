import type { Metadata } from 'next';
import { communityGet } from '@/server/portal-data';
import type { ContributionTransactionPage } from '@/types';
import { ContributionTransactionsClient } from './transactions-client';

export const metadata: Metadata = { title: 'Contribution transactions' };

export default async function ContributionTransactionsPage() {
  const data = await communityGet<ContributionTransactionPage>(
    '/contributions/transactions?limit=50',
  );
  return <ContributionTransactionsClient initial={data} />;
}
