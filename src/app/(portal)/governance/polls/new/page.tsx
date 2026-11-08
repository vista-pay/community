import type { Metadata } from 'next';
import { NewPollClient } from './new-poll-client';

export const metadata: Metadata = { title: 'Open a ballot' };

export default function NewPollPage() {
  return <NewPollClient />;
}
