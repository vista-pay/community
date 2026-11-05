import type { Metadata } from 'next';
import { communityGet } from '@/server/portal-data';
import type { MerchantWebhook } from '@/types';
import { WebhooksClient } from './webhooks-client';

export const metadata: Metadata = { title: 'Webhooks' };

export default async function MerchantWebhooksPage() {
  const endpoints = await communityGet<MerchantWebhook[]>('/merchant/webhooks');
  return <WebhooksClient initial={endpoints} />;
}
