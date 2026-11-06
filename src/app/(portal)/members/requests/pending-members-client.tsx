'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import { LinkButton, PageHeader, Tabs } from '@/components/ui';
import type { JoinRequest, PendingInvitation } from '@/types';
import { JoinRequestsClient } from './join-requests-client';
import { InvitationsClient } from './invitations-client';

type Queue = 'applications' | 'invitations';

/**
 * Two queues, deliberately kept apart.
 *
 * An application is someone asking to join, and an officer decides. An
 * invitation is the officer having already decided, waiting on the person.
 * They look similar and need opposite actions, so merging them into one list
 * would mean every row carried "who is this waiting on?".
 */
export function PendingMembersClient({
  requests,
  invitations,
}: {
  requests: JoinRequest[];
  invitations: PendingInvitation[];
}) {
  const [queue, setQueue] = useState<Queue>(
    // Land on whichever queue actually has something waiting.
    requests.length === 0 && invitations.length > 0 ? 'invitations' : 'applications',
  );

  return (
    <>
      <PageHeader
        title="Pending members"
        subtitle="People waiting on you, and people you are waiting on"
        breadcrumb={
          <Link href={'/members' as Route} className="hover:text-navy-700">
            Members
          </Link>
        }
        actions={
          <LinkButton size="sm" href={'/members/add' as Route}>
            Add new member
          </LinkButton>
        }
      />

      <Tabs
        value={queue}
        onChange={setQueue}
        className="mb-4"
        tabs={[
          { value: 'applications', label: 'Applications', count: requests.length },
          { value: 'invitations', label: 'Invitations sent', count: invitations.length },
        ]}
      />

      {queue === 'applications' ? (
        <JoinRequestsClient initial={requests} />
      ) : (
        <InvitationsClient initial={invitations} />
      )}
    </>
  );
}
