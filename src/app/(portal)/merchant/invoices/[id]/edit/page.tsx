import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { communityGetSafe } from '@/server/portal-data';
import type { MerchantInvoice, MerchantInvoiceDetail } from '@/types';
import { InvoiceForm } from '../../invoice-form';

export const metadata: Metadata = { title: 'Edit invoice' };

export default async function EditInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [invoice, customers] = await Promise.all([
    communityGetSafe<MerchantInvoiceDetail>(`/merchant/invoices/${id}`),
    communityGetSafe<MerchantInvoice[]>('/merchant/invoices'),
  ]);
  if (!invoice || invoice.status !== 'DRAFT') notFound();
  return <InvoiceForm invoice={invoice} customers={customers ?? []} />;
}
