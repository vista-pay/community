'use client';

import { useState } from 'react';
import { MailCheck, MailX, Smartphone } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  DataTable,
  EmptyState,
} from '@/components/ui';
import { useMutation, useQuery } from '@/hooks/use-query';
import { useCommunityId } from '@/components/providers/session-provider';
import { useToast } from '@/components/providers/toast-provider';
import { portalApi } from '@/services/portal';
import { date, relative } from '@/lib/format';
import type { PendingInvitation } from '@/types';

/** Stable empty result: `?? []` inline would re-render the table every poll. */
const NONE: never[] = [];

export function InvitationsClient({ initial }: { initial: PendingInvitation[] }) {
  const communityId = useCommunityId();
  const { toast } = useToast();
  const [revoking, setRevoking] = useState<PendingInvitation | null>(null);

  const { data, refresh } = useQuery<PendingInvitation[]>(
    () => portalApi.pendingInvitations(communityId),
    [communityId],
    { initial },
  );
  const rows = data ?? NONE;

  const revoke = useMutation((id: string) => portalApi.revokeInvitation(communityId, id), {
    onSuccess: () => {
      toast('Invitation withdrawn', 'info', 'They can be invited again at any time.');
      setRevoking(null);
      void refresh();
    },
    onError: (message) => toast('Could not withdraw', 'error', message),
  });

  if (rows.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={<MailCheck className="h-5 w-5" />}
          title="No invitations outstanding"
          body="Everyone you have invited has answered. Invitations you send appear here until they accept or decline."
        />
      </Card>
    );
  }

  return (
    <>
      <Card>
        <DataTable
          rows={rows}
          rowKey={(row) => row.id}
          columns={[
            {
              key: 'email',
              header: 'Email',
              cell: (row) => (
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-medium text-navy-900">{row.email}</p>
                  {row.invitedBy && (
                    <p className="text-[12px] text-slate-500">Invited by {row.invitedBy}</p>
                  )}
                </div>
              ),
            },
            {
              key: 'channel',
              header: 'How they were told',
              cell: (row) =>
                row.hasAccount ? (
                  <span className="inline-flex items-center gap-1.5 text-[12.5px] text-slate-600">
                    <Smartphone className="h-3.5 w-3.5 text-navy-500" />
                    Asked in the app
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-[12.5px] text-slate-600">
                    <MailCheck className="h-3.5 w-3.5 text-slate-400" />
                    Emailed a download link
                  </span>
                ),
            },
            {
              key: 'sent',
              header: 'Sent',
              cell: (row) => (
                <span className="text-[12.5px] text-slate-600" title={date(row.invitedAt)}>
                  {relative(row.invitedAt)}
                </span>
              ),
            },
            {
              key: 'expires',
              header: 'Expires',
              cell: (row) => <Badge tone="navy">{date(row.expiresAt)}</Badge>,
            },
            {
              key: 'actions',
              header: '',
              align: 'right',
              cell: (row) => (
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<MailX className="h-3.5 w-3.5" />}
                  onClick={() => setRevoking(row)}
                >
                  Withdraw
                </Button>
              ),
            },
          ]}
        />
      </Card>

      <ConfirmDialog
        open={Boolean(revoking)}
        onClose={() => setRevoking(null)}
        onConfirm={() => revoking && revoke.run(revoking.id)}
        loading={revoke.pending}
        title="Withdraw this invitation?"
        confirmLabel="Withdraw"
        tone="danger"
        body={
          revoking
            ? `${revoking.email} will no longer be able to accept. You can invite them again later.`
            : ''
        }
      />
    </>
  );
}
