import type { Metadata } from 'next';
import { communityGet } from '@/server/portal-data';
import type { MerchantInvoice } from '@/types';
import { InvoiceForm } from '../invoice-form';

export const metadata: Metadata = { title: 'New invoice' };

export default async function NewInvoicePage() {
  const customers = await communityGet<MerchantInvoice[]>('/merchant/invoices');
  return <InvoiceForm customers={customers} />;
}
