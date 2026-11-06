import type { Metadata } from 'next';
import { communityGet, isKycRequired } from '@/server/portal-data';
import { KycRequiredPage } from '@/components/kyc-required';
import type { Loan } from '@/types';
import { LoanQueue } from '../loan-queue';

export const metadata: Metadata = { title: 'Approved loans' };

export default async function ApprovedLoansPage() {
  let loans: Loan[];
  try {
    // One read for the whole book; the queue narrows it to this stage, so
    // moving between stages does not re-fetch.
    loans = await communityGet<Loan[]>('/loans');
  } catch (error) {
    if (isKycRequired(error)) {
      return <KycRequiredPage title="Approved loans" subtitle="Approved but not yet paid out — disbursing needs the owner\u2019s approval" />;
    }
    throw error;
  }

  return (
    <LoanQueue
      title="Approved loans"
      subtitle="Approved but not yet paid out — disbursing needs the owner\u2019s approval"
      statuses={['APPROVED']}
      initial={loans}
      emptyTitle="Nothing approved and waiting"
      emptyBody="Loans you approve sit here until you disburse them. Approving moves no money."
    />
  );
}
