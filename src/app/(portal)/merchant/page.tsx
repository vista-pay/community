import type { Metadata } from 'next';
import { communityGet } from '@/server/portal-data';
import type { MerchantOverview } from '@/types';
import { MerchantClient } from './merchant-client';

export const metadata: Metadata = { title: 'Merchant account' };

export default async function MerchantPage() {
  const data = await communityGet<MerchantOverview>('/merchant/overview');
  return <MerchantClient initial={data} />;
}
