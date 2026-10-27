import type { Metadata } from 'next';
import { communityGet } from '@/server/portal-data';
import type { WalletData } from '@/types';
import { WalletClient } from './wallet-client';

export const metadata: Metadata = { title: 'Wallet' };

export default async function WalletPage() {
  const data = await communityGet<WalletData>('/wallet');
  return <WalletClient initial={data} />;
}
