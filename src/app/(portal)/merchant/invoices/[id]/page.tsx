import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { communityGetSafe } from '@/server/portal-data';
import type { MerchantInvoiceDetail } from '@/types';
import { InvoiceDetailClient } from './invoice-detail-client';

export const metadata: Metadata = { title: 'Invoice' };

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const invoice = await communityGetSafe<MerchantInvoiceDetail>(`/merchant/invoices/${id}`);
  if (!invoice) notFound();
  return <InvoiceDetailClient initial={invoice} />;
}
