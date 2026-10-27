import type { Metadata } from 'next';
import { communityGet } from '@/server/portal-data';
import type { Opportunity } from '@/types';
import { OpportunitiesClient } from './opportunities-client';

export const metadata: Metadata = { title: 'Opportunities' };

export default async function OpportunitiesPage() {
  const opportunities = await communityGet<Opportunity[]>('/opportunities', { all: '1' });
  return <OpportunitiesClient initial={opportunities} />;
}
