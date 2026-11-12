import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

export const metadata: Metadata = { title: 'Members' };

export default async function MembersPage() {
  redirect('/members');
}
