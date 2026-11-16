import type { Metadata } from 'next';
import { PayoutsClient } from './payouts-client';

export const metadata: Metadata = { title: 'Payouts & payees' };

/**
 * No prefetch: the settlement numbers this page used to open with now belong
 * to the Settlement screen, and what is left — the wallet balance and the
 * payee list — is fetched by the client, which has to refetch it after every
 * payment anyway.
 */
export default function MerchantPayoutsPage() {
  return <PayoutsClient />;
}
