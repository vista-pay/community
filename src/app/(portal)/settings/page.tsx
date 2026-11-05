import type { Metadata } from 'next';
import { apiServer } from '@/lib/server-api';
import { communityGet, requireCommunityId } from '@/server/portal-data';
import { SettingsClient } from './settings-client';
import type { CommunityPolicy } from '@/types';

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
  const [community, policies] = await Promise.all([
    apiServer<CommunityDetail>(`/communities/${communityId}`),
    communityGet<CommunityPolicy[]>('/service-policies'),
  ]);
  return <SettingsClient community={community} initialPolicies={policies} />;
}
