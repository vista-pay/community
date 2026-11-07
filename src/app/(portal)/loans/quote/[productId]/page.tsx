import { notFound } from 'next/navigation';
import { communityGet } from '@/server/portal-data';
import type { LoanProduct, MemberRow } from '@/types';
import { QuotePageClient } from './quote-page-client';

export default async function LoanQuotePage({ params }: { params: Promise<{ productId: string }> }) {
  const { productId } = await params;
  const [products, members] = await Promise.all([
    communityGet<LoanProduct[]>('/loan-products'),
    communityGet<MemberRow[]>('/members', { includeOwner: true }),
  ]);
  const product = products.find((item) => item.id === productId);
  if (!product) notFound();
  return <QuotePageClient product={product} members={members.filter((member) => member.status === 'ACTIVE')} />;
}
