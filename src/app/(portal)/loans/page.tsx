import type { Metadata } from 'next';
import { apiServer, communityGet, isKycRequired } from '@/server/portal-data';
import { KycRequiredPage } from '@/components/kyc-required';
import type { AjoGroupSummary, Loan, LoanProduct } from '@/types';
import { LoansClient } from './loans-client';

export const metadata: Metadata = { title: 'Loans' };

export default async function LoansPage() {
  let products: LoanProduct[];
  let groups: AjoGroupSummary[];
  try {
    [products, groups] = await Promise.all([
      communityGet<LoanProduct[]>('/loan-products'),
      apiServer<AjoGroupSummary[]>('/ajo-groups'),
    ]);
  } catch (error) {
    // Loans are funded from Ajo pools, so the whole page is behind the same
    // verification gate as Ajo itself.
    if (isKycRequired(error)) {
      return (
        <KycRequiredPage
          title="Loans"
          subtitle="Applications against your Ajo group pools, and the terms you lend on"
        />
      );
    }
    throw error;
  }

  // Loan applications hang off the Ajo group whose pool funds them, so the
  // portal-wide list is the union across this community's groups.
  const loansByGroup = await Promise.all(
    groups.map(async (g) => ({
      group: g,
      loans: await apiServer<Loan[]>(`/ajo-groups/${g.groupId}/loans`).catch(() => [] as Loan[]),
    })),
  );

  return <LoansClient products={products} loansByGroup={loansByGroup} />;
}
