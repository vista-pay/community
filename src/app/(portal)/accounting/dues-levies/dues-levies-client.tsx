'use client';

import { useState } from 'react';
import type { Route } from 'next';
import Link from 'next/link';
import { BadgeCheck, CalendarClock, Coins, IdCard, Plus, Users } from 'lucide-react';
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
import { useQuery } from '@/hooks/use-query';
import { portalApi } from '@/services/portal';
import { date, humanise, money } from '@/lib/format';
import type { DuesLeviesOverview, LevyFrequency } from '@/types';

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

  const [duesDraft, setDuesDraft] = useState(d.monthlyDues ?? '');
  const [creating, setCreating] = useState(false);

  const duesGate = useMoneyOutOtp<{ amount: string | null }>({
    perform: (extra, { amount }) => portalApi.setMonthlyDues(communityId, amount, extra),
    onDone: refresh,
    successMessage: 'Monthly due updated',
  });

  const levyGate = useMoneyOutOtp<{ levyId: string; body: Record<string, unknown> }>({
    perform: (extra, { levyId, body }) => portalApi.updateLevy(communityId, levyId, body, extra),
    onDone: refresh,
    successMessage: 'Levy updated',
  });

  const prefixLocked = d.membersIssued > 0;
  const duesDirty = duesDraft !== (d.monthlyDues ?? '');

  return (
    <>
      <PageHeader
        title="Dues & levies"
        subtitle="What every member is charged, and the code they are known by"
        breadcrumb={
          <Link href="/accounting" className="hover:text-navy-900">
            Accounting
          </Link>
        }
        actions={
          <Button onClick={() => setCreating(true)} icon={<Plus className="h-4 w-4" />}>
            New levy
          </Button>
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

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Monthly due"
            subtitle="The standing cost of membership. Clear it to stop charging."
          />
          <div className="flex flex-wrap items-end gap-3 px-5 py-4">
            <Field label="Amount (NGN)" className="w-44">
              <Input
                value={duesDraft}
                onChange={(e) => setDuesDraft(e.target.value)}
                inputMode="decimal"
                placeholder="Not charged"
                className="tnum"
              />
            </Field>
            <Button
              disabled={!duesDirty}
              loading={duesGate.pending}
              onClick={() =>
                void duesGate.run({ amount: duesDraft.trim() === '' ? null : duesDraft.trim() })
              }
            >
              {duesDirty ? 'Save' : 'Saved'}
            </Button>
            {duesDirty && (
              <Button variant="ghost" size="sm" onClick={() => setDuesDraft(d.monthlyDues ?? '')}>
                Discard
              </Button>
            )}
          </div>
        </Card>

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

      <MoneyOutOtpDialog gate={duesGate} />
      <MoneyOutOtpDialog gate={levyGate} />
    </>
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
