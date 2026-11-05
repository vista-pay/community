import type { Metadata } from 'next';
import { communityGet } from '@/server/portal-data';
import type { MerchantPaymentLink } from '@/types';
import { PaymentLinksClient } from './payment-links-client';

export const metadata: Metadata = { title: 'Payment links' };

export default async function MerchantPaymentLinksPage() {
  const links = await communityGet<MerchantPaymentLink[]>('/merchant/payment-links');
  return <PaymentLinksClient initial={links} />;
}
