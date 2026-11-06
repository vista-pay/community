import type { Metadata } from 'next';
import { communityGet, isKycRequired } from '@/server/portal-data';
import { KycRequiredPage } from '@/components/kyc-required';
import type { LoanProduct } from '@/types';
import { LoanOffersClient } from './loan-offers-client';

export const metadata: Metadata = { title: 'Loan offers' };

export default async function LoanOffersPage() {
  let products: LoanProduct[];
  try {
    products = await communityGet<LoanProduct[]>('/loan-products');
  } catch (error) {
    if (isKycRequired(error)) {
      return (
        <KycRequiredPage
          title="Loan offers"
          subtitle="The terms your community lends on"
        />
      );
    }
    throw error;
  }

  return <LoanOffersClient initial={products} />;
}
