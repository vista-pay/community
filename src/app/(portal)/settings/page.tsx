import type { Metadata } from 'next';
import { apiServer } from '@/lib/server-api';
import { requireCommunityId } from '@/server/portal-data';
import { SettingsClient } from './settings-client';

export const metadata: Metadata = { title: 'Settings' };

interface CommunityDetail {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string | null;
  country: string;
  city: string | null;
  category: string | null;
  registrationNumber: string | null;
  status: 'PENDING' | 'VERIFIED' | 'SUSPENDED' | 'REJECTED';
  isDiscoverable: boolean;
  organizerFeesEnabled: boolean;
  verifiedAt: string | null;
  rejectionReason: string | null;
}

export default async function SettingsPage() {
  const communityId = await requireCommunityId();
  // Service policies are no longer edited here — they live on Configuration
  // alongside the numeric rules that belong to the same policy.
  const community = await apiServer<CommunityDetail>(`/communities/${communityId}`);
  return <SettingsClient community={community} />;
}
