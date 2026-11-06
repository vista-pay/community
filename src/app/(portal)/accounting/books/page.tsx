import type { Metadata } from 'next';
import { communityGet } from '@/server/portal-data';
import type { Statements } from '@/types';
import { BooksClient } from './books-client';

export const metadata: Metadata = { title: 'Books' };

export default async function BooksPage() {
  const statements = await communityGet<Statements>('/accounting/statements');
  return <BooksClient initial={statements} />;
}
