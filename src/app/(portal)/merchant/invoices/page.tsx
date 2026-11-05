import type { Metadata } from 'next';
import { communityGet } from '@/server/portal-data';
import type { MerchantInvoice } from '@/types';
import { InvoicesClient } from './invoices-client';

export const metadata: Metadata = { title: 'Invoices' };

export default async function MerchantInvoicesPage() {
  const invoices = await communityGet<MerchantInvoice[]>('/merchant/invoices');
  return <InvoicesClient initial={invoices} />;
}
