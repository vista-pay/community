import type { Metadata } from 'next';
import { communityGet, isKycRequired } from '@/server/portal-data';
import { KycRequiredPage } from '@/components/kyc-required';
import type { Loan } from '@/types';
import { LoanQueue } from '../loan-queue';

export const metadata: Metadata = { title: 'Requested loans' };

export default async function RequestedLoansPage() {
  let loans: Loan[];
  try {
    // One read for the whole book; the queue narrows it to this stage, so
    // moving between stages does not re-fetch.
    loans = await communityGet<Loan[]>('/loans');
  } catch (error) {
    if (isKycRequired(error)) {
      return <KycRequiredPage title="Requested loans" subtitle="Applications waiting on a decision from the committee" />;
    }
    throw error;
  }

  return (
    <LoanQueue
      title="Requested loans"
      subtitle="Applications waiting on a decision from the committee"
      statuses={['SUBMITTED', 'UNDER_REVIEW']}
      initial={loans}
      emptyTitle="Nothing waiting"
      emptyBody="Applications members submit from the app appear here for review."
    />
  );
}
