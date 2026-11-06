import type { Metadata } from 'next';
import { communityGet, communityGetSafe, isKycRequired } from '@/server/portal-data';
import { KycRequiredPage } from '@/components/kyc-required';
import type { Loan, LoanProduct } from '@/types';
import { LoansHubClient } from './loans-hub-client';

export const metadata: Metadata = { title: 'Loans' };

export default async function LoansPage() {
  let loans: Loan[];
  let products: LoanProduct[] | null;
  try {
    // The loan list carries the KYC gate, so it is the read that must throw.
    // Offers are only a count on this page — safe, so a hiccup there does not
    // stop an officer reaching the sub-sections.
    [loans, products] = await Promise.all([
      communityGet<Loan[]>('/loans'),
      communityGetSafe<LoanProduct[]>('/loan-products'),
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

  return <LoansHubClient loans={loans} products={products ?? []} />;
}
