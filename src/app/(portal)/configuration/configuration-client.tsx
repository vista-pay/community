'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { SettlementAccountsCard } from '@/components/merchant/settlement-accounts';
import { HandCoins, Landmark, PiggyBank, RefreshCw, ShieldCheck } from 'lucide-react';
import {
  Badge,
  Button,
  LinkButton,
  Callout,
  Card,
  CardHeader,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Select,
  Tabs,
  Toggle,
  Textarea,
} from '@/components/ui';
import { MoneyOutOtpDialog, useMoneyOutOtp } from '@/components/money-out-otp';
import { useCommunityId } from '@/components/providers/session-provider';
import { useQuery } from '@/hooks/use-query';
import { portalApi } from '@/services/portal';
import { date, humanise } from '@/lib/format';
import type { CommunityConfiguration } from '@/types';

type Tab = 'fees' | 'policies' | 'payouts';

const TABS: Array<{ value: Tab; label: string }> = [
  { value: 'fees', label: 'Fees & rates' },
  { value: 'policies', label: 'Service policies' },
  { value: 'payouts', label: 'Merchant & payouts' },
];

export function ConfigurationClient({ initial }: { initial: CommunityConfiguration }) {
  const communityId = useCommunityId();
  const searchParams = useSearchParams();
  const { data, refresh } = useQuery<CommunityConfiguration>(
    () => portalApi.configuration(communityId),
    [communityId],
    { initial },
  );
  const d = data ?? initial;
  const requestedTab = searchParams.get('tab');
  const [tab, setTab] = useState<Tab>(
    requestedTab === 'policies' || requestedTab === 'payouts' ? requestedTab : 'fees',
  );

  return (
    <>
      <PageHeader
        title="Configuration"
        subtitle="Everything that decides what members are charged and who qualifies"
      />

      {/* Stated once, at the top, rather than surprising an officer at each
          save. The server is the authority — the page asks for a code only
          when the API answers 428. */}
      <Callout tone="info" title="Every change here needs the owner's approval" className="mb-6">
        Saving on this page sends a one-time code to{' '}
        <strong>{d.community.name}</strong>&rsquo;s owner, naming the exact change. Nothing is
        applied until that code is entered. Profile details that do not affect money or eligibility
        live under <strong>Settings</strong> and save without a code.
      </Callout>

      <Tabs value={tab} onChange={setTab} tabs={TABS} className="mb-5" />

      {tab === 'fees' && <FeesSection config={d} onSaved={refresh} />}
      {tab === 'policies' && <PoliciesSection config={d} onSaved={refresh} />}
      {tab === 'payouts' && <PayoutsSection config={d} onSaved={refresh} />}
    </>
  );
}

// ───────────────────────────── Fees & rates ─────────────────────────────

function FeesSection({
  config,
  onSaved,
}: {
  config: CommunityConfiguration;
  onSaved: () => void | Promise<void>;
}) {
  const communityId = useCommunityId();
  const { loanProducts, savingsProducts, organizerFees, organizerFeesAuthorised } =
    config.feesAndRates;

  const [loanDrafts, setLoanDrafts] = useState<Record<string, { interestRate: string; processingFeePercent: string }>>(
    Object.fromEntries(
      loanProducts.map((p) => [
        p.id,
        { interestRate: p.interestRate, processingFeePercent: p.processingFeePercent },
      ]),
    ),
  );

  const loanGate = useMoneyOutOtp<{ productId: string }>({
    perform: (extra, { productId }) =>
      portalApi.updateLoanProduct(communityId, productId, loanDrafts[productId], extra),
    onDone: onSaved,
    successMessage: 'Loan terms updated',
  });

  const [savingsDrafts, setSavingsDrafts] = useState<
    Record<string, { interestRate: string; minBalance: string; withdrawalPolicy: string; noticeDays: string }>
  >(
    Object.fromEntries(
      savingsProducts.map((p) => [
        p.id,
        {
          interestRate: p.interestRate,
          minBalance: p.minBalance,
          withdrawalPolicy: p.withdrawalPolicy,
          noticeDays: String(p.noticeDays),
        },
      ]),
    ),
  );

  const savingsGate = useMoneyOutOtp<{ productId: string }>({
    perform: (extra, { productId }) => {
      const draft = savingsDrafts[productId];
      return portalApi.updateSavingsProduct(
        communityId,
        productId,
        {
          interestRate: draft.interestRate,
          minBalance: draft.minBalance,
          withdrawalPolicy: draft.withdrawalPolicy,
          noticeDays: Number(draft.noticeDays),
        },
        extra,
      );
    },
    onDone: onSaved,
    successMessage: 'Savings terms updated',
  });

  const feeGate = useMoneyOutOtp<{ groupId: string; body: Record<string, unknown> }>({
    perform: (extra, { groupId, body }) => portalApi.updateFeeSettings(groupId, body, extra),
    onDone: onSaved,
    successMessage: 'Organizer fee updated',
  });

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader
          title="Loan products"
          subtitle="Interest and processing fee. A product with live loans cannot have its rate changed — pause it and create a new version."
        />
        {loanProducts.length === 0 ? (
          <EmptyState
            icon={<HandCoins className="h-5 w-5" />}
            title="No loan products"
            body="Create one on the Loans screen, then set its terms here."
          />
        ) : (
          <div className="divide-y divide-slate-100">
            {loanProducts.map((p) => {
              const draft = loanDrafts[p.id];
              const dirty =
                draft.interestRate !== p.interestRate ||
                draft.processingFeePercent !== p.processingFeePercent;
              return (
                <div key={p.id} className="flex flex-wrap items-end gap-3 px-5 py-4">
                  <div className="min-w-[160px] flex-1">
                    <p className="font-medium text-navy-900">{p.name}</p>
                    <p className="text-xs text-slate-500">
                      {p.currencyCode} · {p.tenorMonths} months ·{' '}
                      <Badge tone={p.status === 'ACTIVE' ? 'green' : 'slate'}>{p.status}</Badge>
                    </p>
                  </div>
                  <Field label="Interest rate" className="w-28">
                    <Input
                      value={draft.interestRate}
                      onChange={(e) =>
                        setLoanDrafts((c) => ({
                          ...c,
                          [p.id]: { ...c[p.id], interestRate: e.target.value },
                        }))
                      }
                      inputMode="decimal"
                      className="tnum"
                    />
                  </Field>
                  <Field label="Processing fee" className="w-28">
                    <Input
                      value={draft.processingFeePercent}
                      onChange={(e) =>
                        setLoanDrafts((c) => ({
                          ...c,
                          [p.id]: { ...c[p.id], processingFeePercent: e.target.value },
                        }))
                      }
                      inputMode="decimal"
                      className="tnum"
                    />
                  </Field>
                  <Button
                    size="sm"
                    disabled={!dirty}
                    loading={loanGate.pending}
                    onClick={() => void loanGate.run({ productId: p.id })}
                  >
                    {dirty ? 'Save' : 'Saved'}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Card>
        <CardHeader
          title="Savings products"
          subtitle="What members earn, and when they can take it out."
        />
        {savingsProducts.length === 0 ? (
          <EmptyState
            icon={<PiggyBank className="h-5 w-5" />}
            title="No savings products"
            body="Create one on the Savings screen, then set its terms here."
          />
        ) : (
          <div className="divide-y divide-slate-100">
            {savingsProducts.map((p) => {
              const draft = savingsDrafts[p.id];
              const dirty =
                draft.interestRate !== p.interestRate ||
                draft.minBalance !== p.minBalance ||
                draft.withdrawalPolicy !== p.withdrawalPolicy ||
                draft.noticeDays !== String(p.noticeDays);
              const edit = (patch: Partial<typeof draft>) =>
                setSavingsDrafts((c) => ({ ...c, [p.id]: { ...c[p.id], ...patch } }));
              return (
                <div key={p.id} className="px-5 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium text-navy-900">{p.name}</p>
                    <Badge tone={p.isActive ? 'green' : 'slate'}>
                      {p.isActive ? 'Active' : 'Hidden'}
                    </Badge>
                  </div>
                  <div className="mt-3 flex flex-wrap items-end gap-3">
                    <Field label="Interest rate" className="w-28">
                      <Input
                        value={draft.interestRate}
                        onChange={(e) => edit({ interestRate: e.target.value })}
                        inputMode="decimal"
                        className="tnum"
                      />
                    </Field>
                    <Field label="Minimum balance" className="w-32">
                      <Input
                        value={draft.minBalance}
                        onChange={(e) => edit({ minBalance: e.target.value })}
                        inputMode="decimal"
                        className="tnum"
                      />
                    </Field>
                    <Field label="Withdrawals" className="w-36">
                      <Select
                        value={draft.withdrawalPolicy}
                        onChange={(e) => edit({ withdrawalPolicy: e.target.value })}
                      >
                        <option value="ANYTIME">Anytime</option>
                        <option value="NOTICE">With notice</option>
                        <option value="LOCKED">Locked</option>
                      </Select>
                    </Field>
                    {draft.withdrawalPolicy === 'NOTICE' && (
                      <Field label="Notice days" className="w-24">
                        <Input
                          value={draft.noticeDays}
                          onChange={(e) => edit({ noticeDays: e.target.value.replace(/\D/g, '') })}
                          inputMode="numeric"
                          className="tnum"
                        />
                      </Field>
                    )}
                    <Button
                      size="sm"
                      disabled={!dirty}
                      loading={savingsGate.pending}
                      onClick={() => void savingsGate.run({ productId: p.id })}
                    >
                      {dirty ? 'Save' : 'Saved'}
                    </Button>
                  </div>
                  {/* Said before the attempt, not as a rejection afterwards:
                      the server refuses either of these while accounts are
                      open, because both restrict savings members already hold. */}
                  <p className="mt-2 text-xs text-slate-500">
                    Tightening withdrawals or raising the minimum is refused while accounts are
                    open on this product — create a new product for stricter terms.
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Card>
        <CardHeader
          title="Organizer fees"
          subtitle="Charged to members of a cooperative Ajo group. Locked once a cycle starts — changes apply to the next one."
        />
        {!organizerFeesAuthorised && (
          <div className="px-5 pt-4">
            <Callout tone="warning" title="Not authorised for this community">
              A platform admin must enable organizer fees for{' '}
              <strong>{config.community.name}</strong> before one can be set. The controls below
              will be refused until then.
            </Callout>
          </div>
        )}
        {organizerFees.length === 0 ? (
          <EmptyState
            icon={<RefreshCw className="h-5 w-5" />}
            title="No Ajo groups"
            body="Organizer fees are set per group, so this fills in once the community runs one."
          />
        ) : (
          <div className="divide-y divide-slate-100">
            {organizerFees.map((g) => (
              <div key={g.ajoGroupId} className="flex flex-wrap items-center gap-3 px-5 py-4">
                <div className="min-w-[160px] flex-1">
                  <p className="font-medium text-navy-900">{g.name}</p>
                  <p className="text-xs text-slate-500">
                    <Badge tone={g.status === 'ACTIVE' ? 'green' : 'slate'}>{g.status}</Badge>
                    {g.enabled && g.value ? ` · ${g.value} (${humanise(g.feeType ?? '')})` : ' · no fee'}
                  </p>
                </div>
                <Toggle
                  checked={g.enabled}
                  disabled={!organizerFeesAuthorised || feeGate.pending}
                  label={g.enabled ? 'On' : 'Off'}
                  onChange={(enabled) =>
                    void feeGate.run({
                      groupId: g.ajoGroupId,
                      // Turning it off needs no figures; turning it on reuses
                      // whatever was last set, or a percentage default.
                      body: enabled
                        ? { enabled: true, feeType: g.feeType ?? 'PERCENTAGE', value: g.value ?? '1' }
                        : { enabled: false },
                    })
                  }
                />
              </div>
            ))}
          </div>
        )}
      </Card>

      <MoneyOutOtpDialog gate={loanGate} />
      <MoneyOutOtpDialog gate={savingsGate} />
      <MoneyOutOtpDialog gate={feeGate} />
    </div>
  );
}

// ───────────────────────────── Service policies ─────────────────────────────

/**
 * What to write, per policy. The prompts came across with the editor from
 * Settings — an empty textarea labelled "Policy terms" tells an officer
 * nothing about what their members need to be told.
 */
const POLICY_PLACEHOLDER: Record<string, string> = {
  JOINING: 'Who can join, documents required, joining fee, approval timeline, exit conditions…',
  CONTRIBUTIONS: 'Contribution schedule, payment deadline, grace period, late fee, refunds…',
  SAVINGS: 'Minimum balance, withdrawal notice, interest calculation, closure rules…',
  LOANS: 'Eligibility period, maximum loan, guarantors, interest, tenor, default actions…',
  WELFARE: 'Covered situations, evidence required, support cap, review and payment process…',
  OPPORTUNITIES: 'Who qualifies, how selection works, closing dates, fees and participation rules…',
};

function PoliciesSection({
  config,
  onSaved,
}: {
  config: CommunityConfiguration;
  onSaved: () => void | Promise<void>;
}) {
  const communityId = useCommunityId();
  const { policies } = config.servicePolicies;

  /**
   * Starting values come from the server, which merges what was stored over
   * the defaults for every rule the area supports. The client used to carry
   * its own defaults for loans and nothing for the other five areas, so a
   * policy that had never been saved offered no rules to set.
   */
  const [drafts, setDrafts] = useState<Record<string, Record<string, string | number | boolean>>>(
    Object.fromEntries(policies.map((p) => [p.area, { ...p.rules }])),
  );
  const [published, setPublished] = useState<Record<string, boolean>>(
    Object.fromEntries(policies.map((p) => [p.area, p.isPublished])),
  );
  /**
   * The policy's own words, which used to be edited on a second screen in
   * Settings while the numbers were edited here. One policy, two places to
   * change it, and no indication on either that the other existed.
   */
  const [terms, setTerms] = useState<Record<string, string>>(
    Object.fromEntries(policies.map((p) => [p.area, p.content ?? ''])),
  );

  const gate = useMoneyOutOtp<{ area: string }>({
    perform: (extra, { area }) => {
      const policy = policies.find((p) => p.area === area)!;
      return portalApi.updatePolicy(
        communityId,
        {
          area: policy.area,
          content: terms[area] ?? policy.content ?? '',
          rules: drafts[area],
          isPublished: published[area] ?? false,
        },
        extra,
      );
    },
    onDone: onSaved,
    successMessage: 'Policy saved',
  });

  return (
    <div className="space-y-5">
      <Callout tone="info" title="Every service your community can govern is listed here">
        A policy starts as a draft that only officers see. Write its terms, set its rules, then
        publish it when members should be held to it. Saving is what brings a policy into being —
        and like everything on this page, it needs the owner&rsquo;s code.
      </Callout>

      {policies.map((p) => {
        const draft = drafts[p.area] ?? {};
        const dirty =
          !p.exists ||
          JSON.stringify(draft) !== JSON.stringify(p.rules) ||
          (published[p.area] ?? false) !== p.isPublished ||
          (terms[p.area] ?? '') !== (p.content ?? '');
        // Rendered from what the area may set, not from what it happens to
        // have set already — otherwise a policy nobody has written yet shows
        // no rules and cannot be given any.
        const definitions = Object.entries(p.ruleDefinitions ?? {});
        const written = terms[p.area]?.trim() ?? '';

        return (
          <Card key={p.area}>
            <CardHeader
              title={humanise(p.area)}
              subtitle={
                p.exists
                  ? `Version ${p.version}${p.updatedAt ? ` · updated ${date(p.updatedAt)}` : ''}`
                  : 'Not set yet'
              }
              action={
                <>
                  <Toggle
                    checked={published[p.area] ?? false}
                    label={`Publish ${humanise(p.area)} policy`}
                    onChange={(next) => setPublished((current) => ({ ...current, [p.area]: next }))}
                  />
                  <Badge
                    tone={!p.exists ? 'slate' : (published[p.area] ?? false) ? 'green' : 'amber'}
                  >
                    {!p.exists ? 'Not set' : (published[p.area] ?? false) ? 'Published' : 'Draft'}
                  </Badge>
                  <Button
                    size="sm"
                    disabled={!dirty}
                    loading={gate.pending}
                    onClick={() => void gate.run({ area: p.area })}
                  >
                    {p.exists ? (dirty ? 'Save' : 'Saved') : 'Create policy'}
                  </Button>
                </>
              }
            />
            <div className="px-5 pt-4">
              <Field
                label="Policy terms"
                htmlFor={`policy-terms-${p.area}`}
                hint="What members read before they join or use this service. Published policies appear in the app; drafts stay with officers."
              >
                <Textarea
                  id={`policy-terms-${p.area}`}
                  rows={4}
                  value={terms[p.area] ?? ''}
                  placeholder={POLICY_PLACEHOLDER[p.area] ?? 'Set out the rules in plain words.'}
                  onChange={(e) => setTerms((current) => ({ ...current, [p.area]: e.target.value }))}
                />
              </Field>
              {/* Publishing empty terms would show members a blank policy. */}
              {(published[p.area] ?? false) && !written && (
                <p className="mt-2 text-[12.5px] text-amber-700">
                  This policy has no terms written. Members would see the rules below and nothing
                  explaining them.
                </p>
              )}
            </div>

            <div className="grid gap-3 px-5 py-4 sm:grid-cols-2 lg:grid-cols-3">
              {definitions.map(([key, definition]) => {
                const value = draft[key] ?? definition.default;
                const set = (next: string | number | boolean) =>
                  setDrafts((c) => ({ ...c, [p.area]: { ...c[p.area], [key]: next } }));

                if (definition.type === 'boolean') {
                  return (
                    <Toggle
                      key={key}
                      checked={Boolean(value)}
                      label={definition.label}
                      onChange={set}
                    />
                  );
                }
                if (definition.type === 'enum') {
                  return (
                    <Field key={key} label={definition.label} hint={definition.help}>
                      <Select value={String(value)} onChange={(e) => set(e.target.value)}>
                        {definition.values.map((option) => (
                          <option key={option} value={option}>
                            {humanise(option)}
                          </option>
                        ))}
                      </Select>
                    </Field>
                  );
                }
                return (
                  <Field key={key} label={definition.label} hint={definition.help}>
                    <Input
                      value={String(value)}
                      inputMode="decimal"
                      className="tnum"
                      onChange={(e) => {
                        // Kept as text while empty so the field can be cleared
                        // and retyped; Number('') is 0, which would fight the
                        // officer for the cursor.
                        const raw = e.target.value.replace(/[^\d.]/g, '');
                        set(raw === '' ? '' : Number(raw));
                      }}
                    />
                  </Field>
                );
              })}
            </div>
          </Card>
        );
      })}
      <MoneyOutOtpDialog gate={gate} />
    </div>
  );
}

// ───────────────────────────── Merchant & payouts ─────────────────────────────

/**
 * Payout accounts, managed here rather than pointed at.
 *
 * This section used to show the accounts and then send an officer to another
 * screen to add one — a card that lists something but refuses to let you add
 * to it, behind a button that navigates instead of acting. It is the same
 * card Payouts & payees uses, so adding, making default and removing all work
 * wherever an officer happens to be looking.
 *
 * The destination and schedule stay on Payouts & payees, because those are
 * decisions about *runs* rather than about which accounts exist, and keeping
 * them beside the settlement history is what stops a destination and the runs
 * that use it drifting apart.
 */
function PayoutsSection({
  config,
  onSaved,
}: {
  config: CommunityConfiguration;
  onSaved: () => void | Promise<void>;
}) {
  const { settlementAccounts, payoutsWired } = config.merchantAndPayouts;

  return (
    <div className="space-y-5">
      {/* Said before the section does anything, not after an officer has
          filled it in: these details feed no payout path yet. */}
      {!payoutsWired && (
        <Callout tone="warning" title="Payouts are not wired up yet">
          Nothing in Rendi currently pays a community out to its own bank account — withdrawals
          handle personal and business wallets only. These accounts are recorded against the
          community and are what a payout will settle to once that exists.
        </Callout>
      )}

      <SettlementAccountsCard accounts={settlementAccounts} onChanged={onSaved} />

      <Card>
        <CardHeader
          title="Where collections settle"
          subtitle="Which of these accounts money is swept to, how often, and whether it goes automatically."
        />
        <div className="flex flex-wrap items-center gap-3 px-5 py-4">
          <Landmark className="h-5 w-5 shrink-0 text-brand-600" />
          <p className="min-w-[220px] flex-1 text-[13px] text-slate-600">
            The destination and schedule live beside the settlement history, so what was chosen and
            what actually ran are read together.
          </p>
          <LinkButton variant="secondary" href="/merchant/settlement">
            Open settlement
          </LinkButton>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Merchant status"
          subtitle="How this community is classified at the payment provider."
        />
        <div className="flex items-center gap-3 px-5 py-4">
          <ShieldCheck className="h-5 w-5 text-brand-600" />
          <p className="text-[13px] text-slate-600">
            {config.community.name} collects in its own name as a merchant account. Its collection
            account number and payment links live on the <strong>Merchant account</strong> screen.
          </p>
        </div>
      </Card>
    </div>
  );
}
