import type { Metadata } from 'next';
import { communityGet } from '@/server/portal-data';
import type { CommunityConfiguration } from '@/types';
import { ConfigurationClient } from './configuration-client';

export const metadata: Metadata = { title: 'Configuration' };

export default async function ConfigurationPage() {
  const data = await communityGet<CommunityConfiguration>('/configuration');
  return <ConfigurationClient initial={data} />;
}
