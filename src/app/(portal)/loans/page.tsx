import type { Metadata } from 'next';
import { communityGet, isKycRequired } from '@/server/portal-data';
import { KycRequiredPage } from '@/components/kyc-required';
import type { AjoGroupSummary, Loan, LoanProduct } from '@/types';
import { LoansClient } from './loans-client';

export const metadata: Metadata = { title: 'Loans' };

export default async function LoansPage() {
  let products: LoanProduct[];
  let loans: Loan[];
  try {
    // Standalone community loans: applications come straight from members and
    // disburse from the community wallet — no group pools involved.
    [products, loans] = await Promise.all([
      communityGet<LoanProduct[]>('/loan-products'),
      communityGet<Loan[]>('/loans'),
    ]);
  } catch (error) {
    if (isKycRequired(error)) {
      return (
        <KycRequiredPage
          title="Loans"
          subtitle="Applications from your members, and the terms you lend on"
        />
      );
    }
    throw error;
  }

  // The client renders loans grouped; community loans are one lender: the
  // community wallet itself.
  const loansByGroup = [
    {
      group: { groupId: 'community', name: 'Community loans' } as unknown as AjoGroupSummary,
      loans,
    },
  ];

  return <LoansClient products={products} loansByGroup={loansByGroup} />;
}
