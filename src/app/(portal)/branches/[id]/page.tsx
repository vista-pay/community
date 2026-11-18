import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { communityGetSafe } from '@/server/portal-data';
import type { BranchDetail } from '@/types';
import { BranchClient } from './branch-client';

export const metadata: Metadata = { title: 'Branch' };

export default async function BranchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Safe read: a plan without the `branches` feature, or an id from another
  // community, both answer null rather than throwing into the error boundary.
  const branch = await communityGetSafe<BranchDetail>(`/branches/${id}`);
  if (!branch) notFound();
  return <BranchClient initial={branch} branchId={id} />;
}
