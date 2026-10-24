import type { Metadata } from 'next';
import { communityGet } from '@/server/portal-data';
import type { MemberRow, SavingsOverview, SavingsProduct } from '@/types';
import { SavingsClient } from './savings-client';

export const metadata: Metadata = { title: 'Savings' };

export default async function SavingsPage() {
  const [overview, products, members] = await Promise.all([
    communityGet<SavingsOverview>('/savings/accounts'),
    communityGet<SavingsProduct[]>('/savings/products'),
    communityGet<MemberRow[]>('/members'),
  ]);

  return <SavingsClient initial={{ overview, products, members }} />;
}
