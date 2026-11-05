import type { Metadata } from 'next';
import { communityGet } from '@/server/portal-data';
import type { MerchantApiKey } from '@/types';
import { ApiKeysClient } from './api-keys-client';

export const metadata: Metadata = { title: 'API keys' };

export default async function MerchantApiKeysPage() {
  const keys = await communityGet<MerchantApiKey[]>('/merchant/api-keys');
  return <ApiKeysClient initial={keys} />;
}
