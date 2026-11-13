import type { Metadata } from 'next';
import { communityGet } from '@/server/portal-data';
import type { PayoutSettingsData } from '@/types';
import { PayoutsClient } from './payouts-client';

export const metadata: Metadata = { title: 'Payouts & payees' };

export default async function MerchantPayoutsPage() {
  const data = await communityGet<PayoutSettingsData>('/merchant/payout-settings');
  return <PayoutsClient initial={data} />;
}
