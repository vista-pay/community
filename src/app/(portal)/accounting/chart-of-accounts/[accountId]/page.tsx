import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { communityGet } from '@/server/portal-data';
import type { BookAccount, PostingRule } from '@/types';
import { AccountForm } from '../account-form';

export const metadata: Metadata = { title: 'Edit account' };

export default async function EditAccountPage({
  params,
}: {
  params: Promise<{ accountId: string }>;
}) {
  const { accountId } = await params;
  const chart = await communityGet<{ accounts: BookAccount[]; postingRules: PostingRule[] }>(
    '/accounting/accounts',
  );
  const account = chart.accounts.find((a) => a.id === accountId);
  if (!account) notFound();

  return <AccountForm account={account} chart={chart.accounts} />;
}
