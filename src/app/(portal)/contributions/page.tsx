import type { Metadata } from 'next';
import { apiServer, isKycRequired } from '@/server/portal-data';
import { KycRequiredPage } from '@/components/kyc-required';
import type { AjoGroupSummary } from '@/types';
import { ContributionsClient } from './contributions-client';

export const metadata: Metadata = { title: 'Contributions & Ajo' };

export default async function ContributionsPage() {
  let groups: AjoGroupSummary[];
  try {
    groups = await apiServer<AjoGroupSummary[]>('/ajo-groups');
  } catch (error) {
    if (isKycRequired(error)) {
      return (
        <KycRequiredPage
          title="Contributions & Ajo"
          subtitle="Rotating savings groups this community runs"
        />
      );
    }
    throw error;
  }
  return <ContributionsClient initial={groups} />;
}
