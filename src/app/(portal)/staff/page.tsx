import type { Metadata } from 'next';
import { communityGet } from '@/server/portal-data';
import type { AuditEntry, MemberRow } from '@/types';
import { StaffClient } from './staff-client';

export const metadata: Metadata = { title: 'Staff & roles' };

export default async function StaffPage() {
  const [members, auditLogs] = await Promise.all([
    communityGet<MemberRow[]>('/members', { includeOwner: true }),
    communityGet<AuditEntry[]>('/audit-logs', { limit: 50 }),
  ]);

  return <StaffClient members={members} auditLogs={auditLogs} />;
}
