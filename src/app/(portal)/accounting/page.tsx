import type { Metadata } from 'next';
import { communityGet } from '@/server/portal-data';
import type { Statements } from '@/types';
import { AccountingHubClient } from './accounting-hub-client';

export const metadata: Metadata = { title: 'Accounting' };

export default async function AccountingPage() {
  const statements = await communityGet<Statements>('/accounting/statements');
  return <AccountingHubClient initial={statements} />;
}
