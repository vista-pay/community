import type { Metadata } from 'next';
import { AddMembersClient } from './add-members-client';

export const metadata: Metadata = { title: 'Add members' };

export default function AddMembersPage() {
  return <AddMembersClient />;
}
