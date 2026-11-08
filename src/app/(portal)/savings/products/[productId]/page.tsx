import { notFound } from 'next/navigation';
import { communityGet } from '@/server/portal-data';
import type { SavingsOverview, SavingsProduct } from '@/types';
import { SavingsProductDetailClient } from './savings-product-detail-client';

export default async function SavingsProductDetailPage({ params }: { params: Promise<{ productId: string }> }) {
  const { productId } = await params;
  const [products, overview] = await Promise.all([
    communityGet<SavingsProduct[]>('/portal/savings/products'),
    communityGet<SavingsOverview>('/portal/savings/accounts'),
  ]);
  const product = products.find((item) => item.id === productId);
  if (!product) notFound();

  return <SavingsProductDetailClient product={product} accounts={overview.accounts.filter((account) => account.product.id === productId)} />;
}
