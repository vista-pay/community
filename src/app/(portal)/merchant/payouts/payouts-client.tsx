'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  Banknote,
  CalendarClock,
  Landmark,
  PiggyBank,
  Users,
  Wallet,
} from 'lucide-react';
import {
  Badge,
  Button,
  Callout,
  Card,
  CardHeader,
  Checkbox,
  DataTable,
  EmptyState,
  ErrorState,
  Field,
  Input,
  PageHeader,
  RadioCard,
  Select,
  Stat,
  StatusBadge,
  Tabs,
} from '@/components/ui';
import { MoneyOutOtpDialog, useMoneyOutOtp } from '@/components/money-out-otp';
import { useMutation, useQuery } from '@/hooks/use-query';
import { useCommunityId } from '@/components/providers/session-provider';
import { useToast } from '@/components/providers/toast-provider';
import { portalApi } from '@/services/portal';
import { date, money } from '@/lib/format';
import type {
  MerchantBeneficiary,
  PayoutSettingsData,
  SettlementDestination,
  SettlementRun,
  SettlementSchedule,
  WalletData,
} from '@/types';
import { BeneficiaryRow, SendPayout } from './send-payout';
import { SettlementAccountsCard } from '@/components/merchant/settlement-accounts';

type Tab = 'send' | 'payees' | 'settlement';

const SCHEDULES: Array<{ value: SettlementSchedule; label: string; hint: string }> = [
  { value: 'MANUAL', label: 'Only when I ask', hint: 'Nothing moves until an officer settles' },
  { value: 'DAILY', label: 'Every day', hint: 'Swept once a day' },
  { value: 'WEEKLY', label: 'Weekly', hint: 'On a day you choose' },
  { value: 'MONTHLY', label: 'Monthly', hint: 'On a date you choose, 1st to 28th' },
];

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/**
 * What the screen assumes before anything has loaded.
 *
 * Not a pretence that the data arrived — the error banner says plainly when
 * it did not. It exists so the form's state hooks have something to
 * initialise from, since hooks cannot be skipped and a half-rendered screen
 * is still better than no screen at all.
 */
const NOTHING_LOADED: PayoutSettingsData = {
  settings: {
    destination: 'RENDI_WALLET',
    settlementAccount: null,
    schedule: 'MANUAL',
    dayOfWeek: null,
    dayOfMonth: null,
    minimumAmount: '0.00',
    holdHours: 0,
    autoSettle: false,
    autoSettleCeiling: null,
    isDefault: true,
  },
  accounts: [],
  summary: {
    currencyCode: 'NGN',
    collectedAllTime: '0.00',
    settledAllTime: '0.00',
    unsettled: '0.00',
    coveredFrom: new Date(0).toISOString(),
    coveredTo: new Date(0).toISOString(),
    canSettle: false,
    blockedReason: null,
  },
  charge: {
    toRendiWallet: '0.00',
    toBankAccount: '0.00',
    netToBankAccount: '0.00',
    explanation: '',
  },
};

/**
 * Payouts in one place: sending money out, who you send it to, and where the
 * community's collections settle.
 *
 * The three belong together because they are the same decision at different
 * speeds. Settlement is the standing instruction, a payout is the one-off, and
 * a payee is the address book both draw on. Split across screens, an officer
 * sets a destination on one page and cannot see on another that nothing has
 * actually been swept there.
 */
export function PayoutsClient({ initial }: { initial?: PayoutSettingsData }) {
  const communityId = useCommunityId();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get('tab');
  const [tab, setTab] = useState<Tab>(
    requestedTab === 'payees' || requestedTab === 'settlement' ? requestedTab : 'send',
  );

  const { data, error, loading, refresh } = useQuery<PayoutSettingsData>(
    () => portalApi.payoutSettings(communityId),
    [communityId],
    { initial },
  );
  const { data: payees, refresh: refreshPayees } = useQuery<MerchantBeneficiary[]>(
    () => portalApi.merchantBeneficiaries(communityId),
    [communityId],
  );
  const { data: runs, refresh: refreshRuns } = useQuery<SettlementRun[]>(
    () => portalApi.settlementRuns(communityId),
    [communityId],
  );
  const { data: wallet, refresh: refreshWallet } = useQuery<WalletData>(
    () => portalApi.wallet(communityId),
    [communityId],
  );

  const d = data ?? initial ?? NOTHING_LOADED;
  // Nothing on screen is real yet. Said once, at the top, rather than letting
  // an officer read zeroes as fact.
  const unavailable = !data && !initial;
  const summary = d.summary;
  const beneficiaries = payees ?? [];
  const ngnAccount =
    wallet?.wallet?.accounts.find((a) => a.currencyCode === 'NGN') ?? wallet?.wallet?.accounts[0];

  // ── Settlement settings form ─────────────────────────────────────────
  const [destination, setDestination] = useState<SettlementDestination>(d.settings.destination);
  const [accountId, setAccountId] = useState(d.settings.settlementAccount?.id ?? '');
  const [schedule, setSchedule] = useState<SettlementSchedule>(d.settings.schedule);
  const [dayOfWeek, setDayOfWeek] = useState(String(d.settings.dayOfWeek ?? 1));
  const [dayOfMonth, setDayOfMonth] = useState(String(d.settings.dayOfMonth ?? 1));
  const [minimum, setMinimum] = useState(d.settings.minimumAmount);
  const [holdHours, setHoldHours] = useState(String(d.settings.holdHours));
  const [autoSettle, setAutoSettle] = useState(d.settings.autoSettle);
  const [ceiling, setCeiling] = useState(d.settings.autoSettleCeiling ?? '');

  const settingsGate = useMoneyOutOtp({
    perform: (extra) =>
      portalApi.updatePayoutSettings(
        communityId,
        {
          destination,
          settlementAccountId: destination === 'BANK_ACCOUNT' ? accountId : undefined,
          schedule,
          dayOfWeek: schedule === 'WEEKLY' ? Number(dayOfWeek) : undefined,
          dayOfMonth: schedule === 'MONTHLY' ? Number(dayOfMonth) : undefined,
          minimumAmount: minimum || '0',
          holdHours: Number(holdHours) || 0,
          autoSettle: destination === 'BANK_ACCOUNT' ? autoSettle : false,
          autoSettleCeiling: autoSettle && ceiling ? ceiling : undefined,
        },
        extra,
      ),
    onDone: refresh,
    successMessage: 'Saved — future collections settle to the new destination',
  });

  const settleGate = useMoneyOutOtp({
    perform: (extra) => portalApi.settleNow(communityId, extra),
    onDone: async () => {
      await Promise.all([refresh(), refreshRuns(), refreshWallet()]);
    },
    successMessage: 'Settled',
  });

  const toggleFavourite = useMutation(
    (payee: MerchantBeneficiary) =>
      portalApi.updateMerchantBeneficiary(communityId, payee.id, {
        isFavourite: !payee.isFavourite,
      }),
    {
      onSuccess: refreshPayees,
      onError: (message) => toast('Could not update that payee', 'error', message),
    },
  );
  const removePayee = useMutation(
    (payee: MerchantBeneficiary) => portalApi.removeMerchantBeneficiary(communityId, payee.id),
    {
      onSuccess: async () => {
        toast('Payee removed', 'success');
        await refreshPayees();
      },
      onError: (message) => toast('Could not remove that payee', 'error', message),
    },
  );

  const toBank = destination === 'BANK_ACCOUNT';
  const settingsReady = !toBank || Boolean(accountId);

  return (
    <>
      <PageHeader
        title="Payouts & payees"
        subtitle="Send money out, keep an address book, and decide where collections settle"
        breadcrumb={
          <Link href="/merchant" className="inline-flex items-center gap-1.5 hover:text-navy-900">
            <ArrowLeft className="h-3.5 w-3.5" />
            Merchant account
          </Link>
        }
      />

      {unavailable && !loading && (
        <ErrorState
          title="Payout settings could not be loaded"
          body={
            error ??
            'The server did not answer. Nothing below is accurate until it does.'
          }
          onRetry={() => void refresh()}
        />
      )}

      <Tabs
        className="mb-6"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'send', label: 'Send money' },
          { value: 'payees', label: 'Payees', count: beneficiaries.length },
          { value: 'settlement', label: 'Settlement' },
        ]}
      />

      {tab === 'send' && (
        <SendPayout
          beneficiaries={beneficiaries}
          availableBalance={ngnAccount?.available ?? null}
          currencyCode={ngnAccount?.currencyCode ?? summary.currencyCode}
          onSent={async () => {
            await Promise.all([refreshWallet(), refreshPayees(), refresh()]);
          }}
        />
      )}

      {tab === 'payees' && (
        <Card>
          <CardHeader
            title="Saved payees"
            subtitle="Favourites first, then whoever was paid most recently. Saved against the community, not the officer who added them."
          />
          {beneficiaries.length === 0 ? (
            <EmptyState
              icon={<Users className="h-5 w-5" />}
              title="No saved payees"
              body="Tick “save this payee” when you send a payment, and they appear here for next time."
              action={<Button onClick={() => setTab('send')}>Send a payment</Button>}
            />
          ) : (
            <div className="divide-y divide-slate-100">
              {beneficiaries.map((payee) => (
                <BeneficiaryRow
                  key={payee.id}
                  payee={payee}
                  busy={toggleFavourite.pending || removePayee.pending}
                  onToggleFavourite={() => void toggleFavourite.run(payee)}
                  onRemove={() => void removePayee.run(payee)}
                />
              ))}
            </div>
          )}
        </Card>
      )}

      {tab === 'settlement' && (
        <div className="space-y-6">
          {/* Said before the numbers, because it is the thing officers get
              wrong: money collected is not money settled. */}
          <Callout tone="info" title="Collections are not settled on arrival">
            Money paid to this community lands in its merchant Wallet and is held until a
            settlement run sweeps it to the destination below. Settling to the community&rsquo;s own
            Rendi wallet is instant and free — the money is already there. Settling to an external
            bank is a real transfer, and the charge is deducted from the amount swept.
          </Callout>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat
              label="Collected all time"
              value={money(summary.collectedAllTime, summary.currencyCode)}
              hint="Everything ever paid to this community"
              icon={<Banknote className="h-4 w-4" />}
            />
            <Stat
              label="Settled all time"
              value={money(summary.settledAllTime, summary.currencyCode)}
              hint="Swept to your destination"
              icon={<PiggyBank className="h-4 w-4" />}
            />
            <Stat
              label="Waiting to settle"
              value={money(summary.unsettled, summary.currencyCode)}
              hint={
                summary.blockedReason ??
                `Covers ${date(summary.coveredFrom)} to ${date(summary.coveredTo)}`
              }
              tone={summary.canSettle ? 'positive' : 'default'}
              icon={<Wallet className="h-4 w-4" />}
            />
            <Stat
              label="Charge to settle"
              value={
                toBank
                  ? money(d.charge.toBankAccount, summary.currencyCode)
                  : money(d.charge.toRendiWallet, summary.currencyCode)
              }
              hint={d.charge.explanation}
              icon={<CalendarClock className="h-4 w-4" />}
            />
          </div>

          <Card>
            <CardHeader
              title="Settle now"
              subtitle={
                summary.canSettle
                  ? `${money(summary.unsettled, summary.currencyCode)} is ready to sweep`
                  : 'Nothing to settle right now'
              }
              action={
                <Button
                  disabled={!summary.canSettle || settleGate.pending}
                  loading={settleGate.pending}
                  onClick={() => void settleGate.run()}
                >
                  Settle {money(summary.unsettled, summary.currencyCode)}
                </Button>
              }
            />
            {summary.blockedReason && (
              <p className="px-5 pb-5 text-[13px] text-slate-500">{summary.blockedReason}</p>
            )}
            {toBank && summary.canSettle && (
              <p className="px-5 pb-5 text-[13px] text-slate-600">
                {money(summary.unsettled, summary.currencyCode)} less a{' '}
                {money(d.charge.toBankAccount, summary.currencyCode)} charge leaves{' '}
                <span className="font-semibold text-navy-900">
                  {money(d.charge.netToBankAccount, summary.currencyCode)}
                </span>{' '}
                reaching the bank.
              </p>
            )}
          </Card>

          <Card>
            <CardHeader
              title="Where collections settle"
              subtitle="Changing this redirects every future collection, so the owner approves it with a code."
            />
            <div className="space-y-5 p-5">
              {d.settings.isDefault && (
                <p className="rounded-xl bg-slate-50 px-4 py-3 text-[13px] text-slate-600">
                  Nothing has been chosen yet, so the default applies: collections stay in the
                  community&rsquo;s own Rendi wallet, at no charge.
                </p>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                <RadioCard
                  selected={!toBank}
                  onSelect={() => setDestination('RENDI_WALLET')}
                  title="The community's Rendi wallet"
                  description="Instant and free. Loans, welfare and transfers out all pay from here."
                  icon={<Wallet className="h-4 w-4" />}
                  badge={<Badge tone="green">No charge</Badge>}
                />
                <RadioCard
                  selected={toBank}
                  onSelect={() => setDestination('BANK_ACCOUNT')}
                  title="A bank account"
                  description="A real transfer out of Rendi. The charge is deducted from each sweep."
                  icon={<Landmark className="h-4 w-4" />}
                  badge={
                    <Badge tone="amber">{money(d.charge.toBankAccount, summary.currencyCode)}</Badge>
                  }
                />
              </div>

              {toBank && (
                <Field
                  label="Settlement account"
                  required
                  hint={
                    d.accounts.length
                      ? 'One of the community’s registered bank accounts'
                      : 'Add one under the merchant Wallet screen first'
                  }
                >
                  <Select value={accountId} onChange={(event) => setAccountId(event.target.value)}>
                    <option value="">Choose an account</option>
                    {d.accounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.bankName} ••••{account.accountNumber.slice(-4)} ·{' '}
                        {account.accountName}
                      </option>
                    ))}
                  </Select>
                </Field>
              )}

              <Field label="How often" required>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {SCHEDULES.map((option) => (
                    <RadioCard
                      key={option.value}
                      selected={schedule === option.value}
                      onSelect={() => setSchedule(option.value)}
                      title={option.label}
                      description={option.hint}
                    />
                  ))}
                </div>
              </Field>

              <div className="grid gap-4 sm:grid-cols-3">
                {schedule === 'WEEKLY' && (
                  <Field label="Day of the week">
                    <Select value={dayOfWeek} onChange={(event) => setDayOfWeek(event.target.value)}>
                      {WEEKDAYS.map((day, index) => (
                        <option key={day} value={index + 1}>
                          {day}
                        </option>
                      ))}
                    </Select>
                  </Field>
                )}
                {schedule === 'MONTHLY' && (
                  <Field label="Day of the month" hint="1st to 28th">
                    <Select
                      value={dayOfMonth}
                      onChange={(event) => setDayOfMonth(event.target.value)}
                    >
                      {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => (
                        <option key={day} value={day}>
                          {day}
                        </option>
                      ))}
                    </Select>
                  </Field>
                )}
                <Field
                  label="Do not settle less than"
                  hint="A transfer charge on a small balance costs more than it moves"
                >
                  <Input
                    inputMode="decimal"
                    value={minimum}
                    onChange={(event) => setMinimum(event.target.value.replace(/[^\d.]/g, ''))}
                  />
                </Field>
                <Field
                  label="Hold new money for"
                  hint="Hours. Keeps a payment that may be reversed from being swept out of reach."
                >
                  <Input
                    inputMode="numeric"
                    value={holdHours}
                    onChange={(event) => setHoldHours(event.target.value.replace(/\D/g, ''))}
                  />
                </Field>
              </div>

              {schedule !== 'MANUAL' && !toBank && (
                <Callout tone="info" title="This runs on its own">
                  Collections are swept to the community&rsquo;s wallet on the schedule above
                  without anyone doing anything. Nothing leaves Rendi, so there is nothing to
                  approve and nothing to charge.
                </Callout>
              )}

              {/* Automation, as a decision rather than a default.
                  Sending to a bank is real money leaving, so the owner
                  authorises the arrangement — destination, schedule and this
                  switch together — instead of approving each run. What keeps
                  it safe is that the destination is not free: an automatic run
                  can only ever reach an account they already registered. */}
              {schedule !== 'MANUAL' && toBank && (
                <div className="space-y-4 rounded-xl border border-slate-200 p-4">
                  <Checkbox
                    checked={autoSettle}
                    onChange={setAutoSettle}
                    label="Send automatically, without anyone releasing it"
                    description="On the schedule above, the amount due is transferred to the account you chose. Your officers are notified each time it goes."
                  />
                  {autoSettle ? (
                    <>
                      <Field
                        label="Pause runs above"
                        optional
                        hint="Leave empty for no limit. A run over this waits for someone to release it by hand."
                      >
                        <Input
                          inputMode="decimal"
                          value={ceiling}
                          onChange={(event) =>
                            setCeiling(event.target.value.replace(/[^\d.]/g, ''))
                          }
                          placeholder="No limit"
                          className="tnum"
                        />
                      </Field>
                      <p className="text-[12.5px] leading-relaxed text-slate-500">
                        Switching this on is itself owner-approved, and the approval message says
                        so. Turn it off at any time and settlements go back to waiting for an
                        officer.
                      </p>
                    </>
                  ) : (
                    <p className="text-[12.5px] leading-relaxed text-slate-500">
                      With this off, the schedule still works out what is due and tells your
                      officers — it just does not send it.
                    </p>
                  )}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-3">
                <Button
                  disabled={!settingsReady || settingsGate.pending}
                  loading={settingsGate.pending}
                  onClick={() => void settingsGate.run()}
                >
                  Save settlement settings
                </Button>
                <p className="text-[12.5px] text-slate-500">
                  The owner approves this with a code.
                </p>
              </div>
            </div>
          </Card>

          {/* Registering the destination belongs on the screen that chooses
              it. This card was written, typed and linted months ago and then
              rendered nowhere, because at the time nothing consumed a
              community payout account — which left the Configuration screen
              telling officers to add one "under the Merchant wallet screen",
              where no such button existed. */}
          <SettlementAccountsCard accounts={d.accounts} onChanged={refresh} />

          <Card>
            <CardHeader
              title="Past settlement runs"
              subtitle="What was swept, when, and what it cost"
            />
            <DataTable
              rows={runs ?? []}
              rowKey={(run) => run.id}
              columns={[
                {
                  key: 'when',
                  header: 'Settled',
                  cell: (run) => (
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-navy-900">
                        {run.paidAt ? date(run.paidAt, 'datetime') : date(run.createdAt, 'datetime')}
                      </p>
                      <p className="truncate text-xs text-slate-500">
                        Covers {date(run.coveredFrom)} – {date(run.coveredTo)}
                      </p>
                    </div>
                  ),
                },
                {
                  key: 'to',
                  header: 'Destination',
                  hideOnMobile: true,
                  cell: (run) => <span className="text-slate-700">{run.destinationLabel}</span>,
                },
                {
                  key: 'reference',
                  header: 'Reference',
                  hideOnMobile: true,
                  cell: (run) => (
                    <span className="font-mono text-xs text-slate-500">{run.reference}</span>
                  ),
                },
                {
                  key: 'status',
                  header: 'Status',
                  cell: (run) => (
                    <div>
                      <StatusBadge status={run.status.toLowerCase()} />
                      {run.failureReason && (
                        <p className="mt-1 text-xs text-red-600">{run.failureReason}</p>
                      )}
                    </div>
                  ),
                },
                {
                  key: 'gross',
                  header: 'Swept',
                  align: 'right',
                  cell: (run) => (
                    <span className="tnum text-[13px]">
                      {money(run.grossAmount, run.currencyCode)}
                    </span>
                  ),
                },
                {
                  key: 'charge',
                  header: 'Charge',
                  align: 'right',
                  hideOnMobile: true,
                  cell: (run) => (
                    <span className="tnum text-[13px] text-slate-600">
                      {money(run.feeAmount, run.currencyCode)}
                    </span>
                  ),
                },
                {
                  key: 'net',
                  header: 'Received',
                  align: 'right',
                  cell: (run) => (
                    <span className="tnum text-[13px] font-semibold text-navy-900">
                      {money(run.netAmount, run.currencyCode)}
                    </span>
                  ),
                },
              ]}
              empty={
                <EmptyState
                  icon={<PiggyBank className="h-5 w-5" />}
                  title="Nothing settled yet"
                  body="Settlement runs appear here once collections have been swept."
                />
              }
            />
          </Card>
        </div>
      )}

      <MoneyOutOtpDialog gate={settingsGate} />
      <MoneyOutOtpDialog gate={settleGate} />
    </>
  );
}
