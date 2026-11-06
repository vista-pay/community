import type { Metadata } from 'next';
import { communityGet, isKycRequired } from '@/server/portal-data';
import { KycRequiredPage } from '@/components/kyc-required';
import type { LoanRepaymentRow } from '@/types';
import { LoanRepaymentsClient } from './loan-repayments-client';

export const metadata: Metadata = { title: 'Loan repayments' };

export default async function LoanRepaymentsPage() {
  let repayments: LoanRepaymentRow[];
  try {
    repayments = await communityGet<LoanRepaymentRow[]>('/loans/repayments');
  } catch (error) {
    if (isKycRequired(error)) {
      return (
        <KycRequiredPage
          title="Loan repayments"
          subtitle="Everything your members have paid back"
        />
      );
    }
    throw error;
  }

  return <LoanRepaymentsClient initial={repayments} />;
}
