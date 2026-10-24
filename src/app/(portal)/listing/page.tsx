import type { Metadata } from 'next';
import { communityGet } from '@/server/portal-data';
import type { Listing } from '@/types';
import { ListingClient } from './listing-client';

export const metadata: Metadata = { title: 'Public listing' };

export default async function ListingPage() {
  const listing = await communityGet<Listing>('/listing');
  return <ListingClient initial={listing} />;
}
