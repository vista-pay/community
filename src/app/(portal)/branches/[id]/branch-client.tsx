'use client';

/**
 * One branch, end to end: its settings, who runs it, and who belongs to it.
 *
 * The leadership panel is the point of the screen. A branch seat is a
 * community role bounded to this branch — the role supplies the permissions
 * and the branch limits where they apply — so appointing a manager here gives
 * them authority over this chapter and none at all over any other. That is
 * why the appoint dialog asks for a role rather than offering a fixed list of
 * branch titles: what a branch manager may do stays the community's decision,
 * editable on Staff & roles.
 *
 * `canManage` comes from the API, which already knows whether the viewer
 * holds this branch or the whole community. The page shows the same
 * information to every officer and offers the controls only to those who can
 * use them, rather than presenting buttons that 403.
 */

import { useCallback, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Building2,
  CalendarClock,
  History,
  Mail,
  MapPin,
  Phone,
  Plus,
  ShieldCheck,
  UserMinus,
  Users,
} from 'lucide-react';
import { useSession } from '@/components/providers/session-provider';
import { useToast } from '@/components/providers/toast-provider';
import { useQuery } from '@/hooks/use-query';
import { portalApi } from '@/services/portal';
import {
  Badge,
  Button,
  Callout,
  Card,
  CardHeader,
  Checkbox,
  ConfirmDialog,
  Field,
  Input,
  Modal,
  PageHeader,
  Select,
  Skeleton,
  Textarea,
} from '@/components/ui';
import { cn, money } from '@/lib/format';
import type {
  BranchDetail,
  BranchLoanRow,
  BranchMemberRow,
  BranchReport,
  BranchPost,
  BranchSeat,
  MemberRow,
} from '@/types';

const date = (iso: string) =>
  new Intl.DateTimeFormat('en-NG', { dateStyle: 'medium' }).format(new Date(iso));

export function BranchClient({ initial, branchId }: { initial: BranchDetail; branchId: string }) {
  const { community } = useSession();
  const { toast } = useToast();
  const communityId = community?.id ?? '';

  const { data: branch, refresh } = useQuery<BranchDetail | null>(
    () => (communityId ? portalApi.branch(communityId, branchId) : Promise.resolve(null)),
    [communityId, branchId],
    { initial, enabled: Boolean(communityId) },
  );

  const [appointing, setAppointing] = useState<BranchPost | null>(null);
  const [ending, setEnding] = useState<BranchSeat | null>(null);
  const [editing, setEditing] = useState(false);
  const [closing, setClosing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const run = useCallback(
    async (action: () => Promise<unknown>, done: string) => {
      setBusy(true);
      setError('');
      try {
        await action();
        toast(done);
        setAppointing(null);
        setEnding(null);
        setEditing(false);
        setClosing(false);
        await refresh();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'That did not save.');
      } finally {
        setBusy(false);
      }
    },
    [refresh, toast],
  );

  if (!branch) return <Skeleton className="h-64" />;
  const { canManage } = branch;

  return (
    <div>
      <Link
        href="/branches"
        className="focus-ring mb-2 inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[13px] font-semibold text-brand-700 hover:bg-brand-50"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> All branches
      </Link>

      <PageHeader
        title={branch.name}
        subtitle={
          [
            branch.code,
            [branch.lga, branch.city, branch.state].filter(Boolean).join(', ') || null,
            `${branch.memberCount} member${branch.memberCount === 1 ? '' : 's'}`,
          ]
            .filter(Boolean)
            .join(' · ')
        }
        actions={
          canManage ? (
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => { setError(''); setEditing(true); }}>
                Branch settings
              </Button>
              {branch.isActive ? (
                <Button variant="ghost" onClick={() => setClosing(true)}>
                  Close branch
                </Button>
              ) : (
                <Button
                  variant="blue"
                  onClick={() => void run(
                    () => portalApi.updateBranch(communityId, branch.id, { isActive: true }),
                    `${branch.name} reopened.`,
                  )}
                >
                  Reopen branch
                </Button>
              )}
            </div>
          ) : undefined
        }
      />

      {!branch.isActive && (
        <Callout tone="warning" title="This branch is closed" className="mb-5">
          Its {branch.memberCount} member{branch.memberCount === 1 ? '' : 's'} and its leadership are
          untouched — a closed branch simply stops being offered when members are assigned. Reopen it
          to use it again.
        </Callout>
      )}

      {!canManage && (
        <Callout tone="info" className="mb-5">
          You can see this branch because you are an officer of the community. Changing it is for its
          own manager, or for an officer with community-wide authority.
        </Callout>
      )}

      {error && !editing && !appointing && (
        <Callout tone="danger" className="mb-5">
          {error}
        </Callout>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-5">
          {/* ── Leadership ─────────────────────────────────────────────── */}
          <Card>
            <CardHeader
              title="Branch manager"
              subtitle="One at a time — appointing a replacement hands the branch over"
              action={
                canManage && (
                  <Button size="sm" variant={branch.manager ? 'secondary' : 'blue'} onClick={() => { setError(''); setAppointing('MANAGER'); }}>
                    {branch.manager ? 'Replace' : <><Plus className="h-3.5 w-3.5" aria-hidden /> Appoint</>}
                  </Button>
                )
              }
            />
            <div className="px-5 pb-5">
              {branch.manager ? (
                <SeatRow
                  seat={branch.manager}
                  canManage={canManage}
                  onEnd={() => setEnding(branch.manager)}
                />
              ) : (
                <p className="rounded-xl bg-amber-50 p-3 text-[13px] leading-relaxed text-amber-900">
                  Nobody runs this branch yet. Until a manager is appointed, only officers with
                  community-wide authority can change its roster or its settings.
                </p>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader
              title={`Branch staff (${branch.staff.length})`}
              subtitle="Seats bounded to this branch — the role decides what each one may do"
              action={
                canManage && (
                  <Button size="sm" variant="secondary" onClick={() => { setError(''); setAppointing('STAFF'); }}>
                    <Plus className="h-3.5 w-3.5" aria-hidden /> Add staff
                  </Button>
                )
              }
            />
            <div className="space-y-3 px-5 pb-5">
              {branch.staff.map((seat) => (
                <SeatRow key={seat.id} seat={seat} canManage={canManage} onEnd={() => setEnding(seat)} />
              ))}
              {!branch.staff.length && (
                <p className="text-[13px] text-slate-500">
                  No branch staff yet. A collections clerk or branch secretary seated here can work
                  this branch&rsquo;s roster without being given the run of the whole community.
                </p>
              )}
              <p className="flex items-start gap-2 rounded-xl bg-slate-50 p-3 text-[13px] leading-relaxed text-slate-600">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" aria-hidden />
                <span>
                  A branch seat carries its role&rsquo;s permissions <b>inside this branch only</b>.
                  To change what a seat may do, edit the role on{' '}
                  <Link href="/staff" className="font-semibold text-brand-700 hover:underline">
                    Staff &amp; roles
                  </Link>
                  .
                </span>
              </p>
            </div>
          </Card>

          <BranchPerformancePanel communityId={communityId} branch={branch} />

          <BranchLoansPanel communityId={communityId} branch={branch} />

          <BranchRoster communityId={communityId} branch={branch} />

          {branch.past.length > 0 && (
            <Card>
              <CardHeader
                title="Handover history"
                subtitle="Seats that have ended, and why"
                action={<History className="h-4 w-4 text-slate-400" aria-hidden />}
              />
              <div className="space-y-2.5 px-5 pb-5">
                {branch.past.map((seat) => (
                  <p key={seat.id} className="text-[13px] leading-relaxed text-slate-600">
                    <b className="text-navy-900">{seat.name}</b> — {seat.title}
                    {seat.post === 'MANAGER' ? ' (manager)' : ''}, {date(seat.appointedAt)} to{' '}
                    {seat.endedAt ? date(seat.endedAt) : '—'}
                    {seat.endReason && <span className="block text-slate-500">{seat.endReason}</span>}
                  </p>
                ))}
              </div>
            </Card>
          )}
        </div>

        {/* ── Settings, read-only until Branch settings is opened ───────── */}
        <aside className="space-y-5">
          <Card>
            <CardHeader title="Branch details" />
            <dl className="space-y-3 px-5 pb-5 text-sm">
              <Detail icon={<Building2 className="h-4 w-4" />} label="Code" value={branch.code} />
              <Detail icon={<MapPin className="h-4 w-4" />} label="Address" value={[branch.address, branch.lga, branch.city, branch.state].filter(Boolean).join(', ')} />
              <Detail icon={<Phone className="h-4 w-4" />} label="Phone" value={branch.phone} />
              <Detail icon={<Mail className="h-4 w-4" />} label="Email" value={branch.email} />
              <Detail icon={<CalendarClock className="h-4 w-4" />} label="Meets" value={branch.meetingSchedule} />
              <Detail icon={<Users className="h-4 w-4" />} label="Members" value={`${branch.memberCount}`} />
            </dl>
            {branch.description && (
              <p className="border-t border-slate-100 px-5 py-4 text-[13px] leading-relaxed text-slate-600">
                {branch.description}
              </p>
            )}
          </Card>
        </aside>
      </div>

      {editing && (
        <BranchSettingsModal
          branch={branch}
          busy={busy}
          error={error}
          onClose={() => setEditing(false)}
          onSave={(body) => void run(() => portalApi.updateBranch(communityId, branch.id, body), 'Branch settings saved.')}
        />
      )}

      {appointing && (
        <AppointModal
          communityId={communityId}
          branch={branch}
          post={appointing}
          busy={busy}
          error={error}
          onClose={() => setAppointing(null)}
          onSave={(body) =>
            void run(
              () => portalApi.appointBranchOfficer(communityId, branch.id, body),
              body.post === 'MANAGER' ? `${branch.name} has a new manager.` : 'Branch staff appointed.',
            )
          }
        />
      )}

      {ending && (
        <EndSeatModal
          seat={ending}
          branchName={branch.name}
          busy={busy}
          error={error}
          onClose={() => setEnding(null)}
          onSave={(reason) =>
            void run(
              () => portalApi.endBranchOfficer(communityId, branch.id, ending.id, reason),
              `${ending.name} has stood down.`,
            )
          }
        />
      )}

      <ConfirmDialog
        open={closing}
        onClose={() => setClosing(false)}
        onConfirm={() =>
          void run(
            () => portalApi.updateBranch(communityId, branch.id, { isActive: false }),
            `${branch.name} closed.`,
          )
        }
        title={`Close ${branch.name}?`}
        body="Its roster, its leadership and its history all stay. The branch simply stops being offered when members are assigned, and can be reopened at any time. To scatter the roster back to unassigned instead, delete the branch from the branches list."
        confirmLabel="Close branch"
        loading={busy}
      />
    </div>
  );
}

function Detail({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | null }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 text-slate-400" aria-hidden>{icon}</span>
      <span className="min-w-0 flex-1">
        <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</dt>
        <dd className="break-words text-navy-900">{value || <span className="text-slate-400">Not recorded</span>}</dd>
      </span>
    </div>
  );
}

function SeatRow({
  seat,
  canManage,
  onEnd,
}: {
  seat: BranchSeat;
  canManage: boolean;
  onEnd: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 p-3.5">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-navy-900 text-xs font-semibold text-white">
        {seat.name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase()}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-1.5">
          <b className="text-navy-900">{seat.name}</b>
          <Badge tone={seat.post === 'MANAGER' ? 'blue' : 'slate'}>{seat.title}</Badge>
          {/* A paused officer still holds the seat; nothing they attempt will
              work, and the branch is entitled to know that is why. */}
          {seat.powersPaused && <Badge tone="red">Powers paused</Badge>}
          {!seat.belongsToBranch && <Badge tone="amber">Not a member of this branch</Badge>}
        </span>
        <span className="mt-0.5 block text-[13px] text-slate-500">
          {seat.role.label} · appointed {date(seat.appointedAt)}
          {seat.memberCode ? ` · ${seat.memberCode}` : ''}
        </span>
      </span>
      {canManage && (
        <Button size="sm" variant="ghost" onClick={onEnd}>
          <UserMinus className="h-3.5 w-3.5 text-red-600" aria-hidden /> Stand down
        </Button>
      )}
    </div>
  );
}

/** This branch's roster, with assignment in and out. */
function BranchRoster({ communityId, branch }: { communityId: string; branch: BranchDetail }) {
  const { toast } = useToast();
  const { data: rows, refresh } = useQuery<BranchMemberRow[]>(
    () => portalApi.branchMembers(communityId, branch.id),
    [communityId, branch.id],
  );
  const [assigning, setAssigning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function save(memberIds: string[], into: boolean) {
    setBusy(true);
    setError('');
    try {
      await portalApi.assignBranchMembers(communityId, {
        memberIds,
        branchId: into ? branch.id : null,
      });
      toast(into ? `Members moved to ${branch.name}.` : 'Members unassigned.');
      setAssigning(false);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'That did not save.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader
        title={`Members (${rows?.length ?? branch.memberCount})`}
        subtitle="Who belongs to this chapter"
        action={
          branch.canManage && (
            <Button size="sm" variant="secondary" onClick={() => { setError(''); setAssigning(true); }}>
              Assign members
            </Button>
          )
        }
      />
      <div className="px-5 pb-5">
        {error && <Callout tone="danger" className="mb-3">{error}</Callout>}
        {!rows ? (
          <Skeleton className="h-20" />
        ) : rows.length === 0 ? (
          <p className="text-[13px] text-slate-500">Nobody is in this branch yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {rows.map((row) => (
              <li key={row.id} className="flex flex-wrap items-center gap-2 py-2.5">
                <span className="min-w-0 flex-1 truncate text-sm text-navy-900">{row.name}</span>
                {row.branchPost && (
                  <Badge tone={row.branchPost === 'MANAGER' ? 'blue' : 'slate'}>
                    {row.branchPost === 'MANAGER' ? 'Manager' : 'Staff'}
                  </Badge>
                )}
                <span className="text-[13px] text-slate-500">{row.role}</span>
                {row.memberCode && <span className="tnum text-[11px] text-slate-400">{row.memberCode}</span>}
                {branch.canManage && (
                  <Button size="sm" variant="ghost" onClick={() => void save([row.id], false)} disabled={busy}>
                    Remove
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {assigning && (
        <PickMembersModal
          communityId={communityId}
          branchName={branch.name}
          busy={busy}
          error={error}
          onClose={() => setAssigning(false)}
          onSave={(ids) => void save(ids, true)}
        />
      )}
    </Card>
  );
}

function BranchSettingsModal({
  branch,
  busy,
  error,
  onClose,
  onSave,
}: {
  branch: BranchDetail;
  busy: boolean;
  error: string;
  onClose: () => void;
  onSave: (body: Record<string, string | boolean>) => void;
}) {
  const [form, setForm] = useState({
    name: branch.name,
    code: branch.code ?? '',
    description: branch.description ?? '',
    phone: branch.phone ?? '',
    email: branch.email ?? '',
    address: branch.address ?? '',
    city: branch.city ?? '',
    state: branch.state ?? '',
    lga: branch.lga ?? '',
    meetingSchedule: branch.meetingSchedule ?? '',
  });
  const set = (key: keyof typeof form) => (value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  return (
    <Modal
      open
      onClose={onClose}
      title={`${branch.name} — settings`}
      description="Everything here describes the branch itself. Who runs it is on the leadership panel."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button variant="blue" loading={busy} disabled={form.name.trim().length < 2} onClick={() => onSave(form)}>
            Save settings
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && <Callout tone="danger">{error}</Callout>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" htmlFor="b-name" required>
            <Input id="b-name" value={form.name} onChange={(e) => set('name')(e.target.value)} />
          </Field>
          <Field label="Code" htmlFor="b-code" optional hint="Your own short reference — IKJ, BR-02.">
            <Input id="b-code" value={form.code} onChange={(e) => set('code')(e.target.value)} placeholder="IKJ" />
          </Field>
          <Field label="Phone" htmlFor="b-phone" optional>
            <Input id="b-phone" value={form.phone} onChange={(e) => set('phone')(e.target.value)} placeholder="+234…" />
          </Field>
          <Field label="Email" htmlFor="b-email" optional>
            <Input id="b-email" type="email" value={form.email} onChange={(e) => set('email')(e.target.value)} />
          </Field>
          <Field label="Address" htmlFor="b-address" optional className="sm:col-span-2">
            <Input id="b-address" value={form.address} onChange={(e) => set('address')(e.target.value)} placeholder="12 Allen Avenue" />
          </Field>
          <Field label="LGA" htmlFor="b-lga" optional>
            <Input id="b-lga" value={form.lga} onChange={(e) => set('lga')(e.target.value)} />
          </Field>
          <Field label="City" htmlFor="b-city" optional>
            <Input id="b-city" value={form.city} onChange={(e) => set('city')(e.target.value)} />
          </Field>
          <Field label="State" htmlFor="b-state" optional>
            <Input id="b-state" value={form.state} onChange={(e) => set('state')(e.target.value)} />
          </Field>
          <Field label="Meeting schedule" htmlFor="b-meets" optional className="sm:col-span-2">
            <Input
              id="b-meets"
              value={form.meetingSchedule}
              onChange={(e) => set('meetingSchedule')(e.target.value)}
              placeholder="Second Saturday of the month, 10am"
            />
          </Field>
          <Field label="Description" htmlFor="b-desc" optional className="sm:col-span-2">
            <Textarea id="b-desc" value={form.description} onChange={(e) => set('description')(e.target.value)} />
          </Field>
        </div>
      </div>
    </Modal>
  );
}

/**
 * Appoint a manager or staff member.
 *
 * Two pickers, both deliberate: the person, and the role that bounds what
 * they may do here. The role list is the community's own, so a cooperative
 * that wants a "Branch Manager" post with exactly the right permissions
 * creates it once on Staff & roles and reuses it at every branch.
 */
function AppointModal({
  communityId,
  branch,
  post,
  busy,
  error,
  onClose,
  onSave,
}: {
  communityId: string;
  branch: BranchDetail;
  post: BranchPost;
  busy: boolean;
  error: string;
  onClose: () => void;
  onSave: (body: {
    memberId: string;
    roleId: string;
    post: BranchPost;
    title?: string;
    moveMemberToBranch?: boolean;
  }) => void;
}) {
  const { data: members } = useQuery<MemberRow[]>(() => portalApi.members(communityId), [communityId]);

  const [query, setQuery] = useState('');
  const [memberId, setMemberId] = useState('');
  // Defaults to Branch manager / the first branch post, which is the answer
  // in almost every case. Before the branch posts existed this box opened on
  // "Choose a role…" above a list of community-wide offices, and the only way
  // to fill it was to pick one that meant something else.
  const branchPosts = branch.assignableRoles.filter((role) => role.isBranchRole);
  const preferred =
    branchPosts.find((role) => role.name === (post === 'MANAGER' ? 'BRANCH_MANAGER' : 'BRANCH_SECRETARY')) ??
    branchPosts[0];
  const [roleId, setRoleId] = useState(preferred?.id ?? '');
  const [title, setTitle] = useState('');
  const [move, setMove] = useState(true);

  const picked = (members ?? []).find((member) => member.id === memberId);
  const filtered = (members ?? []).filter((member) =>
    `${member.name} ${member.memberCode ?? ''}`.toLowerCase().includes(query.trim().toLowerCase()),
  );

  // The plain member role grants nothing, so a manager bounded by it could
  // not manage. The API refuses it; saying so here saves the round trip.
  const assignable = branch.assignableRoles.filter(
    (role) => post === 'STAFF' || role.name !== 'MEMBER',
  );
  const chosenRole = assignable.find((role) => role.id === roleId);
  const communityWide = assignable.filter((role) => !role.isBranchRole);

  return (
    <Modal
      open
      onClose={onClose}
      title={post === 'MANAGER' ? `Appoint a manager for ${branch.name}` : `Add staff to ${branch.name}`}
      description={
        post === 'MANAGER' && branch.manager
          ? `${branch.manager.name} currently manages this branch and will stand down when you save.`
          : 'The role decides what the seat may do; the branch decides where.'
      }
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button
            variant="blue"
            loading={busy}
            disabled={!memberId || !roleId}
            onClick={() =>
              onSave({
                memberId,
                roleId,
                post,
                ...(title.trim() ? { title: title.trim() } : {}),
                moveMemberToBranch: move,
              })
            }
          >
            {post === 'MANAGER' && branch.manager ? 'Hand the branch over' : 'Appoint'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && <Callout tone="danger">{error}</Callout>}

        <Field label="Who" htmlFor="ap-search" required hint="Any active member of the community.">
          <Input
            id="ap-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search members…"
          />
        </Field>
        <ul className="max-h-56 space-y-1 overflow-y-auto rounded-xl border border-slate-200 p-1">
          {!members && <Skeleton className="h-16" />}
          {filtered.map((member) => (
            <li key={member.id}>
              <label className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-slate-50">
                <input
                  type="radio"
                  name="appointee"
                  checked={memberId === member.id}
                  onChange={() => setMemberId(member.id)}
                  className="h-4 w-4"
                />
                <span className="min-w-0 flex-1 truncate text-sm text-navy-900">{member.name}</span>
                <span className="text-[13px] text-slate-500">{member.role}</span>
                {member.memberCode && <span className="tnum text-[11px] text-slate-400">{member.memberCode}</span>}
              </label>
            </li>
          ))}
          {members && filtered.length === 0 && (
            <li className="px-2 py-4 text-center text-sm text-slate-500">No members match.</li>
          )}
        </ul>

        <Field
          label="Role that bounds the seat"
          htmlFor="ap-role"
          required
          hint={
            chosenRole
              ? `${chosenRole.description ?? chosenRole.label} — inside ${branch.name} only.`
              : 'Branch posts are scoped to this chapter. A community-wide office can bound a seat too, and is still limited to this branch.'
          }
        >
          <Select id="ap-role" value={roleId} onChange={(e) => setRoleId(e.target.value)}>
            <option value="">Choose a role…</option>
            {/* Branch posts first and labelled as such. A community-wide
                office can still bound a seat — a treasurer running a branch
                is a real arrangement — but it should be the deliberate
                choice, not the only one on offer. */}
            {branchPosts.length > 0 && (
              <optgroup label="Branch posts">
                {branchPosts.map((role) => (
                  <option key={role.id} value={role.id}>{role.label}</option>
                ))}
              </optgroup>
            )}
            {communityWide.length > 0 && (
              <optgroup label="Community-wide posts (bounded to this branch)">
                {communityWide.map((role) => (
                  <option key={role.id} value={role.id}>{role.label}</option>
                ))}
              </optgroup>
            )}
          </Select>
        </Field>

        <Field label="Title at this branch" htmlFor="ap-title" optional hint="Defaults to the role's name.">
          <Input
            id="ap-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={post === 'MANAGER' ? 'Branch Manager' : 'Branch Secretary'}
          />
        </Field>

        {picked && (
          <Checkbox
            checked={move}
            onChange={setMove}
            label={`Also move ${picked.name} into ${branch.name}`}
            description="Off, their membership stays in whichever chapter they belong to now. A seat here does not require belonging here."
          />
        )}
      </div>
    </Modal>
  );
}

function EndSeatModal({
  seat,
  branchName,
  busy,
  error,
  onClose,
  onSave,
}: {
  seat: BranchSeat;
  branchName: string;
  busy: boolean;
  error: string;
  onClose: () => void;
  onSave: (reason: string) => void;
}) {
  const [reason, setReason] = useState('');
  return (
    <Modal
      open
      onClose={onClose}
      title={`Stand ${seat.name} down`}
      description={`They keep their membership, their branch and their community role. What ends is the authority ${branchName} gave them.`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button variant="danger" loading={busy} disabled={reason.trim().length < 5} onClick={() => onSave(reason.trim())}>
            Stand down
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && <Callout tone="danger">{error}</Callout>}
        <Field label="Reason" htmlFor="sd-reason" required hint="Kept on the seat and shown in the handover history.">
          <Textarea
            id="sd-reason"
            autoFocus
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="End of tenure, relocated, re-elected elsewhere…"
          />
        </Field>
      </div>
    </Modal>
  );
}

/** Tick several members to move into this branch at once. */
function PickMembersModal({
  communityId,
  branchName,
  busy,
  error,
  onClose,
  onSave,
}: {
  communityId: string;
  branchName: string;
  busy: boolean;
  error: string;
  onClose: () => void;
  onSave: (memberIds: string[]) => void;
}) {
  const { data: members } = useQuery<MemberRow[]>(() => portalApi.members(communityId), [communityId]);
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
      title={`Assign members to ${branchName}`}
      description="Picked members move into this branch — wherever they were before."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button variant="blue" loading={busy} disabled={picked.size === 0} onClick={() => onSave([...picked])}>
            Move {picked.size || ''} member{picked.size === 1 ? '' : 's'}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {error && <Callout tone="danger">{error}</Callout>}
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search members…" />
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
                {member.memberCode && <span className="tnum text-[11px] text-slate-400">{member.memberCode}</span>}
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

/**
 * What the branch has done, in the numbers the head office compares.
 *
 * Expected *and* collected, side by side: a collected total on its own cannot
 * say whether a branch is healthy, which is the question being asked. Money
 * figures are bounded by the period; headcounts and balances are as of now,
 * and the panel says so rather than leaving the reader to assume.
 */
function BranchPerformancePanel({
  communityId,
  branch,
}: {
  communityId: string;
  branch: BranchDetail;
}) {
  const { data: report } = useQuery<BranchReport | null>(
    () => portalApi.branchReport(communityId, branch.id),
    [communityId, branch.id],
  );

  if (!report) {
    return (
      <Card>
        <CardHeader title="Branch performance" />
        <div className="px-5 pb-5">
          <Skeleton className="h-24" />
        </div>
      </Card>
    );
  }

  const { contributions, savings, loans, expenses, members } = report;
  const rate = contributions.collectionRate;

  return (
    <Card>
      <CardHeader
        title="Branch performance"
        subtitle={`Money figures cover ${date(report.period.from)} – ${date(report.period.to)}; balances and headcount are as of now`}
      />
      <div className="grid gap-4 px-5 pb-5 sm:grid-cols-2 xl:grid-cols-4">
        <Figure
          label="Collected"
          value={money(contributions.collected)}
          hint={`of ${money(contributions.expected)} expected`}
          tone={rate >= 80 ? 'good' : rate >= 50 ? 'warn' : 'bad'}
          footer={`${rate}% collection rate`}
        />
        <Figure
          label="Outstanding"
          value={money(contributions.outstanding)}
          hint={`${contributions.overdue} overdue obligation${contributions.overdue === 1 ? '' : 's'}`}
          tone={contributions.overdue > 0 ? 'warn' : 'good'}
        />
        <Figure
          label="Savings held"
          value={money(savings.balance)}
          hint={`${savings.accounts} account${savings.accounts === 1 ? '' : 's'}`}
        />
        <Figure
          label="Loans outstanding"
          value={money(loans.outstanding)}
          hint={`${loans.live} running · ${loans.open} awaiting decision`}
          tone={loans.awaitingRecommendation > 0 ? 'warn' : undefined}
          footer={
            loans.awaitingRecommendation > 0
              ? `${loans.awaitingRecommendation} need your recommendation`
              : undefined
          }
        />
        <Figure
          label="Spending"
          value={money(expenses.paidTotal)}
          hint={`${expenses.pending} awaiting approval · ${expenses.approved} approved`}
        />
        <Figure
          label="Members"
          value={members.total.toLocaleString()}
          hint={`${members.officers} on the branch leadership`}
        />
      </div>
      <p className="border-t border-slate-100 px-5 py-3 text-[13px] leading-relaxed text-slate-500">
        These are the community&rsquo;s own records filtered to this branch, not a separate set of
        books — so the head office&rsquo;s totals and this page can never disagree.
      </p>
    </Card>
  );
}

function Figure({
  label,
  value,
  hint,
  footer,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  footer?: string;
  tone?: 'good' | 'warn' | 'bad';
}) {
  return (
    <div className="rounded-xl border border-slate-200 p-3.5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p
        className={cn(
          'tnum mt-1 text-lg font-semibold',
          tone === 'good' && 'text-emerald-700',
          tone === 'warn' && 'text-amber-700',
          tone === 'bad' && 'text-red-700',
          !tone && 'text-navy-900',
        )}
      >
        {value}
      </p>
      {hint && <p className="mt-0.5 text-[13px] text-slate-500">{hint}</p>}
      {footer && <p className="mt-1 text-[11px] font-semibold text-slate-500">{footer}</p>}
    </div>
  );
}

/**
 * The branch's say on its members' loans.
 *
 * A recommendation is advice attached to the application — it changes no
 * status and moves no money. The committee still decides, and sees what the
 * officer who knows the borrower wrote. Declining requires a reason, because
 * "not recommended" with no reason tells the committee nothing they can act
 * on.
 */
function BranchLoansPanel({
  communityId,
  branch,
}: {
  communityId: string;
  branch: BranchDetail;
}) {
  const { toast } = useToast();
  const { data: loans, refresh } = useQuery<BranchLoanRow[]>(
    () => portalApi.branchLoans(communityId, branch.id),
    [communityId, branch.id],
  );
  const [advising, setAdvising] = useState<{ loan: BranchLoanRow; recommend: boolean } | null>(null);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function save() {
    if (!advising) return;
    setBusy(true);
    setError('');
    try {
      await portalApi.recommendBranchLoan(communityId, branch.id, advising.loan.id, {
        recommend: advising.recommend,
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      });
      toast(advising.recommend ? 'Recommended to the committee.' : 'Recorded — not recommended.');
      setAdvising(null);
      setNotes('');
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'That did not save.');
    } finally {
      setBusy(false);
    }
  }

  const waiting = (loans ?? []).filter((loan) => loan.awaitingRecommendation);
  const rest = (loans ?? []).filter((loan) => !loan.awaitingRecommendation);

  return (
    <Card>
      <CardHeader
        title="Loan applications"
        subtitle="From this branch's members — the branch advises, the committee decides"
        action={
          waiting.length > 0 && <Badge tone="amber">{waiting.length} awaiting you</Badge>
        }
      />
      <div className="space-y-3 px-5 pb-5">
        {error && <Callout tone="danger">{error}</Callout>}
        {!loans && <Skeleton className="h-20" />}
        {loans && loans.length === 0 && (
          <p className="text-[13px] text-slate-500">
            Nobody in this branch has applied for a loan yet.
          </p>
        )}

        {[...waiting, ...rest].map((loan) => (
          <div key={loan.id} className="rounded-xl border border-slate-200 p-3.5">
            <div className="flex flex-wrap items-center gap-2">
              <b className="text-navy-900">{loan.borrower?.name ?? 'A member'}</b>
              <span className="tnum text-[13px] text-slate-600">
                {money(loan.principal, loan.currencyCode)}
              </span>
              <Badge tone={loan.status === 'REJECTED' ? 'red' : loan.status === 'SUBMITTED' ? 'amber' : 'slate'}>
                {loan.status.toLowerCase().replaceAll('_', ' ')}
              </Badge>
              {loan.recommendation && (
                <Badge tone={loan.recommendation === 'RECOMMENDED' ? 'green' : 'red'}>
                  {loan.recommendation === 'RECOMMENDED' ? 'Branch recommends' : 'Branch declined'}
                </Badge>
              )}
            </div>
            <p className="mt-1 text-[13px] text-slate-500">
              {loan.reference} · {loan.termDays} days · applied {date(loan.appliedAt)}
              {loan.purpose ? ` · ${loan.purpose}` : ''}
            </p>
            {loan.recommendationNotes && (
              <p className="mt-1.5 rounded-lg bg-slate-50 p-2.5 text-[13px] leading-relaxed text-slate-600">
                {loan.recommendationNotes}
              </p>
            )}
            {branch.canManage && loan.awaitingRecommendation && (
              <div className="mt-2.5 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="blue"
                  onClick={() => { setError(''); setNotes(''); setAdvising({ loan, recommend: true }); }}
                >
                  Recommend
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => { setError(''); setNotes(''); setAdvising({ loan, recommend: false }); }}
                >
                  Do not recommend
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>

      {advising && (
        <Modal
          open
          onClose={() => setAdvising(null)}
          title={
            advising.recommend
              ? `Recommend ${advising.loan.borrower?.name ?? 'this application'}`
              : `Do not recommend ${advising.loan.borrower?.name ?? 'this application'}`
          }
          description="This is advice to the committee. It changes nothing about the application on its own — they still decide, and they read what you write here."
          footer={
            <>
              <Button variant="ghost" onClick={() => setAdvising(null)} disabled={busy}>
                Cancel
              </Button>
              <Button
                variant={advising.recommend ? 'blue' : 'danger'}
                loading={busy}
                disabled={!advising.recommend && notes.trim().length === 0}
                onClick={() => void save()}
              >
                {advising.recommend ? 'Recommend' : 'Record'}
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            {error && <Callout tone="danger">{error}</Callout>}
            <Field
              label="What should the committee know?"
              htmlFor="rec-notes"
              required={!advising.recommend}
              optional={advising.recommend}
              hint="Attendance, contribution history, what the money is for — whatever the branch knows and the committee cannot see."
            >
              <Textarea
                id="rec-notes"
                autoFocus
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Known to the branch, contributions up to date…"
              />
            </Field>
          </div>
        </Modal>
      )}
    </Card>
  );
}
