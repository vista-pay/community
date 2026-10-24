import type { Metadata } from 'next';
import { communityGet } from '@/server/portal-data';
import { apiServerSafe } from '@/lib/server-api';
import type { ServiceCatalogItem, ServiceRequest } from '@/types';
import { ServicesClient } from './services-client';

export const metadata: Metadata = { title: 'Services' };

export default async function ServicesPage() {
  const [requests, catalog] = await Promise.all([
    communityGet<ServiceRequest[]>('/services'),
    apiServerSafe<ServiceCatalogItem[]>('/community-services/catalog'),
  ]);

  return <ServicesClient requests={requests} catalog={catalog ?? []} />;
}
