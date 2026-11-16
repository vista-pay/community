import type { Metadata } from 'next';
import { communityGetSafe } from '@/server/portal-data';
import type { PayoutSettingsData } from '@/types';
import { SettlementClient } from './settlement-client';

export const metadata: Metadata = { title: 'Settlement' };

/**
 * Fetched here so the screen opens with its numbers already on it; the client
 * refetches on every change anyway.
 *
 * Safe rather than throwing, because this is a hand-off and not a
 * precondition. The throwing variant takes the entire route down when the API
 * has any trouble at all — the officer gets the browser's "This page couldn't
 * load" and no way back in, on one of the screens they use to fix money
 * problems. The client renders an error it can retry from instead.
 */
export default async function MerchantSettlementPage() {
  const data = await communityGetSafe<PayoutSettingsData>('/merchant/payout-settings');
  return <SettlementClient initial={data ?? undefined} />;
}
