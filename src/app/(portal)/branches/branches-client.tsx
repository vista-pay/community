'use client';

/**
 * Branches — the `branches` plan feature made usable: chapters that group
 * the member roster. Create, rename and delete branches, read each roster,
 * and move members between branches (or out of any). Deleting a branch only
 * unassigns its members; nothing else about them changes.
 */

import { useState } from 'react';
import Link from 'next/link';
import { Network, Pencil, Plus, Trash2, UserCircle2, Users } from 'lucide-react';
import { useSession } from '@/components/providers/session-provider';
import { useToast } from '@/components/providers/toast-provider';
import { useQuery } from '@/hooks/use-query';
import { portalApi } from '@/services/portal';
import {
  Button,
  Callout,
  Card,
  CardHeader,
  ConfirmDialog,
  EmptyState,
  Field,
  Input,
  LinkButton,
  Modal,
  PageHeader,
  Skeleton,
} from '@/components/ui';
import type { BranchMemberRow, BranchesOverview, CommunityBranch, MemberRow } from '@/types';

export function BranchesClient({ initial }: { initial: BranchesOverview | null }) {
  const { community } = useSession();
  const { toast } = useToast();
  const communityId = community?.id ?? '';

  const {
    data: overview,
    refresh,
    loading,
  } = useQuery<BranchesOverview | null>(
    () => (communityId ? portalApi.branches(communityId) : Promise.resolve(null)),
    [communityId],
    { initial, enabled: Boolean(communityId) },
  );

  const [creating, setCreating] = useState(false);
  const [renaming, setRenaming] = useState<CommunityBranch | null>(null);
  const [removing, setRemoving] = useState<CommunityBranch | null>(null);
  const [assigning, setAssigning] = useState<CommunityBranch | null>(null);
  const [roster, setRoster] = useState<CommunityBranch | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (overview && !overview.enabled) {
    return (
      <div>
        <PageHeader title="Branches" subtitle="Group members by branch or chapter" />
        <Callout tone="info" title="Not part of the current plan">
          Branches — chapters that group your member roster — come with plans that include the
          feature. See{' '}
          <Link href="/billing" className="font-semibold text-blue-600 hover:underline">
            Billing &amp; plan
          </Link>{' '}
          for what each plan carries.
        </Callout>
      </div>
    );
  }

  async function run(action: () => Promise<unknown>, done: string) {
    setBusy(true);
    setError('');
    try {
      await action();
      toast(done);
      setCreating(false);
      setRenaming(null);
      setRemoving(null);
      setAssigning(null);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'That did not save.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Branches"
        subtitle="Chapters that group your member roster — deleting one only unassigns its members"
        actions={
          <Button onClick={() => { setError(''); setCreating(true); }}>
            <Plus className="h-4 w-4" aria-hidden /> New branch
          </Button>
        }
      />

      {overview && overview.unassigned > 0 && overview.branches.length > 0 && (
        <Callout tone="info" className="mb-5">
          {overview.unassigned} active member{overview.unassigned === 1 ? ' is' : 's are'} not in
          any branch yet — open a branch&rsquo;s “Assign members” to place them.
        </Callout>
      )}

      {!overview && loading && <Skeleton className="h-40" />}

      {overview && overview.branches.length === 0 ? (
        <EmptyState
          icon={<Network className="h-6 w-6" />}
          title="No branches yet"
          body="Create the first chapter — Ikeja branch, Abuja chapter — then assign members to it."
          action={<Button onClick={() => setCreating(true)}>Create a branch</Button>}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {overview?.branches.map((branch) => (
            <Card key={branch.id}>
              <CardHeader
                title={
                  <Link href={`/branches/${branch.id}`} className="hover:text-brand-700 hover:underline">
                    {branch.name}
                  </Link>
                }
                subtitle={
                  [branch.code, [branch.city, branch.state].filter(Boolean).join(', ')]
                    .filter(Boolean)
                    .join(' · ') || branch.description || undefined
                }
                action={
                  <span className="tnum rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                    {branch.memberCount} member{branch.memberCount === 1 ? '' : 's'}
                  </span>
                }
              />
              {/* Who runs it, on the card. A branches list that shows only
                  headcounts cannot answer the first question anybody has. */}
              <div className="flex flex-wrap items-center gap-1.5 px-5 pb-3 text-[13px]">
                {branch.manager ? (
                  <>
                    <UserCircle2 className="h-4 w-4 text-brand-600" aria-hidden />
                    <b className="text-navy-900">{branch.manager.name}</b>
                    <span className="text-slate-500">{branch.manager.title}</span>
                  </>
                ) : (
                  <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800">
                    No manager yet
                  </span>
                )}
                {branch.staffCount > 0 && (
                  <span className="text-slate-500">
                    · {branch.staffCount} staff
                  </span>
                )}
                {!branch.isActive && (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                    Closed
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-2 px-5 pb-4">
                <LinkButton size="sm" variant="blue" href={`/branches/${branch.id}`}>
                  Open branch
                </LinkButton>
                <Button size="sm" variant="secondary" onClick={() => setRoster(branch)}>
                  <Users className="h-3.5 w-3.5" aria-hidden /> Members
                </Button>
                <Button size="sm" variant="secondary" onClick={() => { setError(''); setAssigning(branch); }}>
                  Assign members
                </Button>
                <Button size="sm" variant="ghost" onClick={() => { setError(''); setRenaming(branch); }}>
                  <Pencil className="h-3.5 w-3.5" aria-hidden /> Edit
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setRemoving(branch)}>
                  <Trash2 className="h-3.5 w-3.5 text-red-600" aria-hidden />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {(creating || renaming) && (
        <BranchFormModal
          branch={renaming}
          busy={busy}
          error={error}
          onClose={() => { setCreating(false); setRenaming(null); }}
          onSave={(body) =>
            renaming
              ? void run(() => portalApi.updateBranch(communityId, renaming.id, body), `${body.name ?? renaming.name} updated.`)
              : void run(() => portalApi.createBranch(communityId, { name: body.name ?? '', description: body.description }), `${body.name} created.`)
          }
        />
      )}

      <ConfirmDialog
        open={Boolean(removing)}
        onClose={() => setRemoving(null)}
        onConfirm={() =>
          removing &&
          void run(() => portalApi.deleteBranch(communityId, removing.id), `${removing.name} deleted.`)
        }
        title={`Delete ${removing?.name ?? ''}?`}
        body={`Its ${removing?.memberCount ?? 0} member${removing?.memberCount === 1 ? '' : 's'} return to unassigned — their membership, savings and history are untouched.`}
        confirmLabel="Delete branch"
        tone="danger"
        loading={busy}
      />

      {assigning && (
        <AssignMembersModal
          communityId={communityId}
          branch={assigning}
          busy={busy}
          error={error}
          onClose={() => setAssigning(null)}
          onSave={(memberIds) =>
            void run(
              () => portalApi.assignBranchMembers(communityId, { memberIds, branchId: assigning.id }),
              `Members moved to ${assigning.name}.`,
            )
          }
        />
      )}

      {roster && (
        <RosterModal communityId={communityId} branch={roster} onClose={() => setRoster(null)} />
      )}
    </div>
  );
}

function BranchFormModal({
  branch,
  busy,
  error,
  onClose,
  onSave,
}: {
  branch: CommunityBranch | null;
  busy: boolean;
  error: string;
  onClose: () => void;
  onSave: (body: { name?: string; description?: string }) => void;
}) {
  const [name, setName] = useState(branch?.name ?? '');
  const [description, setDescription] = useState(branch?.description ?? '');
  const valid = name.trim().length >= 2;

  return (
    <Modal
      open
      onClose={onClose}
      title={branch ? `Edit ${branch.name}` : 'New branch'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant="blue"
            loading={busy}
            disabled={!valid}
            onClick={() => onSave({ name: name.trim(), description: description.trim() })}
          >
            {branch ? 'Save changes' : 'Create branch'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && <Callout tone="danger">{error}</Callout>}
        <Field label="Name" htmlFor="br-name" required>
          <Input
            id="br-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ikeja branch"
            autoFocus
          />
        </Field>
        <Field label="Description" htmlFor="br-desc" optional>
          <Input
            id="br-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Meets every second Saturday at the Ikeja hall"
          />
        </Field>
      </div>
    </Modal>
  );
}

/**
 * Pick members for a branch. The list is every active member; those already
 * in this branch are pre-ticked, so saving is "this is the branch's roster
 * among the people I touched" — unticked members are not moved anywhere.
 */
function AssignMembersModal({
  communityId,
  branch,
  busy,
  error,
  onClose,
  onSave,
}: {
  communityId: string;
  branch: CommunityBranch;
  busy: boolean;
  error: string;
  onClose: () => void;
  onSave: (memberIds: string[]) => void;
}) {
  const { data: members } = useQuery<MemberRow[]>(
    () => portalApi.members(communityId),
    [communityId],
  );
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<Set<string>>(new Set());

  const filtered = (members ?? []).filter((member) =>
    member.name.toLowerCase().includes(query.trim().toLowerCase()),
  );

  const toggle = (id: string) =>
    setPicked((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <Modal
      open
      onClose={onClose}
      title={`Assign members to ${branch.name}`}
      description="Picked members move into this branch — wherever they were before."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant="blue"
            loading={busy}
            disabled={picked.size === 0}
            onClick={() => onSave([...picked])}
          >
            Move {picked.size || ''} member{picked.size === 1 ? '' : 's'}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {error && <Callout tone="danger">{error}</Callout>}
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search members…"
        />
        <ul className="max-h-72 space-y-1 overflow-y-auto">
          {!members && <Skeleton className="h-20" />}
          {filtered.map((member) => (
            <li key={member.id}>
              <label className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-slate-50">
                <input
                  type="checkbox"
                  checked={picked.has(member.id)}
                  onChange={() => toggle(member.id)}
                  className="h-4 w-4 rounded border-slate-300"
                />
                <span className="min-w-0 flex-1 truncate text-sm text-navy-900">{member.name}</span>
                {member.memberCode && (
                  <span className="tnum text-[11px] text-slate-400">{member.memberCode}</span>
                )}
              </label>
            </li>
          ))}
          {members && filtered.length === 0 && (
            <li className="px-2 py-4 text-center text-sm text-slate-500">No members match.</li>
          )}
        </ul>
      </div>
    </Modal>
  );
}

function RosterModal({
  communityId,
  branch,
  onClose,
}: {
  communityId: string;
  branch: CommunityBranch;
  onClose: () => void;
}) {
  const { data: rows } = useQuery<BranchMemberRow[]>(
    () => portalApi.branchMembers(communityId, branch.id),
    [communityId, branch.id],
  );

  return (
    <Modal open onClose={onClose} title={`${branch.name} — members`}>
      {!rows ? (
        <Skeleton className="h-24" />
      ) : rows.length === 0 ? (
        <p className="py-4 text-center text-sm text-slate-500">Nobody is in this branch yet.</p>
      ) : (
        <ul className="max-h-80 space-y-1 overflow-y-auto">
          {rows.map((row) => (
            <li key={row.id} className="flex items-center gap-3 rounded-lg px-2 py-1.5">
              <span className="min-w-0 flex-1 truncate text-sm text-navy-900">{row.name}</span>
              {row.memberCode && (
                <span className="tnum text-[11px] text-slate-400">{row.memberCode}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
