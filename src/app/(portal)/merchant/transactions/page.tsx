import type { Metadata } from 'next';
import { communityGet } from '@/server/portal-data';
import type { MerchantTransactionPage } from '@/types';
import { TransactionsClient } from './transactions-client';

export const metadata: Metadata = { title: 'Transaction history' };

export default async function MerchantTransactionsPage() {
  const data = await communityGet<MerchantTransactionPage>('/merchant/transactions?limit=50');
  return <TransactionsClient initial={data} />;
}
