import type { Metadata } from 'next';
import { communityGet, isKycRequired } from '@/server/portal-data';
import { KycRequiredPage } from '@/components/kyc-required';
import type { Loan } from '@/types';
import { LoanQueue } from '../loan-queue';

export const metadata: Metadata = { title: 'Disbursed loans' };

export default async function DisbursedLoansPage() {
  let loans: Loan[];
  try {
    // One read for the whole book; the queue narrows it to this stage, so
    // moving between stages does not re-fetch.
    loans = await communityGet<Loan[]>('/loans');
  } catch (error) {
    if (isKycRequired(error)) {
      return <KycRequiredPage title="Disbursed loans" subtitle="Money that has left the community and is being repaid" />;
    }
    throw error;
  }

  return (
    <LoanQueue
      title="Disbursed loans"
      subtitle="Money that has left the community and is being repaid"
      statuses={['DISBURSED', 'REPAYING', 'DEFAULTED']}
      initial={loans}
      emptyTitle="Nothing disbursed yet"
      emptyBody="Once you pay out an approved loan it appears here until it is settled."
    />
  );
}
