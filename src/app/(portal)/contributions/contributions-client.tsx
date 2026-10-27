'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Check, Plus, RefreshCw, UserPlus, Users } from 'lucide-react';
import {
  AmountInput,
  Badge,
  Button,
  Callout,
  Card,
  EmptyState,
  Field,
  Input,
  Modal,
  PageHeader,
  RadioCard,
  Select,
  StatusBadge,
  Stat,
  Textarea,
} from '@/components/ui';
import { useMutation, useQuery } from '@/hooks/use-query';
import { useSession } from '@/components/providers/session-provider';
import { useToast } from '@/components/providers/toast-provider';
import { portalApi } from '@/services/portal';
import { humanise, money } from '@/lib/format';
import { sumMoney } from '@/lib/money';
import type { AjoJoinRequestRow, CommunityGroupRow } from '@/types';
import { InviteButton } from '@/components/ajo/invite-panel';

export function ContributionsClient({ initial }: { initial: CommunityGroupRow[] }) {
  const { community } = useSession();
  const [creating, setCreating] = useState(false);
  const [reviewingGroup, setReviewingGroup] = useState<CommunityGroupRow | null>(null);

  const { data, refresh } = useQuery<CommunityGroupRow[]>(
    () => portalApi.communityAjoGroups(community!.id),
    [community!.id],
    { initial },
  );

  const groups = data ?? [];
  const active = groups.filter((g) => g.status === 'ACTIVE');
  const perRound = sumMoney(
    active.map((g) => String(Number(g.contributionAmount) * g.memberCount)),
  );

  return (
    <>
      <PageHeader
        title="Contributions & Ajo"
        subtitle="Rotating savings groups this community runs"
        actions={
          <Button icon={<Plus className="h-4 w-4" />} onClick={() => setCreating(true)}>
            New Ajo group
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Groups" value={groups.length} icon={<RefreshCw className="h-4 w-4" />} />
        <Stat label="Running" value={active.length} icon={<Users className="h-4 w-4" />} />
        <Stat
          label="Collected per round"
          value={money(perRound)}
          hint="If every member pays on time"
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {groups.length === 0 ? (
          <Card className="lg:col-span-2">
            <EmptyState
              icon={<RefreshCw className="h-5 w-5" />}
              title="No Ajo groups yet"
              body="Create a rotating savings group and invite members to contribute each round."
              action={<Button onClick={() => setCreating(true)}>Create a group</Button>}
            />
          </Card>
        ) : (
          groups.map((g) => (
            <Card key={g.groupId}>
              <Link
                href={`/contributions/${g.groupId}`}
                className="block px-5 py-4 transition hover:bg-slate-50"
              >
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-semibold text-navy-900">{g.name}</p>
                    <p className="mt-0.5 text-[13px] text-slate-500">
                      {money(g.contributionAmount, g.currencyCode)} {humanise(g.frequency)} ·{' '}
                      {g.memberCount} of {g.memberLimit} members
                    </p>
                  </div>
                  <StatusBadge status={g.status.toLowerCase()} />
                  <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-slate-400" />
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Badge tone="slate">{humanise(g.payoutSelectionMode)}</Badge>
                  {g.activeCycle ? (
                    <Badge tone="slate">
                      Cycle {g.activeCycle.cycleNumber} · {g.activeCycle.totalPeriods} rounds
                    </Badge>
                  ) : (
                    <Badge tone="amber">No active cycle</Badge>
                  )}
                  {(g.pendingRequests ?? 0) > 0 && (
                    <Badge tone="red">{g.pendingRequests} join request{g.pendingRequests === 1 ? '' : 's'}</Badge>
                  )}
                </div>
              </Link>

              {/* Outside the Link: a group that is not yet full is usually
                  waiting on members, so sharing it is the next thing to do.
                  Only organizers get the code — the API withholds it from
                  members, so offering them the button would be a dead end. */}
              <div className="flex items-center gap-2 border-t border-slate-100 px-5 py-3">
                <span className="flex-1 text-xs text-slate-500">
                  {g.memberCount >= g.memberLimit
                    ? 'Every place taken'
                    : `${g.memberLimit - g.memberCount} place${g.memberLimit - g.memberCount === 1 ? '' : 's'} left`}
                </span>
                <Button
                  variant="secondary"
                  icon={<UserPlus className="h-4 w-4" />}
                  onClick={() => setReviewingGroup(g)}
                >
                  Join requests{(g.pendingRequests ?? 0) > 0 ? ` (${g.pendingRequests})` : ''}
                </Button>
                {g.invitationCode && (
                <InviteButton
                  groupId={g.groupId}
                  groupName={g.name}
                  invitationCode={g.invitationCode ?? null}
                  memberCount={g.memberCount}
                  memberLimit={g.memberLimit}
                />
                )}
              </div>
            </Card>
          ))
        )}
      </div>

      <CreateGroupModal
        open={creating}
        onClose={() => setCreating(false)}
        communityId={community!.id}
        onCreated={refresh}
      />

      {reviewingGroup && (
        <JoinRequestsModal
          group={reviewingGroup}
          onClose={() => setReviewingGroup(null)}
          onDecided={refresh}
        />
      )}
    </>
  );
}

/** The rules every member must see before they can join. */
const DEFAULT_RULES = {
  missedPayment: 'A missed contribution delays your payout turn by one period.',
  exit: 'Exiting mid-cycle forfeits your position; a replacement must be approved by the organizer.',
  cancellation: 'The group may be cancelled by unanimous consent; the pool is refunded pro rata.',
};

const SELECTION_MODES = [
  {
    value: 'RANDOM_DRAW',
    label: 'Random draw',
    hint: 'The server draws the order and publishes the result. Nobody can influence it.',
  },
  {
    value: 'MEMBER_SELECTED',
    label: 'Members choose',
    hint: 'Members claim a position; whatever is unclaimed by the deadline is assigned.',
  },
  {
    value: 'ADMIN_ASSIGNED',
    label: 'Organizer assigns',
    hint: 'You set the order yourself.',
  },
] as const;

function CreateGroupModal({
  open,
  onClose,
  communityId,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  communityId: string;
  onCreated: () => Promise<void>;
}) {
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [contributionAmount, setContributionAmount] = useState('');
  const [frequency, setFrequency] = useState('MONTHLY');
  const [customIntervalDays, setCustomIntervalDays] = useState('14');
  const [memberLimit, setMemberLimit] = useState('10');
  const [startDate, setStartDate] = useState('');
  const [payoutSelectionMode, setPayoutSelectionMode] = useState<string>('RANDOM_DRAW');
  const [selectionDeadline, setSelectionDeadline] = useState('');
  const [rules, setRules] = useState(DEFAULT_RULES);

  const create = useMutation(
    () =>
      portalApi.createAjoGroup({
        name: name.trim(),
        description: description.trim() || undefined,
        // A group created from the portal belongs to the community, which is
        // what makes its pool and fees the cooperative's rather than a
        // single organiser's.
        type: 'COOPERATIVE',
        communityId,
        contributionAmount,
        currencyCode: 'NGN',
        frequency,
        ...(frequency === 'CUSTOM' ? { customIntervalDays: Number(customIntervalDays) } : {}),
        memberLimit: Number(memberLimit),
        // Anchored to UTC midnight, not local midnight: east of Greenwich
        // the latter converts back to the previous calendar day, which would
        // move everybody's first contribution a day earlier than the date
        // the officer picked.
        startDate: new Date(`${startDate}T00:00:00.000Z`).toISOString(),
        payoutSelectionMode,
        ...(payoutSelectionMode === 'MEMBER_SELECTED' && selectionDeadline
          ? { selectionDeadline: new Date(`${selectionDeadline}T00:00:00.000Z`).toISOString() }
          : {}),
        rules,
      }),
    {
      onSuccess: async () => {
        toast('Group created', 'success', 'Invite members and open the first cycle.');
        setName('');
        setDescription('');
        setContributionAmount('');
        setStartDate('');
        onClose();
        await onCreated();
      },
      onError: (message) => toast('Could not create the group', 'error', message),
    },
  );

  const valid =
    name.trim().length > 2 &&
    Number(contributionAmount) > 0 &&
    Number(memberLimit) >= 2 &&
    Boolean(startDate) &&
    Object.values(rules).every((r) => r.trim().length > 0);

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="New Ajo group"
      description="Members see these terms before they can join, so they cannot be changed once a cycle is running."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!valid} loading={create.pending} onClick={() => void create.run()}>
            Create group
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {create.error && <Callout tone="danger">{create.error}</Callout>}

        <Field label="Name" htmlFor="ag-name" required>
          <Input
            id="ag-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Monthly traders' Ajo"
          />
        </Field>

        <Field label="Description" htmlFor="ag-desc" optional>
          <Textarea
            id="ag-desc"
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Who this group is for"
          />
        </Field>

        <div className={`grid gap-4 ${frequency === 'CUSTOM' ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
          <Field label="Amount per round" htmlFor="ag-amount" required>
            <AmountInput
              id="ag-amount"
              value={contributionAmount}
              onChange={setContributionAmount}
            />
          </Field>
          <Field label="Frequency" htmlFor="ag-freq" required>
            <Select id="ag-freq" value={frequency} onChange={(e) => setFrequency(e.target.value)}>
              <option value="DAILY">Daily</option>
              <option value="WEEKLY">Weekly</option>
              <option value="BIWEEKLY">Fortnightly</option>
              <option value="MONTHLY">Monthly</option>
              <option value="CUSTOM">Every N days</option>
            </Select>
          </Field>
          {frequency === 'CUSTOM' && (
            <Field label="Interval" htmlFor="ag-interval" required>
              <Input
                id="ag-interval"
                type="number"
                min="1"
                max="365"
                value={customIntervalDays}
                onChange={(e) => setCustomIntervalDays(e.target.value)}
                suffix="days"
              />
            </Field>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Members" htmlFor="ag-limit" required hint="One payout turn each">
            <Input
              id="ag-limit"
              type="number"
              min="2"
              max="500"
              value={memberLimit}
              onChange={(e) => setMemberLimit(e.target.value)}
            />
          </Field>
          <Field
            label="First contribution due"
            htmlFor="ag-start"
            required
            hint="Rounds are counted from this date"
          >
            <Input
              id="ag-start"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </Field>
        </div>

        <div>
          <p className="label">How the payout order is decided</p>
          <div className="grid gap-2">
            {SELECTION_MODES.map((m) => (
              <RadioCard
                key={m.value}
                selected={payoutSelectionMode === m.value}
                onSelect={() => setPayoutSelectionMode(m.value)}
                title={m.label}
                description={m.hint}
              />
            ))}
          </div>
        </div>

        {payoutSelectionMode === 'MEMBER_SELECTED' && (
          <Field
            label="Selection deadline"
            htmlFor="ag-deadline"
            optional
            hint="Positions still unclaimed after this are assigned automatically"
          >
            <Input
              id="ag-deadline"
              type="date"
              value={selectionDeadline}
              onChange={(e) => setSelectionDeadline(e.target.value)}
            />
          </Field>
        )}

        <div>
          <p className="label">Rules</p>
          <p className="mb-2 text-xs text-slate-500">
            Every member reads these and accepts them before joining. Edit them to match what
            your group actually agreed.
          </p>
          <div className="space-y-3">
            <Field label="If someone misses a payment" htmlFor="ag-r1" required>
              <Textarea
                id="ag-r1"
                rows={2}
                value={rules.missedPayment}
                onChange={(e) => setRules((r) => ({ ...r, missedPayment: e.target.value }))}
              />
            </Field>
            <Field label="If someone leaves mid-cycle" htmlFor="ag-r2" required>
              <Textarea
                id="ag-r2"
                rows={2}
                value={rules.exit}
                onChange={(e) => setRules((r) => ({ ...r, exit: e.target.value }))}
              />
            </Field>
            <Field label="If the group is cancelled" htmlFor="ag-r3" required>
              <Textarea
                id="ag-r3"
                rows={2}
                value={rules.cancellation}
                onChange={(e) => setRules((r) => ({ ...r, cancellation: e.target.value }))}
              />
            </Field>
          </div>
        </div>
      </div>
    </Modal>
  );
}

/** Members asked to join from the app; approval is what grants the seat. */
function JoinRequestsModal({
  group,
  onClose,
  onDecided,
}: {
  group: CommunityGroupRow;
  onClose: () => void;
  onDecided: () => Promise<void>;
}) {
  const { toast } = useToast();
  const { data, refresh } = useQuery(
    () => portalApi.ajoJoinRequests(group.groupId),
    [group.groupId],
  );

  const review = useMutation(
    ({ membershipId, approve }: { membershipId: string; approve: boolean }) =>
      portalApi.reviewAjoJoinRequest(group.groupId, membershipId, approve),
    {
      onSuccess: async () => {
        toast('Done', 'success', 'The member has been notified.');
        await Promise.all([refresh(), onDecided()]);
      },
      onError: (message) => toast('Could not action that request', 'error', message),
    },
  );

  const requests: AjoJoinRequestRow[] = data?.requests ?? [];

  return (
    <Modal
      open
      onClose={onClose}
      title={`Join requests — ${group.name}`}
      description={
        data ? `${data.spotsFilled} of ${data.memberLimit} seats filled` : 'Loading…'
      }
      footer={
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      }
    >
      <div className="space-y-3">
        {requests.length === 0 && (
          <p className="py-6 text-center text-sm text-slate-500">
            Nobody is waiting. Members join from the app under Contributions.
          </p>
        )}
        {requests.map((r) => (
          <div key={r.membershipId} className="rounded-xl border border-slate-200 p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-navy-900">{r.name}</p>
                <p className="text-xs text-slate-500">
                  {r.phone} · {r.acceptedRules ? 'accepted rules & fees' : 'rules not yet accepted'}
                </p>
              </div>
              <Badge tone={r.kycApproved || r.kycTier === 'TIER_2' || r.kycTier === 'TIER_3' ? 'green' : 'amber'}>
                {humanise(r.kycTier)}
              </Badge>
            </div>
            <div className="mt-3 flex gap-2">
              <Button
                variant="secondary"
                className="flex-1"
                disabled={review.pending}
                onClick={() => void review.run({ membershipId: r.membershipId, approve: false })}
              >
                Decline
              </Button>
              <Button
                className="flex-1"
                icon={<Check className="h-4 w-4" />}
                loading={review.pending}
                onClick={() => void review.run({ membershipId: r.membershipId, approve: true })}
              >
                Approve
              </Button>
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}
