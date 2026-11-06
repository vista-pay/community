import type { Metadata } from 'next';
import { communityGet } from '@/server/portal-data';
import type { JournalEntry } from '@/types';
import { JournalsClient } from './journals-client';

export const metadata: Metadata = { title: 'Journals' };

export default async function JournalsPage() {
  const entries = await communityGet<JournalEntry[]>('/accounting/journals');
  return <JournalsClient initial={entries} />;
}
