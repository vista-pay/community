import { notFound } from 'next/navigation';
import { communityGet } from '@/server/portal-data';
import type { LoanProduct } from '@/types';
import { QuotePageClient } from './quote-page-client';

export default async function LoanQuotePage({ params }: { params: Promise<{ productId: string }> }) {
  const { productId } = await params;
  const products = await communityGet<LoanProduct[]>('/loan-products');
  const product = products.find((item) => item.id === productId);
  if (!product) notFound();
  return <QuotePageClient product={product} />;
}
