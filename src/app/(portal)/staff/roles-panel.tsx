'use client';

import { useMemo, useState } from 'react';
import { Crown, Pencil, Plus, ShieldCheck, Trash2, UserRoundCheck, Users, Vote } from 'lucide-react';
import {
  Badge,
  Button,
  Callout,
  Card,
  CardHeader,
  Checkbox,
  ConfirmDialog,
  EmptyState,
  Field,
  Input,
  Modal,
  Segmented,
  Select,
  Textarea,
} from '@/components/ui';
import { useMutation, useQuery } from '@/hooks/use-query';
import { useCommunityId } from '@/components/providers/session-provider';
import { useToast } from '@/components/providers/toast-provider';
import { portalApi } from '@/services/portal';
import { date } from '@/lib/format';
import { cn } from '@/lib/format';
import type { CommunityRole, MemberRow, RoleInput } from '@/types';

/**
 * Posts and standing roles.
 *
 * A cooperative's officers are elected, so the thing this screen has to get
 * right is the *handover*: when the membership votes in a new treasurer, that
 * is one act, not "remove the old one" followed by "add the new one" with a
 * window in between where nobody holds the purse. Assigning an elected post
 * therefore shows who it is being taken from, and the API moves it in a
 * single transaction.
 */
export function RolesPanel({ members }: { members: MemberRow[] }) {
  const communityId = useCommunityId();
  const { toast } = useToast();

  const roles = useQuery(() => portalApi.roles(communityId), [communityId]);
  const vocabulary = useQuery(() => portalApi.roleVocabulary(communityId), [communityId]);

  const [editing, setEditing] = useState<CommunityRole | null>(null);
  const [creating, setCreating] = useState(false);
  const [assigning, setAssigning] = useState<CommunityRole | null>(null);
  const [deleting, setDeleting] = useState<CommunityRole | null>(null);

  const remove = useMutation((roleId: string) => portalApi.deleteRole(communityId, roleId), {
    onSuccess: async () => {
      toast('Role deleted', 'info');
      setDeleting(null);
      await roles.refresh();
    },
    onError: (message) => toast('Could not delete this role', 'error', message),
  });

  const posts = (roles.data ?? []).filter((r) => r.name !== 'MEMBER');

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title="Posts and roles"
          subtitle="Who may act for the community, and how far that reach goes. Elected posts hand over to one person at a time."
          action={
            <Button
              size="sm"
              icon={<Plus className="h-3.5 w-3.5" />}
              onClick={() => setCreating(true)}
            >
              New role
            </Button>
          }
        />

        {roles.error && <Callout tone="danger" className="m-5">{roles.error}</Callout>}

        <div className="divide-y divide-slate-100">
          {posts.map((role) => (
            <RoleRow
              key={role.id}
              role={role}
              onAssign={() => setAssigning(role)}
              onEdit={() => setEditing(role)}
              onDelete={() => setDeleting(role)}
            />
          ))}

          {!roles.loading && posts.length === 0 && (
            <EmptyState
              icon={<ShieldCheck className="h-5 w-5" />}
              title="No posts yet"
              body="Create the roles your constitution names — president, secretary, financial secretary — then assign them."
            />
          )}
        </div>
      </Card>

      {(creating || editing) && vocabulary.data && (
        <RoleEditor
          role={editing}
          vocabulary={vocabulary.data}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={async () => {
            setCreating(false);
            setEditing(null);
            await roles.refresh();
          }}
        />
      )}

      {assigning && (
        <AssignDialog
          role={assigning}
          members={members}
          onClose={() => setAssigning(null)}
          onAssigned={async () => {
            setAssigning(null);
            await roles.refresh();
          }}
        />
      )}

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && void remove.run(deleting.id)}
        title={`Delete "${deleting?.label}"?`}
        tone="danger"
        confirmLabel="Delete role"
        loading={remove.pending}
        body={
          <>
            The role disappears from this community. Anyone holding it must be moved first — the
            API refuses otherwise, rather than silently stripping their access.
          </>
        }
      />
    </div>
  );
}

// ───────────────────────────── One row ─────────────────────────────

function RoleRow({
  role,
  onAssign,
  onEdit,
  onDelete,
}: {
  role: CommunityRole;
  onAssign: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const registrar = role.name === 'REGISTRAR';

  return (
    <div className="flex flex-wrap items-start gap-4 px-5 py-4">
      <span
        className={cn(
          'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
          registrar
            ? 'bg-amber-50 text-amber-700'
            : role.isElected
              ? 'bg-blue-50 text-blue-700'
              : 'bg-slate-100 text-slate-600',
        )}
      >
        {registrar ? (
          <Crown className="h-4 w-4" />
        ) : role.isElected ? (
          <Vote className="h-4 w-4" />
        ) : (
          <Users className="h-4 w-4" />
        )}
      </span>

      <div className="min-w-[200px] flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-navy-900">{role.label}</span>
          {role.isElected ? (
            <Badge tone="blue">Elected post</Badge>
          ) : (
            <Badge tone="slate">Standing role</Badge>
          )}
          {!role.isSystem && <Badge tone="purple">Custom</Badge>}
        </div>

        {role.description && (
          <p className="mt-1 text-[13px] leading-relaxed text-slate-500">{role.description}</p>
        )}

        <div className="mt-2 flex flex-wrap gap-1.5">
          {role.permissions.map((p) => (
            <span
              key={`${p.resource}-${p.action}`}
              className="rounded-md bg-slate-100 px-2 py-0.5 text-[11.5px] font-medium text-slate-600"
            >
              {RESOURCE_LABELS[p.resource] ?? p.resource} · {ACTION_LABELS[p.action] ?? p.action}
            </span>
          ))}
        </div>

        <div className="mt-2.5">
          {role.holders.length === 0 ? (
            <span className="text-[13px] italic text-slate-400">Vacant</span>
          ) : (
            <ul className="space-y-1">
              {role.holders.map((h) => (
                <li key={h.memberId} className="flex items-center gap-2 text-[13px]">
                  <UserRoundCheck className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                  <span className="font-medium text-navy-800">{h.title ?? h.name}</span>
                  <span className="truncate text-slate-500">{h.name !== h.title && h.email}</span>
                  <span className="hidden text-slate-400 sm:inline">since {date(h.since)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        {!registrar && (
          <Button size="xs" variant="secondary" onClick={onAssign}>
            {role.isElected && role.holders.length > 0 ? 'Hand over' : 'Assign'}
          </Button>
        )}
        {!role.isProtected && (
          <Button
            size="xs"
            variant="ghost"
            aria-label={`Edit ${role.label}`}
            onClick={onEdit}
            icon={<Pencil className="h-3.5 w-3.5" />}
          />
        )}
        {!role.isSystem && (
          <Button
            size="xs"
            variant="ghost"
            aria-label={`Delete ${role.label}`}
            onClick={onDelete}
            icon={<Trash2 className="h-3.5 w-3.5" />}
          />
        )}
      </div>
    </div>
  );
}

// ───────────────────────── Create / edit a role ─────────────────────────

const RESOURCE_LABELS: Record<string, string> = {
  community: 'Community',
  ajo: 'Contributions',
  payments: 'Money',
  loans: 'Lending',
  merchant: 'Merchant',
};
const ACTION_LABELS: Record<string, string> = {
  read: 'view',
  write: 'change',
  '*': 'full',
};

function RoleEditor({
  role,
  vocabulary,
  onClose,
  onSaved,
}: {
  role: CommunityRole | null;
  vocabulary: { resources: Array<{ resource: string; label: string; description: string }> };
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const communityId = useCommunityId();
  const { toast } = useToast();

  const [label, setLabel] = useState(role?.label ?? '');
  const [description, setDescription] = useState(role?.description ?? '');
  const [isElected, setIsElected] = useState(role?.isElected ?? true);
  // Resource -> granted action. Absent means the role has no reach there,
  // which is the default: a new post starts with nothing and is given what
  // it needs, rather than starting with everything and being trimmed.
  const [grants, setGrants] = useState<Record<string, string>>(() =>
    Object.fromEntries((role?.permissions ?? []).map((p) => [p.resource, p.action])),
  );

  const permissions = useMemo(
    () => Object.entries(grants).map(([resource, action]) => ({ resource, action })),
    [grants],
  );
  const valid = label.trim().length >= 2 && permissions.length > 0;

  const save = useMutation(
    () => {
      const body: RoleInput = {
        label: label.trim(),
        description: description.trim() || undefined,
        isElected,
        permissions,
      };
      return role
        ? portalApi.updateRole(communityId, role.id, body)
        : portalApi.createRole(communityId, body);
    },
    {
      onSuccess: async () => {
        toast(role ? 'Role updated' : 'Role created', 'success');
        await onSaved();
      },
      onError: (message) => toast('Could not save this role', 'error', message),
    },
  );

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={role ? `Edit "${role.label}"` : 'New role'}
      description="Name the post as your constitution does, then give it only the reach it needs."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={save.pending}>
            Cancel
          </Button>
          <Button loading={save.pending} disabled={!valid} onClick={() => void save.run()}>
            {role ? 'Save changes' : 'Create role'}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {save.error && <Callout tone="danger">{save.error}</Callout>}

        <Field label="Name" htmlFor="role-label" required>
          <Input
            id="role-label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Welfare Officer"
            autoFocus
          />
        </Field>

        <Field label="What this post does" htmlFor="role-desc" optional>
          <Textarea
            id="role-desc"
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Reviews welfare claims before the committee meets"
          />
        </Field>

        <Field
          label="How it is held"
          htmlFor="role-kind"
          hint={
            isElected
              ? 'One holder at a time. Assigning it hands the post over from whoever holds it now.'
              : 'Several people can hold it at once — useful for a caseload rather than an office.'
          }
        >
          <Segmented
            label="How it is held"
            value={isElected ? 'elected' : 'standing'}
            onChange={(v) => setIsElected(v === 'elected')}
            options={[
              { value: 'elected', label: 'Elected post' },
              { value: 'standing', label: 'Standing role' },
            ]}
          />
        </Field>

        <div>
          <p className="label">Permissions</p>
          <p className="mb-3 text-[13px] text-slate-500">
            Leave an area off entirely if the post has no business there.
          </p>
          <div className="space-y-2.5">
            {vocabulary.resources.map((r) => {
              const granted = grants[r.resource];
              return (
                <div
                  key={r.resource}
                  className={cn(
                    'rounded-xl border p-3.5 transition',
                    granted ? 'border-brand-300 bg-brand-50/30' : 'border-slate-200 bg-white',
                  )}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <Checkbox
                      checked={Boolean(granted)}
                      onChange={(on) =>
                        setGrants((g) => {
                          const next = { ...g };
                          if (on) next[r.resource] = 'read';
                          else delete next[r.resource];
                          return next;
                        })
                      }
                      label={r.label}
                      description={r.description}
                    />
                    {granted && (
                      <Select
                        aria-label={`${r.label} level`}
                        className="w-auto min-w-[150px]"
                        value={granted}
                        onChange={(e) =>
                          setGrants((g) => ({ ...g, [r.resource]: e.target.value }))
                        }
                      >
                        <option value="read">View only</option>
                        <option value="write">View and change</option>
                        <option value="*">Full control</option>
                      </Select>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {permissions.length === 0 && (
            <p className="mt-2 text-[13px] text-amber-700">
              A role with no permissions grants nothing — pick at least one area.
            </p>
          )}
        </div>
      </div>
    </Modal>
  );
}

// ───────────────────────── Assign / hand over ─────────────────────────

function AssignDialog({
  role,
  members,
  onClose,
  onAssigned,
}: {
  role: CommunityRole;
  members: MemberRow[];
  onClose: () => void;
  onAssigned: () => void | Promise<void>;
}) {
  const communityId = useCommunityId();
  const { toast } = useToast();
  const [memberId, setMemberId] = useState('');
  const [title, setTitle] = useState('');

  const holderIds = new Set(role.holders.map((h) => h.memberId));
  const candidates = members
    .filter((m) => m.status === 'ACTIVE' && !holderIds.has(m.id))
    .sort((a, b) => a.name.localeCompare(b.name));

  const outgoing = role.isElected ? role.holders[0] : null;

  const assign = useMutation(
    () => portalApi.assignRole(communityId, role.id, { memberId, title: title.trim() || undefined }),
    {
      onSuccess: async (result) => {
        toast(
          result.replaced ? `${role.label} handed over` : `${role.label} assigned`,
          'success',
          result.replaced ? `${result.replaced} returns to plain membership.` : undefined,
        );
        await onAssigned();
      },
      onError: (message) => toast('Could not assign this post', 'error', message),
    },
  );

  return (
    <Modal
      open
      onClose={onClose}
      size="md"
      title={outgoing ? `Hand over ${role.label}` : `Assign ${role.label}`}
      description={
        outgoing
          ? `${outgoing.name} holds it now. Handing it over moves the post and returns them to plain membership — in one step, so the post is never held by two people or nobody.`
          : 'Pick the member who takes this post.'
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={assign.pending}>
            Cancel
          </Button>
          <Button loading={assign.pending} disabled={!memberId} onClick={() => void assign.run()}>
            {outgoing ? 'Hand over' : 'Assign'}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {assign.error && <Callout tone="danger">{assign.error}</Callout>}

        <Field label="Member" htmlFor="assign-member" required>
          <Select
            id="assign-member"
            value={memberId}
            onChange={(e) => setMemberId(e.target.value)}
            autoFocus
          >
            <option value="">Select a member…</option>
            {candidates.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} — {m.email}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="Title"
          htmlFor="assign-title"
          optional
          hint={`Shown instead of "${role.label}" — for an acting or honorary variation`}
        >
          <Input
            id="assign-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={role.label}
          />
        </Field>

        {candidates.length === 0 && (
          <Callout tone="warning">
            Every active member already holds this role. Add members first, or free someone up.
          </Callout>
        )}
      </div>
    </Modal>
  );
}
