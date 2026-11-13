'use client';

import { useState } from 'react';
import type { Route } from 'next';
import { AlertTriangle, BadgeCheck, CalendarClock, ChevronRight, Coins, IdCard, Plus, Search, Settings2, Users } from 'lucide-react';
import {
  Badge,
  Button,
  Callout,
  Card,
  CardHeader,
  DataTable,
  EmptyState,
  Field,
  Input,
  Modal,
  PageHeader,
  Select,
  Stat,
  Textarea,
  Toggle,
  LinkButton,
} from '@/components/ui';
import { MoneyOutOtpDialog, useMoneyOutOtp } from '@/components/money-out-otp';
import { useCommunityId } from '@/components/providers/session-provider';
import { useToast } from '@/components/providers/toast-provider';
import { useMutation, useQuery } from '@/hooks/use-query';
import { portalApi } from '@/services/portal';
import { date, humanise, money } from '@/lib/format';
import type { ChargeCollection, ChargeCollectionMember, DuesLeviesCollections, DuesLeviesOverview, LevyFrequency } from '@/types';

const FREQUENCIES: Array<{ value: LevyFrequency; label: string; note: string }> = [
  { value: 'ONE_OFF', label: 'One-off', note: 'Owed once, until it is paid' },
  { value: 'MONTHLY', label: 'Monthly', note: 'Owed again every month' },
  { value: 'QUARTERLY', label: 'Quarterly', note: 'Owed again every quarter' },
  { value: 'ANNUAL', label: 'Annual', note: 'Owed again every year' },
];

/**
 * What the community charges its members.
 *
 * Dues and levies sit together because a member sees them together — the
 * question "what do I owe this month" has one answer, and splitting it across
 * two screens makes an officer add up figures the page already knows.
 */
export function DuesLeviesClient({ initial }: { initial: DuesLeviesOverview }) {
  const communityId = useCommunityId();
  const { data, refresh } = useQuery<DuesLeviesOverview>(
    () => portalApi.duesLevies(communityId),
    [communityId],
    { initial },
  );
  const d = data ?? initial;
  const collections = useQuery<DuesLeviesCollections>(
    () => portalApi.duesLeviesCollections(communityId),
    [communityId],
  );

  const [duesDraft, setDuesDraft] = useState(d.monthlyDues ?? '');
  const [duesOpen, setDuesOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [registerId, setRegisterId] = useState<string | null>(null);
  const [fineTarget, setFineTarget] = useState<{ charge: ChargeCollection; member: ChargeCollectionMember } | null>(null);

  const duesGate = useMoneyOutOtp<{ amount: string | null }>({
    perform: (extra, { amount }) => portalApi.setMonthlyDues(communityId, amount, extra),
    onDone: async () => {
      setDuesOpen(false);
      await refresh();
    },
    successMessage: 'Monthly due updated',
  });

  const levyGate = useMoneyOutOtp<{ levyId: string; body: Record<string, unknown> }>({
    perform: (extra, { levyId, body }) => portalApi.updateLevy(communityId, levyId, body, extra),
    onDone: refresh,
    successMessage: 'Levy updated',
  });

  const prefixLocked = d.membersIssued > 0;
  const duesDirty = duesDraft !== (d.monthlyDues ?? '');
  const selectedRegister = collections.data?.charges.find((charge) => charge.id === registerId) ?? null;

  return (
    <>
      <PageHeader
        title="Dues & levies"
        subtitle="What every member is charged, and the code they are known by"
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setDuesDraft(d.monthlyDues ?? '');
                setDuesOpen(true);
              }}
              icon={<Settings2 className="h-4 w-4" />}
            >
              Monthly dues
            </Button>
            <Button onClick={() => setCreating(true)} icon={<Plus className="h-4 w-4" />}>
              New levy
            </Button>
          </>
        }
      />

      <Callout tone="info" title="Every change here needs the owner's approval" className="mb-6">
        These decide what every member pays, so saving sends a one-time code to the community
        owner naming the exact change.
      </Callout>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Monthly due"
          value={d.monthlyDues ? money(d.monthlyDues, 'NGN') : 'Not charged'}
          icon={<Coins className="h-4 w-4" />}
          tone={d.monthlyDues ? 'default' : 'warning'}
        />
        <Stat
          label="Owed per member each month"
          value={money(d.monthlyTotalPerMember, 'NGN')}
          hint="The due plus every monthly levy"
          icon={<CalendarClock className="h-4 w-4" />}
        />
        <Stat
          label="Active levies"
          value={d.levies.filter((l) => l.isActive).length}
          hint={`${d.levies.length} in total, including those switched off`}
          icon={<BadgeCheck className="h-4 w-4" />}
        />
        <Stat
          label="Members"
          value={d.activeMembers}
          hint={`${d.membersIssued} code${d.membersIssued === 1 ? '' : 's'} issued`}
          icon={<Users className="h-4 w-4" />}
        />
      </div>

      <Card className="mb-6 overflow-hidden">
        <CardHeader
          title="Collection tracking"
          subtitle="Open a charge to see who has paid, follow up unpaid members, and issue a fine where necessary."
          action={collections.data ? <Badge tone={collections.data.charges.some((charge) => charge.unpaid > 0) ? 'amber' : 'green'}>{collections.data.charges.reduce((sum, charge) => sum + charge.unpaid, 0)} unpaid</Badge> : undefined}
        />
        {collections.error ? (
          <div className="p-5"><Callout tone="danger">{collections.error}</Callout></div>
        ) : collections.loading ? (
          <div className="grid gap-3 p-5 md:grid-cols-2">
            {[0, 1].map((item) => <div key={item} className="h-32 animate-pulse rounded-xl bg-slate-100" />)}
          </div>
        ) : !collections.data?.charges.length ? (
          <EmptyState compact icon={<Coins className="h-5 w-5" />} title="Nothing to track yet" body="Set monthly dues or create an active levy to start a collection register." />
        ) : (
          <div className="grid gap-4 p-5 lg:grid-cols-2">
            {collections.data.charges.map((charge) => {
              const total = charge.paid + charge.unpaid;
              const percent = total ? Math.round((charge.paid / total) * 100) : 0;
              return (
                <div key={charge.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-navy-900">{charge.name}</h3>
                        <Badge tone={charge.kind === 'DUES' ? 'navy' : 'purple'}>{charge.kind === 'DUES' ? 'Dues' : 'Levy'}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">{charge.period} · {money(charge.amount, 'NGN')} per member</p>
                    </div>
                    <span className="tnum text-sm font-semibold text-navy-900">{percent}%</span>
                  </div>
                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-brand-600" style={{ width: `${percent}%` }} /></div>
                  <div className="mt-3 flex items-center justify-between gap-3 text-xs">
                    <div className="flex gap-3"><span className="font-medium text-emerald-700">{charge.paid} paid</span><span className={charge.unpaid ? 'font-medium text-amber-700' : 'text-slate-500'}>{charge.unpaid} unpaid</span></div>
                    <Button variant="ghost" size="sm" iconRight={<ChevronRight className="h-4 w-4" />} onClick={() => setRegisterId(charge.id)}>View register</Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <div className="mb-5">
        <Card>
          <CardHeader
            title="Member codes"
            subtitle={
              d.memberCodePrefix
                ? `Members are known as ${d.memberCodePrefix}-261106-0001`
                : 'Not set yet — members have no identifier of their own'
            }
          />
          {/* Configured on the listing, with Joining, because a code is
              issued the moment someone is admitted. Shown here because this
              is where dues and levies reference members by it, and an
              officer looking at one reasonably wonders about the other. */}
          <div className="px-5 py-4">
            <p className="text-[13px] leading-5 text-slate-600">
              {d.memberCodePrefix
                ? `Every member admitted gets a code beginning ${d.memberCodePrefix}-.`
                : 'Pick a prefix and each member gets their own identifier, on their card and in the app.'}
            </p>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              {prefixLocked
                ? `${d.membersIssued} issued, so the prefix is now fixed.`
                : 'It locks once the first code is issued.'}
            </p>
            <LinkButton
              size="sm"
              variant="secondary"
              className="mt-3"
              href={'/listing' as Route}
              icon={<IdCard className="h-3.5 w-3.5" />}
            >
              {d.memberCodePrefix ? 'Review on the listing' : 'Set it on the listing'}
            </LinkButton>
          </div>
        </Card>
      </div>

      <Card className="mt-5">
        <CardHeader
          title="Levies"
          subtitle="Named assessments alongside the due. Switch one off to stop charging without losing what it collected."
          action={
            <Button variant="secondary" size="sm" onClick={() => setCreating(true)} icon={<Plus className="h-4 w-4" />}>
              New levy
            </Button>
          }
        />
        {d.levies.length === 0 ? (
          <EmptyState
            icon={<Coins className="h-5 w-5" />}
            title="No levies yet"
            body="A levy is a named charge with its own reason — a building fund, a security levy — that members see separately from their monthly due."
            action={
              <Button onClick={() => setCreating(true)} icon={<Plus className="h-4 w-4" />}>
                New levy
              </Button>
            }
          />
        ) : (
          <DataTable
            rows={d.levies}
            rowKey={(l) => l.id}
            columns={[
              {
                key: 'name',
                header: 'Levy',
                cell: (l) => (
                  <div className="min-w-0">
                    <p className="truncate font-medium text-navy-900">{l.name}</p>
                    {l.description && (
                      <p className="truncate text-xs text-slate-500">{l.description}</p>
                    )}
                  </div>
                ),
              },
              {
                key: 'amount',
                header: 'Amount',
                align: 'right',
                cell: (l) => money(l.amount, 'NGN'),
              },
              {
                key: 'frequency',
                header: 'How often',
                cell: (l) => <Badge tone="slate">{humanise(l.frequency)}</Badge>,
              },
              {
                key: 'window',
                header: 'From',
                cell: (l) => (
                  <span className="text-[13px]">
                    {date(l.startsOn)}
                    {l.endsOn && <span className="text-slate-500"> → {date(l.endsOn)}</span>}
                  </span>
                ),
              },
              {
                key: 'active',
                header: 'Charging',
                cell: (l) => (
                  <Toggle
                    checked={l.isActive}
                    disabled={levyGate.pending}
                    label={l.isActive ? 'On' : 'Off'}
                    onChange={(isActive) =>
                      void levyGate.run({ levyId: l.id, body: { isActive } })
                    }
                  />
                ),
              },
            ]}
          />
        )}
      </Card>

      <CreateLevyModal
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={async () => {
          setCreating(false);
          await refresh();
        }}
      />

      <Modal
        open={duesOpen}
        onClose={() => {
          if (duesGate.pending) return;
          setDuesDraft(d.monthlyDues ?? '');
          setDuesOpen(false);
        }}
        size="sm"
        title="Monthly dues settings"
        description="Set the standing amount every active member owes each month."
        footer={
          <>
            <Button
              variant="secondary"
              disabled={duesGate.pending}
              onClick={() => {
                setDuesDraft(d.monthlyDues ?? '');
                setDuesOpen(false);
              }}
            >
              Cancel
            </Button>
            <Button
              disabled={!duesDirty}
              loading={duesGate.pending}
              onClick={() =>
                void duesGate.run({ amount: duesDraft.trim() === '' ? null : duesDraft.trim() })
              }
            >
              Save dues setting
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Current monthly due</p>
            <p className="tnum mt-1 text-xl font-semibold text-navy-900">
              {d.monthlyDues ? money(d.monthlyDues, 'NGN') : 'No monthly due'}
            </p>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              This is charged to every active member and appears in collection tracking.
            </p>
          </div>
          <Field label="New monthly amount (NGN)" hint="Enter the amount without commas.">
            <Input
              value={duesDraft}
              onChange={(e) => setDuesDraft(e.target.value)}
              inputMode="decimal"
              placeholder="For example, 6000"
              className="tnum"
            />
          </Field>
          {d.monthlyDues && (
            <Button
              variant="ghost"
              size="sm"
              disabled={duesGate.pending || duesDraft === ''}
              onClick={() => setDuesDraft('')}
            >
              Stop charging monthly dues
            </Button>
          )}
          <Callout tone="info" title="Owner approval is required">
            Saving this change sends an approval code to the community owner before it takes effect.
          </Callout>
        </div>
      </Modal>

      <CollectionRegisterModal
        charge={selectedRegister}
        onClose={() => setRegisterId(null)}
        onFine={(member) => selectedRegister && setFineTarget({ charge: selectedRegister, member })}
      />
      <ChargeFineModal
        target={fineTarget}
        communityId={communityId}
        onClose={() => setFineTarget(null)}
        onCreated={async () => { setFineTarget(null); await collections.refresh(); }}
      />

      <MoneyOutOtpDialog gate={duesGate} />
      <MoneyOutOtpDialog gate={levyGate} />
    </>
  );
}

function CollectionRegisterModal({
  charge,
  onClose,
  onFine,
}: {
  charge: ChargeCollection | null;
  onClose: () => void;
  onFine: (member: ChargeCollectionMember) => void;
}) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'ALL' | 'PAID' | 'UNPAID'>('ALL');
  const members = (charge?.members ?? []).filter((member) => {
    if (status !== 'ALL' && member.status !== status) return false;
    const term = query.trim().toLowerCase();
    return !term || `${member.name} ${member.email} ${member.memberCode ?? ''}`.toLowerCase().includes(term);
  });

  return (
    <Modal
      open={charge !== null}
      onClose={() => { setQuery(''); setStatus('ALL'); onClose(); }}
      size="xl"
      title={charge ? `${charge.name} register` : 'Collection register'}
      description={charge ? `${charge.period} · ${money(charge.amount, 'NGN')} per member · ${charge.paid} paid, ${charge.unpaid} unpaid` : undefined}
      footer={<Button variant="secondary" onClick={onClose}>Close</Button>}
    >
      {charge && (
        <div className="space-y-4">
          <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3 sm:grid-cols-[minmax(220px,1fr)_180px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search member, email or code" className="bg-white pl-9" />
            </div>
            <Select value={status} onChange={(event) => setStatus(event.target.value as typeof status)}>
              <option value="ALL">All payment statuses</option>
              <option value="PAID">Paid</option>
              <option value="UNPAID">Unpaid</option>
            </Select>
          </div>

          {members.length === 0 ? (
            <EmptyState compact title="No matching members" body="Change the search or payment-status filter." />
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <DataTable
                rows={members}
                rowKey={(member) => member.memberId}
                columns={[
                  {
                    key: 'member', header: 'Member', cell: (member) => <div><p className="font-medium text-navy-900">{member.name}</p><p className="mt-0.5 text-xs text-slate-500">{member.memberCode ?? member.email}</p></div>,
                  },
                  { key: 'amount', header: 'Amount', align: 'right', cell: (member) => money(member.amount, 'NGN') },
                  { key: 'status', header: 'Status', cell: (member) => <Badge tone={member.status === 'PAID' ? 'green' : 'amber'} dot>{member.status === 'PAID' ? 'Paid' : 'Unpaid'}</Badge> },
                  { key: 'action', header: '', align: 'right', cell: (member) => member.status === 'UNPAID' ? <Button size="xs" variant="secondary" icon={<AlertTriangle className="h-3.5 w-3.5" />} onClick={() => onFine(member)}>Issue fine</Button> : <span className="text-xs text-slate-500">{member.paidAt ? date(member.paidAt) : 'Paid'}</span> },
                ]}
                mobile={(member) => <div className="space-y-3"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold text-navy-900">{member.name}</p><p className="mt-0.5 text-xs text-slate-500">{member.memberCode ?? member.email}</p></div><Badge tone={member.status === 'PAID' ? 'green' : 'amber'} dot>{member.status === 'PAID' ? 'Paid' : 'Unpaid'}</Badge></div><div className="flex items-center justify-between"><span className="tnum text-sm font-medium text-navy-900">{money(member.amount, 'NGN')}</span>{member.status === 'UNPAID' && <Button size="xs" variant="secondary" onClick={() => onFine(member)}>Issue fine</Button>}</div></div>}
              />
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

function ChargeFineModal({
  target,
  communityId,
  onClose,
  onCreated,
}: {
  target: { charge: ChargeCollection; member: ChargeCollectionMember } | null;
  communityId: string;
  onClose: () => void;
  onCreated: () => Promise<void>;
}) {
  const { toast } = useToast();
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const create = useMutation(
    (fineReason: string) => portalApi.issueFine(communityId, {
      memberId: target!.member.memberId,
      amount,
      reason: fineReason,
    }),
    {
      onSuccess: async () => { toast('Fine issued', 'success'); setAmount(''); setReason(''); await onCreated(); },
      onError: (message) => toast('Could not issue the fine', 'error', message),
    },
  );
  const close = () => { setAmount(''); setReason(''); create.reset(); onClose(); };
  const suggestedReason = target ? `Unpaid ${target.charge.name} — ${target.charge.period}` : '';

  return (
    <Modal
      open={target !== null}
      onClose={close}
      title="Issue a fine for non-payment"
      description={target ? `${target.member.name} has not paid ${money(target.charge.amount, 'NGN')} for ${target.charge.name}.` : undefined}
      footer={<><Button variant="secondary" onClick={close}>Cancel</Button><Button loading={create.pending} disabled={Number(amount) <= 0 || (reason.trim() || suggestedReason).length < 4} onClick={() => void create.run(reason.trim() || suggestedReason)}>Issue fine</Button></>}
    >
      <div className="space-y-4">
        {create.error && <Callout tone="danger">{create.error}</Callout>}
        <Callout tone="warning" title="This creates a separate amount owed">
          The original due or levy remains unpaid. The fine is added to the member’s account and recorded in the audit trail.
        </Callout>
        <Field label="Member"><Input value={target?.member.name ?? ''} disabled /></Field>
        <Field label="Fine amount (NGN)" required><Input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" placeholder="Enter the penalty amount" className="tnum" /></Field>
        <Field label="Reason" required><Textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder={suggestedReason} rows={3} /></Field>
      </div>
    </Modal>
  );
}

function CreateLevyModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void | Promise<void>;
}) {
  const communityId = useCommunityId();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [frequency, setFrequency] = useState<LevyFrequency>('ONE_OFF');
  const [startsOn, setStartsOn] = useState(new Date().toISOString().slice(0, 10));

  const gate = useMoneyOutOtp<void>({
    perform: (extra) =>
      portalApi.createLevy(
        communityId,
        {
          name: name.trim(),
          description: description.trim() || undefined,
          amount: amount.trim(),
          frequency,
          startsOn,
        },
        extra,
      ),
    onDone: async () => {
      setName('');
      setDescription('');
      setAmount('');
      await onCreated();
    },
    successMessage: 'Levy created',
  });

  const amountValid = /^\d+(\.\d{1,2})?$/.test(amount.trim());
  const complete = name.trim().length >= 2 && amountValid && startsOn;
  const chosen = FREQUENCIES.find((f) => f.value === frequency);

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title="New levy"
        description="A named charge members see separately from their monthly due."
        footer={
          <>
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={() => void gate.run(undefined as void)}
              loading={gate.pending}
              disabled={!complete}
            >
              Create levy
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Name" required>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Building fund"
            />
          </Field>
          <Field label="What it is for" optional hint="Members see this next to the amount.">
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Towards the new secretariat"
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Amount (NGN)"
              required
              error={amount && !amountValid ? 'Enter an amount like 5000 or 5000.00' : undefined}
            >
              <Input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                inputMode="decimal"
                placeholder="5000.00"
                className="tnum"
              />
            </Field>
            <Field label="How often" required hint={chosen?.note}>
              <Select
                value={frequency}
                onChange={(e) => setFrequency(e.target.value as LevyFrequency)}
              >
                {FREQUENCIES.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field
            label="Charging starts"
            required
            hint="Nothing is owed before this date, so a levy can be announced ahead of time."
          >
            <Input type="date" value={startsOn} onChange={(e) => setStartsOn(e.target.value)} />
          </Field>
        </div>
      </Modal>
      <MoneyOutOtpDialog gate={gate} />
    </>
  );
}
