import type { Metadata } from 'next';
import { ApprovalSettingsClient } from './approval-settings-client';

export const metadata: Metadata = { title: 'Approval workflow & authorisation' };

export default function ApprovalSettingsPage() {
  return <ApprovalSettingsClient />;
}
