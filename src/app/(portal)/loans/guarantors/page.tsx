import type { Metadata } from 'next';
import { communityGet, isKycRequired } from '@/server/portal-data';
import { KycRequiredPage } from '@/components/kyc-required';
import type { LoanGuarantorRow } from '@/types';
import { LoanGuarantorsClient } from './loan-guarantors-client';

export const metadata: Metadata = { title: 'Guarantors' };

export default async function LoanGuarantorsPage() {
  let guarantors: LoanGuarantorRow[];
  try {
    guarantors = await communityGet<LoanGuarantorRow[]>('/loans/guarantors');
  } catch (error) {
    if (isKycRequired(error)) {
      return (
        <KycRequiredPage
          title="Guarantors"
          subtitle="Who stands behind each loan"
        />
      );
    }
    throw error;
  }

  return <LoanGuarantorsClient initial={guarantors} />;
}
