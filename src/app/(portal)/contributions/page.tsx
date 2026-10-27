import type { Metadata } from 'next';
import { communityGet, isKycRequired } from '@/server/portal-data';
import { KycRequiredPage } from '@/components/kyc-required';
import type { CommunityGroupRow } from '@/types';
import { ContributionsClient } from './contributions-client';

export const metadata: Metadata = { title: 'Contributions & Ajo' };

export default async function ContributionsPage() {
  let groups: CommunityGroupRow[];
  try {
    // Community-scoped on purpose: staff manage these groups without holding
    // a seat in them, so a membership-based list would come back empty.
    groups = await communityGet<CommunityGroupRow[]>('/ajo-groups');
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
