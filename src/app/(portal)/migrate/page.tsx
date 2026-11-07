import type { Metadata } from 'next';
import { communityGet, isKycRequired } from '@/server/portal-data';
import { KycRequiredPage } from '@/components/kyc-required';
import type { MigrationStatus } from '@/types';
import { MigrateClient } from './migrate-client';

export const metadata: Metadata = { title: 'Migrate' };

export default async function MigratePage() {
  let status: MigrationStatus;
  try {
    status = await communityGet<MigrationStatus>('/migration');
  } catch (error) {
    if (isKycRequired(error)) {
      return (
        <KycRequiredPage
          title="Migrate"
          subtitle="Bring your members and their records in from your previous system"
        />
      );
    }
    throw error;
  }

  return <MigrateClient initial={status} />;
}
