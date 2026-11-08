import { communityGet } from '@/server/portal-data';
import type { SavingsStatement } from '@/types';
import { SavingsStatementClient } from './savings-statement-client';

export default async function SavingsStatementPage({
  params,
}: {
  params: Promise<{ accountId: string }>;
}) {
  const { accountId } = await params;
  const statement = await communityGet<SavingsStatement>(
    `/portal/savings/accounts/${accountId}`,
  );

  return <SavingsStatementClient statement={statement} />;
}
