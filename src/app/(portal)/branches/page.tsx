import type { Metadata } from 'next';
import { communityGetSafe } from '@/server/portal-data';
import type { BranchesOverview } from '@/types';
import { BranchesClient } from './branches-client';

export const metadata: Metadata = { title: 'Branches' };

export default async function BranchesPage() {
  // Safe read: a plan without the `branches` feature answers enabled:false,
  // and the client renders the upgrade explanation rather than erroring.
  const overview = await communityGetSafe<BranchesOverview>('/branches');
  return <BranchesClient initial={overview} />;
}
