import type { Metadata } from 'next';
import { communityGetSafe } from '@/server/portal-data';
import type { AccountOfficerCard } from '@/types';
import { AccountOfficerClient } from './account-officer-client';

export const metadata: Metadata = { title: 'Account officer' };

export default async function AccountOfficerPage() {
  // Safe read: a community whose plan lacks dedicated support gets
  // `enabled: false`, and the client renders the upgrade explanation rather
  // than this page erroring. The thread itself is fetched client-side so
  // opening it marks replies read for the officer actually looking at it.
  const card = await communityGetSafe<AccountOfficerCard>('/account-officer');
  return <AccountOfficerClient initial={card} />;
}
