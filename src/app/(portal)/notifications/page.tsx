import type { Metadata } from 'next';
import { apiServerSafe } from '@/lib/server-api';
import type { NotificationItem } from '@/types';
import { NotificationsClient } from './notifications-client';

export const metadata: Metadata = { title: 'Notifications' };

export default async function NotificationsPage() {
  const notifications = await apiServerSafe<NotificationItem[]>('/notifications');
  return <NotificationsClient initial={notifications ?? []} />;
}
