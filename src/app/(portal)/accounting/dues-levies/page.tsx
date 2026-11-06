import type { Metadata } from 'next';
import { communityGet } from '@/server/portal-data';
import type { DuesLeviesOverview } from '@/types';
import { DuesLeviesClient } from './dues-levies-client';

export const metadata: Metadata = { title: 'Dues & levies' };

export default async function DuesLeviesPage() {
  const data = await communityGet<DuesLeviesOverview>('/dues-levies');
  return <DuesLeviesClient initial={data} />;
}
