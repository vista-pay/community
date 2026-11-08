import { notFound } from 'next/navigation';
import { communityGet } from '@/server/portal-data';
import type { LoanProduct } from '@/types';
import { LoanOfferDetailClient } from './loan-offer-detail-client';

export default async function LoanOfferDetailPage({ params }: { params: Promise<{ productId: string }> }) {
  const { productId } = await params;
  const products = await communityGet<LoanProduct[]>('/loan-products');
  const product = products.find((item) => item.id === productId);
  if (!product) notFound();
  return <LoanOfferDetailClient product={product} />;
}
