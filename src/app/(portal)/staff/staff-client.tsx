'use client';

import { useState } from 'react';
import { ShieldCheck, UserCog, UserPlus } from 'lucide-react';
import {
  Avatar,
  Badge,
  Button,
  Callout,
  Card,
  CardHeader,
  ConfirmDialog,
  DataTable,
  EmptyState,
  Field,
  Input,
  Modal,
  PageHeader,
  RadioCard,
  Tabs,
} from '@/components/ui';
import { useMutation, useQuery } from '@/hooks/use-query';
import { useCommunityId, useSession } from '@/components/providers/session-provider';
import { useToast } from '@/components/providers/toast-provider';
import { portalApi } from '@/services/portal';
import { ASSIGNABLE_ROLES, roleName } from '@/data/catalog';
import { date, humanise, relative } from '@/lib/format';
import type { AuditEntry, MemberRow } from '@/types';

type Tab = 'staff' | 'audit';

export function StaffClient({
  members: initialMembers,
  auditLogs: initialAudit,
}: {
  members: MemberRow[];
  auditLogs: AuditEntry[];
}) {
  const communityId = useCommunityId();
  const { user } = useSession();
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>('staff');
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<MemberRow | null>(null);

  const members = useQuery(() => portalApi.members(communityId), [communityId], {
    initial: initialMembers,
  });
  const audit = useQuery(() => portalApi.auditLogs(communityId), [communityId], {
    initial: initialAudit,
  });

  const staff = (members.data ?? []).filter(
    (m) => m.role !== 'COMMUNITY_MEMBER' && m.status === 'ACTIVE',
  );

  const remove = useMutation((memberId: string) => portalApi.removeStaff(communityId, memberId), {
    onSuccess: async () => {
      toast('Access removed', 'info', 'They remain a member, without officer rights.');
      setRemoving(null);
      await members.refresh();
    },
    onError: (message) => toast('Could not remove access', 'error', message),
  });

  return (
    <>
      <PageHeader
        title="Staff & roles"
        subtitle="Who can act on behalf of the community, and what they did"
        actions={
          <Button icon={<UserPlus className="h-4 w-4" />} onClick={() => setAdding(true)}>
            Add an officer
          </Button>
        }
      />

      <Tabs
        value={tab}
        onChange={setTab}
        className="mb-4"
        tabs={[
          { value: 'staff', label: 'Officers', count: staff.length },
          { value: 'audit', label: 'Audit log' },
        ]}
      />

      {tab === 'staff' ? (
        <Card>
          <DataTable
            rows={staff}
            rowKey={(m) => m.id}
            loading={members.loading}
            columns={[
              {
                key: 'name',
                header: 'Officer',
                cell: (m) => (
                  <span className="flex items-center gap-3">
                    <Avatar name={m.name} size="sm" />
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-navy-900">{m.name}</span>
                      <span className="block truncate text-xs text-slate-500">{m.email}</span>
                    </span>
                  </span>
                ),
              },
              {
                key: 'role',
                header: 'Role',
                cell: (m) => <Badge tone="navy">{m.title ?? roleName(m.role)}</Badge>,
              },
              {
                key: 'joined',
                header: 'Since',
                hideOnMobile: true,
                cell: (m) => <span className="text-slate-500">{date(m.joinedAt)}</span>,
              },
              {
                key: 'actions',
                header: '',
                align: 'right',
                cell: (m) =>
                  m.role === 'COMMUNITY_OWNER' ? (
                    <span className="text-xs text-slate-400">Owner</span>
                  ) : m.email === user.email ? (
                    <span className="text-xs text-slate-400">You</span>
                  ) : (
                    <Button size="xs" variant="ghost" onClick={() => setRemoving(m)}>
                      Remove access
                    </Button>
                  ),
              },
            ]}
            empty={
              <EmptyState
                icon={<UserCog className="h-5 w-5" />}
                title="You are the only officer"
                body="Add a treasurer or secretary so the work — and the approvals — are shared."
              />
            }
          />
        </Card>
      ) : (
        <Card>
          <CardHeader
            title="Audit log"
            subtitle="Every action that changed a record, and who took it"
          />
          <DataTable
            rows={audit.data ?? []}
            rowKey={(a) => a.id}
            loading={audit.loading}
            columns={[
              { key: 'action', header: 'Action', cell: (a) => humanise(a.action) },
              {
                key: 'entity',
                header: 'Record',
                hideOnMobile: true,
                cell: (a) => <Badge tone="slate">{humanise(a.entityType)}</Badge>,
              },
              {
                key: 'reason',
                header: 'Reason',
                hideOnMobile: true,
                cell: (a) => <span className="text-slate-500">{a.reason ?? '—'}</span>,
              },
              {
                key: 'when',
                header: 'When',
                align: 'right',
                cell: (a) => <span className="text-slate-500">{relative(a.createdAt)}</span>,
              },
            ]}
            empty={<EmptyState title="Nothing recorded yet" body="Actions appear here as officers work." />}
          />
        </Card>
      )}

      <AddStaffModal
        open={adding}
        onClose={() => setAdding(false)}
        communityId={communityId}
        members={members.data ?? []}
        onAdded={members.refresh}
      />

      <ConfirmDialog
        open={Boolean(removing)}
        onClose={() => setRemoving(null)}
        title="Remove officer access?"
        confirmLabel="Remove access"
        tone="danger"
        loading={remove.pending}
        onConfirm={() => removing && void remove.run(removing.id)}
        body={
          <>
            {removing?.name} will lose access to the portal. Their membership, savings and
            contribution history are untouched.
          </>
        }
      />
    </>
  );
}

function AddStaffModal({
  open,
  onClose,
  communityId,
  members,
  onAdded,
}: {
  open: boolean;
  onClose: () => void;
  communityId: string;
  members: MemberRow[];
  onAdded: () => Promise<void>;
}) {
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [roleName_, setRoleName] = useState<string>('COMMUNITY_TREASURER');
  const [title, setTitle] = useState('');

  const add = useMutation(
    () =>
      portalApi.addStaff(communityId, {
        email: email.trim().toLowerCase(),
        roleName: roleName_,
        title: title.trim() || undefined,
      }),
    {
      onSuccess: async () => {
        toast('Officer added', 'success');
        setEmail('');
        setTitle('');
        onClose();
        await onAdded();
      },
      onError: (message) => toast('Could not add them', 'error', message),
    },
  );

  const known = members.find((m) => m.email.toLowerCase() === email.trim().toLowerCase());

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Add an officer"
      description="They need a Rendi account with this email address."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!email.includes('@')}
            loading={add.pending}
            onClick={() => void add.run()}
          >
            Add officer
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {add.error && <Callout tone="danger">{add.error}</Callout>}

        <Field label="Email address" htmlFor="st-email" required>
          <Input
            id="st-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="treasurer@example.com"
          />
        </Field>

        {known && (
          <Callout tone="info">
            {known.name} is already a member here. Adding them as an officer changes their role,
            not their membership.
          </Callout>
        )}

        <Field label="Title" htmlFor="st-title" optional hint="Shown instead of the role name">
          <Input
            id="st-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Financial Secretary"
          />
        </Field>

        <div>
          <p className="label">Role</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {ASSIGNABLE_ROLES.map((r) => (
              <RadioCard
                key={r.value}
                selected={roleName_ === r.value}
                onSelect={() => setRoleName(r.value)}
                title={r.label}
                description={r.description}
                icon={<ShieldCheck className="h-4 w-4" />}
              />
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}
