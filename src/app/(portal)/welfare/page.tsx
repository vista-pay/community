import type { Metadata } from 'next';
import { communityGet } from '@/server/portal-data';
import type { WelfareRequestRow } from '@/types';
import { WelfareClient } from './welfare-client';

export const metadata: Metadata = { title: 'Welfare' };

export default async function WelfarePage() {
  const requests = await communityGet<WelfareRequestRow[]>('/welfare');
  return <WelfareClient initial={requests} />;
}
