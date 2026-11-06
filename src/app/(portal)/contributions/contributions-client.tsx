'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { ArrowRight, CalendarDays, Check, Plus, RefreshCw, UserPlus, Users } from 'lucide-react';
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
  const [reviewingGroup, setReviewingGroup] = useState<CommunityGroupRow | null>(null);
  const [query, setQuery] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [status, setStatus] = useState('all');

  const { data, refresh } = useQuery<CommunityGroupRow[]>(
    () => portalApi.communityAjoGroups(community!.id),
    [community!.id],
    { initial },
  );

  const groups = data ?? [];
  const active = groups.filter((g) => g.status === 'ACTIVE');
  const visibleGroups = groups.filter((group) => {
    const start = group.startDate.slice(0, 10);
    return (
      (!query.trim() || group.name.toLowerCase().includes(query.trim().toLowerCase())) &&
      (status === 'all' || group.status === status) &&
      (!fromDate || start >= fromDate) &&
      (!toDate || start <= toDate)
    );
  });
  const statuses = [...new Set(groups.map((group) => group.status))];
  const perRound = sumMoney(
    active.map((g) => String(Number(g.contributionAmount) * g.memberCount)),
  );

  return (
    <>
      <PageHeader
        title="Contributions & Ajo"
        subtitle="Rotating savings groups this community runs"
        actions={
          <Link href={'/contributions/new' as Route}><Button icon={<Plus className="h-4 w-4" />}>New Ajo group</Button></Link>
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
              action={<Link href={'/contributions/new' as Route}><Button>Create a group</Button></Link>}
            />
          </Card>
        ) : (
          <>
            <Card className="lg:col-span-2">
              <div className="grid gap-3 p-4 md:grid-cols-[minmax(0,1fr)_10rem_10rem_10rem]">
                <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search Ajo groups" aria-label="Search Ajo groups" />
                <Input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} aria-label="Groups starting from" />
                <Input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} aria-label="Groups starting until" />
                <Select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Filter groups by status">
                  <option value="all">All statuses</option>
                  {statuses.map((value) => <option key={value} value={value}>{humanise(value)}</option>)}
                </Select>
              </div>
              <div className="flex items-center gap-2 border-t border-slate-100 px-4 py-2.5 text-xs text-slate-500">
                <CalendarDays className="h-3.5 w-3.5" /> Dates filter by each group&apos;s start date · {visibleGroups.length} shown
              </div>
            </Card>
            {visibleGroups.length === 0 ? (
              <Card className="lg:col-span-2"><EmptyState compact title="No groups match these filters" body="Try a different name, status, or date range." /></Card>
            ) : visibleGroups.map((g) => (
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
            ))}
          </>
        )}
      </div>

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

export function CreateGroupForm() {
  const { community } = useSession();
  const router = useRouter();
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
  const [feeModel, setFeeModel] = useState<'FREE' | 'CONTRIBUTION_MARKUP' | 'PAYOUT_DEDUCTION'>('FREE');
  const [feePercent, setFeePercent] = useState('');
  const [lateFeePercent, setLateFeePercent] = useState('');
  const [postPayoutLateFeePercent, setPostPayoutLateFeePercent] = useState('');

  const create = useMutation(
    () =>
      portalApi.createAjoGroup({
        name: name.trim(),
        description: description.trim() || undefined,
        // A group created from the portal belongs to the community, which is
        // what makes its pool and fees the cooperative's rather than a
        // single organiser's.
        type: 'COOPERATIVE',
        communityId: community!.id,
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
        communityFeePolicy: {
          model: feeModel,
          feePercent: feeModel === 'FREE' ? '0' : feePercent,
          lateFeePercent: lateFeePercent || '0',
          postPayoutLateFeePercent: postPayoutLateFeePercent || '0',
          revenueRecipient: 'COMMUNITY',
        },
        rules,
      }),
    {
      onSuccess: async () => {
        toast('Group created', 'success', 'Invite members and open the first cycle.');
        setName('');
        setDescription('');
        setContributionAmount('');
        setStartDate('');
        router.push('/contributions' as Route);
      },
      onError: (message) => toast('Could not create the group', 'error', message),
    },
  );

  const valid =
    name.trim().length > 2 &&
    Number(contributionAmount) > 0 &&
    Number(memberLimit) >= 2 &&
    Boolean(startDate) &&
    (feeModel === 'FREE' || (Number(feePercent) > 0 && Number(feePercent) <= 100)) &&
    Number(lateFeePercent || 0) >= 0 && Number(lateFeePercent || 0) <= 100 &&
    Number(postPayoutLateFeePercent || 0) >= Number(lateFeePercent || 0) && Number(postPayoutLateFeePercent || 0) <= 100 &&
    Object.values(rules).every((r) => r.trim().length > 0);

  return (
    <>
      <PageHeader title="Create a new Ajo group" subtitle="Take your time. Set how members contribute, how payouts work, and the rules everyone will see." breadcrumb={<Link href="/contributions" className="text-base hover:text-navy-900">Contributions & Ajo</Link>} actions={<Link href="/contributions"><Button variant="secondary" size="lg">Cancel</Button></Link>} />
      <div className="mx-auto max-w-4xl space-y-6 [&_.input]:min-h-12 [&_.input]:text-base [&_.label]:text-base [&_.label]:font-semibold [&_textarea]:text-base">
      <Card className="p-5 sm:p-8"><div className="space-y-7">
        {create.error && <Callout tone="danger">{create.error}</Callout>}

        <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-5 sm:p-6"><div className="mb-5"><h2 className="text-lg font-semibold text-navy-900">1. Name your group</h2><p className="mt-1 text-base leading-relaxed text-slate-600">Use a name members will recognise easily.</p></div>
        <Field label="Group name" htmlFor="ag-name" required>
          <Input
            id="ag-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Monthly traders' Ajo"
          />
        </Field>

        <Field label="Short description" htmlFor="ag-desc" optional>
          <Textarea
            id="ag-desc"
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Who this group is for"
          />
        </Field></div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6"><div className="mb-5"><h2 className="text-lg font-semibold text-navy-900">2. Set the contribution</h2><p className="mt-1 text-base leading-relaxed text-slate-600">Choose what each member pays and how often.</p></div><div className={`grid gap-5 ${frequency === 'CUSTOM' ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
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

        <div className="mt-5 grid gap-5 sm:grid-cols-2">
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
        </div></div>

        <div className="rounded-2xl border border-violet-100 bg-violet-50/40 p-5 sm:p-6">
          <h2 className="text-lg font-semibold text-navy-900">3. Choose the payout order</h2>
          <p className="mb-4 mt-1 text-base leading-relaxed text-slate-600">Tell members clearly how their payout position will be decided.</p>
          <div className="grid gap-2">
            {SELECTION_MODES.map((m) => (
              <RadioCard
                key={m.value}
                selected={payoutSelectionMode === m.value}
                onSelect={() => setPayoutSelectionMode(m.value)}
                title={m.label}
                description={m.hint}
                className="p-5 [&_span]:text-base [&_span>span:last-child]:text-[15px]"
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

        <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-5 sm:p-6">
          <h2 className="text-lg font-semibold text-navy-900">4. Community charges and late payments</h2>
          <p className="mb-4 mt-1 text-base leading-relaxed text-slate-700">Members will see this policy before joining and must accept it. All charges are community revenue.</p>
          <div className="grid gap-2">
            <RadioCard selected={feeModel === 'FREE'} onSelect={() => setFeeModel('FREE')} title="Run this group free" description="Members pay only their contribution; the full collected pool is available for payout." className="p-5 [&_span]:text-base [&_span>span:last-child]:text-[15px]" />
            <RadioCard selected={feeModel === 'CONTRIBUTION_MARKUP'} onSelect={() => setFeeModel('CONTRIBUTION_MARKUP')} title="Add a charge to each contribution" description="For example, 0.5% makes a ₦1,000 contribution cost ₦1,005. The charge is community revenue." className="p-5 [&_span]:text-base [&_span>span:last-child]:text-[15px]" />
            <RadioCard selected={feeModel === 'PAYOUT_DEDUCTION'} onSelect={() => setFeeModel('PAYOUT_DEDUCTION')} title="Deduct a charge from each payout" description="Members pay the contribution amount; the community charge is deducted from the round payout." className="p-5 [&_span]:text-base [&_span>span:last-child]:text-[15px]" />
          </div>
          {feeModel !== 'FREE' && <div className="mt-3"><Field label={feeModel === 'CONTRIBUTION_MARKUP' ? 'Contribution charge' : 'Payout deduction'} htmlFor="ag-fee" required><Input id="ag-fee" value={feePercent} onChange={(e) => setFeePercent(e.target.value)} inputMode="decimal" suffix="%" placeholder="0.5" /></Field></div>}
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label="Late-payment charge" htmlFor="ag-late" hint="Percentage of the contribution, after its deadline."><Input id="ag-late" value={lateFeePercent} onChange={(e) => setLateFeePercent(e.target.value)} inputMode="decimal" suffix="%" placeholder="0" /></Field>
            <Field label="Late charge after payout" htmlFor="ag-late-paid" hint="Higher rate for a member who has already received a payout."><Input id="ag-late-paid" value={postPayoutLateFeePercent} onChange={(e) => setPostPayoutLateFeePercent(e.target.value)} inputMode="decimal" suffix="%" placeholder="0" /></Field>
          </div>
          {feeModel !== 'FREE' || Number(lateFeePercent) > 0 ? <Callout tone="info" className="mt-3">{feeModel === 'CONTRIBUTION_MARKUP' ? `Each member pays their contribution plus ${feePercent || '0'}%.` : feeModel === 'PAYOUT_DEDUCTION' ? `${feePercent || '0'}% is deducted from each round payout.` : 'No community charge is added to standard contributions.'} Late charges are community revenue{Number(postPayoutLateFeePercent) > 0 ? ` and rise to ${postPayoutLateFeePercent}% after payout` : ''}.</Callout> : null}
        </div>

        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/40 p-5 sm:p-6">
          <h2 className="text-lg font-semibold text-navy-900">5. Member rules</h2>
          <p className="mb-4 mt-1 text-base leading-relaxed text-slate-600">
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
      </div></Card>
      <div className="sticky bottom-3 flex flex-wrap justify-end gap-3 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur"><Link href="/contributions"><Button variant="secondary" size="lg">Cancel</Button></Link><Button size="lg" disabled={!valid} loading={create.pending} onClick={() => void create.run()}>Create group</Button></div>
      </div>
    </>
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
