import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Spinner } from '@/components/ui';
import { ApprovalsClient } from './approvals-client';

export const metadata: Metadata = { title: 'Approvals' };

/**
 * The queue reads `?requestId=` so a notification can open one decision
 * directly, which means it needs a Suspense boundary: `useSearchParams` opts
 * the tree out of static prerendering, and without one the whole route fails
 * to build rather than simply rendering on demand.
 */
export default function ApprovalsPage() {
  return (
    <Suspense
      fallback={
        <div className="py-16 text-center">
          <Spinner />
        </div>
      }
    >
      <ApprovalsClient />
    </Suspense>
  );
}
