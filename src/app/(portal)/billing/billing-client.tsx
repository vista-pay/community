'use client';

import { useMemo, useState } from 'react';
import { Check, CreditCard, Lock, Receipt, Sparkles, Users, Wallet } from 'lucide-react';
import {
  Badge,
  Button,
  Callout,
  Card,
  CardHeader,
  ConfirmDialog,
  DataTable,
  EmptyState,
  PageHeader,
  ProgressBar,
  StatusBadge,
} from '@/components/ui';
import { useMutation } from '@/hooks/use-query';
import { MoneyOutOtpDialog, useMoneyOutOtp } from '@/components/money-out-otp';
import { useCommunityId } from '@/components/providers/session-provider';
import { useToast } from '@/components/providers/toast-provider';
import { portalApi } from '@/services/portal';
import { cn, date, daysUntil, money, num } from '@/lib/format';
import type { Money, Subscription, SubscriptionPlan } from '@/types';

type Usage = { members: number; ajoGroups: number; walletBalance: Money | null };

/** A limit of `null` means unlimited — the plan and the snapshot both store it that way. */
const limitLabel = (limit: number | null) => (limit === null ? 'Unlimited' : num(limit));

export function BillingClient({
  plans,
  subscription,
  usage,
}: {
  plans: SubscriptionPlan[];
  subscription: Subscription | null;
  usage: Usage;
}) {
  const communityId = useCommunityId();
  const { toast } = useToast();
  const [choosing, setChoosing] = useState<SubscriptionPlan | null>(null);
  const [cancelling, setCancelling] = useState(false);
  // The Enterprise conversation: a dialog, a message, a support ticket.
  const [enquiring, setEnquiring] = useState<SubscriptionPlan | null>(null);
  const [enquiryMessage, setEnquiryMessage] = useState('');
  /**
   * Cancelling now versus at the end of the period already paid for. Two
   * genuinely different things, and the screen used to offer only one of
   * them while describing the other.
   */
  const [cancelNow, setCancelNow] = useState(false);

  // One key per checkout intent: minted when the confirm dialog opens, reused
  // across retries of that confirmation so a timed-out request replays the
  // original charge instead of making a second one.
  const checkoutKey = useMemo(
    () => (choosing ? `community-sub-checkout-${crypto.randomUUID()}` : null),
    [choosing],
  );

  const checkout = useMutation(
    (planId: string) => portalApi.checkout(communityId, planId, checkoutKey!),
    {
      onSuccess: () => {
        toast('Plan changed', 'success');
        setChoosing(null);
        window.location.reload();
      },
      onError: (message) => toast('Could not change the plan', 'error', message),
    },
  );

  const cancel = useMutation(
    (reason: string) => portalApi.cancelSubscription(subscription!.id, reason, cancelNow),
    {
      onSuccess: () => {
        toast(
          cancelNow ? 'Subscription cancelled' : 'Cancellation scheduled',
          'info',
          cancelNow
            ? 'The plan has ended and this community is now on the base plan.'
            : `The plan runs until ${subscription ? date(subscription.currentPeriodEnd) : 'the end of the period'} and will not renew.`,
        );
        setCancelling(false);
        window.location.reload();
      },
      onError: (message) => toast('Could not cancel', 'error', message),
    },
  );

  /**
   * Moving plan on a subscription that already exists.
   *
   * Checkout is for a community with no subscription; it refuses outright
   * when one is live, which is why choosing a plan used to fail with
   * "already has an active subscription" and no way forward.
   */
  const changePlan = useMutation(
    (planId: string) => portalApi.changeSubscriptionPlan(subscription!.id, { planId }),
    {
      onSuccess: () => {
        setChoosing(null);
        window.location.reload();
      },
      onError: (message) => toast('Could not change the plan', 'error', message),
    },
  );

  const dropPlanChange = useMutation(
    () => portalApi.cancelScheduledPlanChange(subscription!.id),
    {
      onSuccess: () => {
        toast('Staying on your current plan', 'success');
        window.location.reload();
      },
      onError: (message) => toast('Could not drop that change', 'error', message),
    },
  );

  /**
   * The invoice waiting to be paid, if there is one.
   *
   * Rendi raises the bill and stops; this is what the officer acts on. The
   * oldest open invoice is the one that matters — it is the period currently
   * holding the tier open.
   */
  const openInvoice = useMemo(
    () =>
      (subscription?.invoices ?? [])
        .filter((invoice) => invoice.status === 'OPEN')
        .sort((a, b) => new Date(a.issuedAt).getTime() - new Date(b.issuedAt).getTime())[0] ?? null,
    [subscription],
  );

  const payKey = useMemo(
    () => (openInvoice ? `community-sub-pay-${openInvoice.id}` : null),
    [openInvoice],
  );

  /**
   * Paying from the community's own balance.
   *
   * Through the money-out gate, not a plain mutation: this is members' money
   * leaving, so it carries the owner's approval code exactly as a withdrawal
   * or a payout does. The API answers the first call with a 428 and a
   * challenge, and this hook is what turns that into a code prompt instead of
   * an error with nowhere to type.
   */
  const pay = useMoneyOutOtp({
    perform: (extra) =>
      portalApi.paySubscription(subscription!.id, payKey!, openInvoice!.id, extra),
    onDone: () => window.location.reload(),
    successMessage: 'Invoice paid — your plan is active for the new period',
  });

  /**
   * Pay by card or transfer, for a wallet that cannot cover it.
   *
   * The money funds the community wallet through the ordinary deposit path
   * and the invoice closes when Paystack confirms it — so the officer leaves
   * this page and comes back to a settled plan, rather than the plan flipping
   * on before anyone has paid.
   */
  const payOnline = useMutation(
    () => portalApi.paySubscriptionOnline(subscription!.id, openInvoice!.id),
    {
      onSuccess: (result) => {
        // A full navigation, not a new tab: pop-up blockers eat the tab, and
        // the officer would be left staring at an unchanged page wondering
        // whether they had paid.
        window.location.href = result.checkoutUrl;
      },
      onError: (message) => toast('Could not start the payment', 'error', message),
    },
  );

  const enquire = useMutation(
    (message: string) => portalApi.enterpriseEnquiry(communityId, message),
    {
      onSuccess: (result) => {
        setEnquiring(null);
        setEnquiryMessage('');
        toast(
          'Request sent',
          'success',
          result.ticketReference
            ? `The Rendi team will reach out. Your ticket reference is ${result.ticketReference}.`
            : 'The Rendi team will reach out to set this up with you.',
        );
      },
      onError: (message) => toast('Could not send the request', 'error', message),
    },
  );

  /**
   * Whether the wallet can pay for this plan outright.
   *
   * Decides what the upgrade confirmation promises: a covered wallet is
   * settled on the spot, so saying "an invoice waits on the next screen"
   * would describe a screen they will never see.
   */
  const walletCovers = (plan: SubscriptionPlan | null) =>
    Boolean(
      plan &&
        usage.walletBalance !== null &&
        Number(usage.walletBalance) >= Number(plan.monthlyPrice),
    );

  /** Cheaper than what they are on today: it waits for the paid period. */
  const isDowngrade = (plan: SubscriptionPlan) =>
    Boolean(subscription) && Number(plan.monthlyPrice) < Number(subscription!.plan.monthlyPrice);

  /**
   * The plan every community is on when it has chosen nothing else — the
   * cheapest self-serve one. There is no plan-less state to cancel into, so
   * on this plan the cancel button has nothing honest to offer and is hidden.
   */
  const basePlan = plans
    .filter((p) => !p.isNegotiated)
    .reduce<SubscriptionPlan | null>(
      (lowest, p) => (!lowest || Number(p.monthlyPrice) < Number(lowest.monthlyPrice) ? p : lowest),
      null,
    );
  const onBasePlan = Boolean(subscription && basePlan && subscription.plan.id === basePlan.id);

  const trialDays = subscription?.trialEndsAt ? daysUntil(subscription.trialEndsAt) : null;
  const entitlements = subscription?.entitlements;

  /**
   * Every feature the catalogue knows about, from the union of all published
   * plans, marked with whether this tier carries it.
   *
   * Showing only what is included answers "what do I have" but not "what am I
   * missing", which is the question an officer weighing an upgrade is
   * actually asking — so a feature this tier lacks is listed too, named with
   * the cheapest plan that would bring it.
   */
  const featureMatrix = useMemo(() => {
    const universe = new Map<
      string,
      { slug: string; label: string; description: string; group: string }
    >();
    for (const plan of plans) {
      for (const feature of plan.featureDetails) {
        if (!universe.has(feature.slug)) universe.set(feature.slug, feature);
      }
    }

    const held = new Set(entitlements?.features ?? []);
    /**
     * The cheapest plan that carries a feature. Self-serve plans are
     * preferred, but a feature only Enterprise has still names Enterprise —
     * "nothing offers this" would be a lie, and the plan card below already
     * routes to the contact flow rather than a checkout.
     */
    const cheapestWith = (slug: string) => {
      const carrying = plans
        .filter((p) => p.featureDetails.some((f) => f.slug === slug))
        .sort(
          (a, b) =>
            Number(a.isNegotiated) - Number(b.isNegotiated) ||
            Number(a.monthlyPrice) - Number(b.monthlyPrice),
        );
      return carrying[0] ?? null;
    };

    const groups = new Map<
      string,
      Array<{ slug: string; label: string; description: string; included: boolean; upgradeTo: string | null }>
    >();
    for (const feature of universe.values()) {
      const included = held.has(feature.slug);
      const upgrade = included ? null : cheapestWith(feature.slug);
      const row = {
        slug: feature.slug,
        label: feature.label,
        description: feature.description,
        included,
        upgradeTo:
          upgrade && upgrade.id !== subscription?.plan.id
            ? `${upgrade.name}${upgrade.isNegotiated ? ' · contact sales' : ''}`
            : null,
      };
      const existing = groups.get(feature.group);
      if (existing) existing.push(row);
      else groups.set(feature.group, [row]);
    }
    // Included first inside each group, so what they have reads before what
    // they do not.
    for (const rows of groups.values()) {
      rows.sort((a, b) => Number(b.included) - Number(a.included) || a.label.localeCompare(b.label));
    }
    return [...groups.entries()];
  }, [plans, entitlements, subscription]);

  const includedCount = entitlements?.features.length ?? 0;
  const totalFeatures = featureMatrix.reduce((sum, [, rows]) => sum + rows.length, 0);

  /**
   * How far through the paid period they are, for the renewal bar.
   *
   * Measured in whole days and rounded to a whole percent on purpose: this
   * component is server-rendered and then hydrated, and a millisecond-precise
   * figure differs between the two renders — which React reports as a
   * hydration mismatch on the bar's inline width. Day granularity is also all
   * the bar can honestly show.
   */
  const periodPct = (() => {
    if (!subscription) return 0;
    const DAY = 86_400_000;
    const start = new Date(subscription.currentPeriodStart).getTime();
    const end = new Date(subscription.currentPeriodEnd).getTime();
    if (end <= start) return 100;
    const totalDays = Math.max(1, Math.round((end - start) / DAY));
    const elapsedDays = Math.round((Date.now() - start) / DAY);
    return Math.min(100, Math.max(0, Math.round((elapsedDays / totalDays) * 100)));
  })();
  const daysLeft = subscription ? Math.max(0, daysUntil(subscription.currentPeriodEnd)) : 0;

  /** How long the tier stays open while an invoice goes unpaid. */
  const graceDaysLeft =
    subscription?.graceEndsAt && openInvoice
      ? Math.max(0, daysUntil(subscription.graceEndsAt))
      : null;

  const cannotAffordInvoice =
    openInvoice !== null &&
    usage.walletBalance !== null &&
    Number(usage.walletBalance) < Number(openInvoice.total);

  const nextCharge = subscription
    ? subscription.cancelAtPeriodEnd
      ? null
      : (subscription.pendingPlan ?? subscription.plan)
    : null;
  const shortOnWallet =
    nextCharge !== null &&
    usage.walletBalance !== null &&
    Number(usage.walletBalance) < Number(nextCharge.monthlyPrice);

  return (
    <>
      <PageHeader title="Billing & plan" subtitle="What Rendi charges this community, and everything your tier includes" />

      {/* ── The bill waiting to be paid ──────────────────────────────
          The one thing on this page that needs doing, so it sits above
          everything else and carries the button. */}
      {openInvoice && subscription && (
        <Card
          className={cn(
            'mb-6 border-l-4',
            graceDaysLeft !== null && graceDaysLeft <= 2
              ? 'border-l-red-500'
              : 'border-l-amber-400',
          )}
        >
          <div className="flex flex-wrap items-start justify-between gap-4 px-5 py-5">
            <div className="min-w-0">
              <p className="text-[15px] font-semibold text-navy-900">
                {money(openInvoice.total, openInvoice.currencyCode, { decimals: false })} due for{' '}
                {openInvoice.planName ?? subscription.plan.name}
              </p>
              <p className="mt-1 max-w-prose text-[13px] leading-relaxed text-slate-600">
                {graceDaysLeft !== null ? (
                  <>
                    Everything keeps working for{' '}
                    <strong className="text-navy-900">
                      {graceDaysLeft} more {graceDaysLeft === 1 ? 'day' : 'days'}
                    </strong>
                    . If it is still unpaid on {date(subscription.graceEndsAt!)}, this community
                    moves to {basePlan ? `the ${basePlan.name} plan` : 'the base plan'} and the
                    invoice is cancelled — you will not be chased for it.
                  </>
                ) : (
                  <>
                    {openInvoice.planName && openInvoice.planName !== subscription.plan.name ? (
                      <>
                        Paying this moves the community from {subscription.plan.name} to{' '}
                        <strong className="text-navy-900">{openInvoice.planName}</strong>. Until
                        then nothing changes.
                      </>
                    ) : (
                      <>Invoice {openInvoice.invoiceNumber}, issued {date(openInvoice.issuedAt)}.</>
                    )}
                  </>
                )}
              </p>
              {/* Stated plainly, because it is the promise the whole billing
                  flow rests on. */}
              <p className="mt-2 text-[12px] text-slate-500">
                Rendi never takes this from your wallet automatically — it is paid when an officer
                chooses to.
              </p>
              {cannotAffordInvoice && (
                <p className="mt-2 text-[13px] font-medium text-amber-700">
                  The wallet holds {money(usage.walletBalance!, 'NGN', { decimals: false })} —{' '}
                  {money(
                    String(Number(openInvoice.total) - Number(usage.walletBalance)),
                    openInvoice.currencyCode,
                    { decimals: false },
                  )}{' '}
                  short. Pay by card instead, or top the wallet up first.
                </p>
              )}
            </div>
            <div className="flex shrink-0 flex-col items-stretch gap-2">
              <Button onClick={() => void payOnline.run()} loading={payOnline.pending}>
                Pay by card or transfer
              </Button>
              {/* Only offered when it would actually work — a wallet button
                  that always fails teaches people to ignore the page. */}
              {!cannotAffordInvoice && usage.walletBalance !== null && (
                <Button variant="secondary" onClick={() => void pay.run()} loading={pay.pending}>
                  Pay from wallet
                </Button>
              )}
            </div>
          </div>
        </Card>
      )}

      {subscription?.status === 'PAST_DUE' && !openInvoice && (
        <Callout tone="danger" className="mb-6" title="Payment is overdue">
          Settle the outstanding invoice to keep accounting, loans and your public listing
          available.
        </Callout>
      )}

      {trialDays !== null && trialDays > 0 && subscription?.status === 'TRIALING' && (
        <Callout tone="info" className="mb-6" title={`${trialDays} days left on your trial`}>
          Nothing is charged until the trial ends on {date(subscription.trialEndsAt!)}.
        </Callout>
      )}

      {shortOnWallet && !openInvoice && subscription?.status !== 'PAST_DUE' && (
        <Callout tone="warning" className="mb-6" title="The wallet is short of the next renewal">
          {money(nextCharge!.monthlyPrice, nextCharge!.currencyCode)} falls due on{' '}
          {date(subscription!.currentPeriodEnd)} and the wallet holds{' '}
          {money(usage.walletBalance!, 'NGN')}. Nothing is taken automatically — top it up so you
          can settle the invoice in one go.
        </Callout>
      )}

      {subscription ? (
        <>
          {/* ── The plan itself ─────────────────────────────────────── */}
          <Card className="mb-5 overflow-hidden">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 bg-gradient-to-br from-brand-50/70 to-white px-5 py-5">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-semibold text-navy-900">{subscription.plan.name}</h2>
                  <StatusBadge status={subscription.status.toLowerCase()} />
                  {onBasePlan && <Badge tone="slate">Base plan</Badge>}
                </div>
                {subscription.plan.description && (
                  <p className="mt-1 max-w-prose text-[13px] text-slate-600">
                    {subscription.plan.description}
                  </p>
                )}
              </div>
              <div className="text-right">
                <p className="text-2xl font-semibold text-navy-900">
                  {Number(subscription.plan.monthlyPrice) === 0
                    ? 'Free'
                    : money(subscription.plan.monthlyPrice, subscription.plan.currencyCode, {
                        decimals: false,
                      })}
                </p>
                {Number(subscription.plan.monthlyPrice) > 0 && (
                  <p className="text-xs text-slate-500">per month</p>
                )}
              </div>
            </div>

            {/* The period, and what happens at the end of it. */}
            <div className="px-5 py-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-xs font-semibold tracking-wide text-slate-500">
                  CURRENT PERIOD
                </p>
                <p className="text-[13px] text-slate-600">
                  <strong className="text-navy-900">{daysLeft}</strong>{' '}
                  {daysLeft === 1 ? 'day' : 'days'} left
                </p>
              </div>
              <ProgressBar
                className="mt-2"
                value={periodPct}
                tone={subscription.status === 'PAST_DUE' ? 'red' : daysLeft <= 3 ? 'amber' : 'brand'}
              />
              <div className="mt-1.5 flex justify-between text-[11px] text-slate-400">
                <span>{date(subscription.currentPeriodStart)}</span>
                <span>{date(subscription.currentPeriodEnd)}</span>
              </div>

              <dl className="mt-4 grid gap-4 border-t border-slate-100 pt-4 sm:grid-cols-3">
                <div>
                  <dt className="text-[11px] font-semibold tracking-wide text-slate-500">
                    NEXT INVOICE
                  </dt>
                  <dd className="mt-0.5 text-[13px] font-semibold text-navy-900">
                    {subscription.cancelAtPeriodEnd ? (
                      'None — ending'
                    ) : subscription.status === 'TRIALING' ? (
                      <>
                        {money(subscription.plan.monthlyPrice, subscription.plan.currencyCode, {
                          decimals: false,
                        })}{' '}
                        <span className="font-normal text-slate-500">after the trial</span>
                      </>
                    ) : Number(nextCharge?.monthlyPrice ?? 0) === 0 ? (
                      'Nothing — this plan is free'
                    ) : (
                      <>
                        {money(nextCharge!.monthlyPrice, nextCharge!.currencyCode, {
                          decimals: false,
                        })}{' '}
                        <span className="font-normal text-slate-500">
                          raised {date(subscription.currentPeriodEnd)}
                        </span>
                      </>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] font-semibold tracking-wide text-slate-500">
                    RENEWAL
                  </dt>
                  <dd className="mt-0.5 text-[13px] font-semibold text-navy-900">
                    {subscription.cancelAtPeriodEnd
                      ? 'Cancelled'
                      : subscription.autoRenew
                        ? 'Invoiced each period'
                        : 'Does not renew'}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] font-semibold tracking-wide text-slate-500">
                    BILLED TO
                  </dt>
                  <dd className="mt-0.5 flex items-center gap-1.5 text-[13px] font-semibold text-navy-900">
                    <Wallet className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                    Community wallet
                    {usage.walletBalance !== null && (
                      <span
                        className={cn(
                          'font-normal',
                          shortOnWallet ? 'text-amber-700' : 'text-slate-500',
                        )}
                      >
                        · {money(usage.walletBalance, 'NGN', { decimals: false })}
                      </span>
                    )}
                  </dd>
                </div>
              </dl>
            </div>

            {subscription.pendingPlan && (
              <div className="border-t border-slate-100 bg-blue-50/50 px-5 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-[13px] text-navy-900">
                    Moving to <strong>{subscription.pendingPlan.name}</strong>
                    {subscription.pendingPlan.effectiveAt
                      ? ` on ${date(subscription.pendingPlan.effectiveAt)}`
                      : ' at the next renewal'}
                    . You keep {subscription.plan.name} until then.
                  </p>
                  <Button
                    size="sm"
                    variant="secondary"
                    loading={dropPlanChange.pending}
                    onClick={() => void dropPlanChange.run()}
                  >
                    Stay on {subscription.plan.name}
                  </Button>
                </div>
              </div>
            )}

            {subscription.cancelAtPeriodEnd && (
              <div className="border-t border-slate-100 bg-amber-50/60 px-5 py-4">
                <p className="text-[13px] text-amber-900">
                  Cancelled. The plan runs until {date(subscription.currentPeriodEnd)} and will not
                  renew; after that this community moves to the{' '}
                  {basePlan ? `${basePlan.name} plan` : 'base plan'}. Choosing a plan below undoes
                  it.
                </p>
              </div>
            )}

            {!subscription.cancelAtPeriodEnd && !onBasePlan && (
              <div className="border-t border-slate-100 px-5 py-3">
                <Button size="sm" variant="ghost" onClick={() => setCancelling(true)}>
                  Cancel subscription
                </Button>
              </div>
            )}
          </Card>

          {/* ── Allowances, against what is actually used ────────────── */}
          <Card className="mb-5">
            <CardHeader
              title="Your allowances"
              subtitle="The limits this tier grants, and how much of each you are using"
            />
            <div className="grid gap-5 px-5 py-5 sm:grid-cols-3">
              <Allowance
                icon={<Users className="h-4 w-4" />}
                label="Members"
                used={usage.members}
                limit={entitlements?.maxMembers ?? null}
              />
              <Allowance
                icon={<Sparkles className="h-4 w-4" />}
                label="Ajo groups"
                used={usage.ajoGroups}
                limit={entitlements?.maxAjoGroups ?? null}
              />
              {/* Staff seats carry no cheap live count, so the allowance is
                  stated without a usage bar rather than guessed at. */}
              <div>
                <div className="flex items-center gap-2 text-[13px] font-semibold text-navy-900">
                  <span className="text-slate-400">
                    <CreditCard className="h-4 w-4" />
                  </span>
                  Staff seats
                </div>
                <p className="mt-2 text-xl font-semibold tabular-nums text-navy-900">
                  {limitLabel(entitlements?.maxStaffSeats ?? null)}
                </p>
                <p className="mt-1 text-[11px] text-slate-500">
                  Officers who can sign in beyond ordinary members
                </p>
              </div>
            </div>
          </Card>

          {/* ── Everything the tier includes, and what it does not ───── */}
          <Card className="mb-6">
            <CardHeader
              title="What your plan includes"
              subtitle={
                totalFeatures > 0
                  ? `${includedCount} of ${totalFeatures} Rendi features are on your tier`
                  : undefined
              }
              action={
                entitlements?.allowsApiAccess ? <Badge tone="green">API access</Badge> : undefined
              }
            />
            <div className="divide-y divide-slate-100">
              {featureMatrix.map(([group, rows]) => (
                <div key={group} className="px-5 py-4">
                  <p className="text-[11px] font-semibold tracking-wide text-slate-500">
                    {group.toUpperCase()}
                  </p>
                  <ul className="mt-2.5 grid gap-x-6 gap-y-2 sm:grid-cols-2">
                    {rows.map((feature) => (
                      <li key={feature.slug} className="flex items-start gap-2">
                        {feature.included ? (
                          <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-600" />
                        ) : (
                          <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-300" />
                        )}
                        <span className="min-w-0">
                          <span
                            className={cn(
                              'block text-[13px]',
                              feature.included ? 'text-slate-700' : 'text-slate-400',
                            )}
                            title={feature.description}
                          >
                            {feature.label}
                          </span>
                          {!feature.included && feature.upgradeTo && (
                            <span className="text-[11px] text-slate-400">
                              on {feature.upgradeTo}
                            </span>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              {featureMatrix.length === 0 && (
                <p className="px-5 py-6 text-[13px] text-slate-500">
                  No feature catalogue is published yet.
                </p>
              )}
            </div>
          </Card>
        </>
      ) : (
        <Callout tone="warning" className="mb-6" title="No active subscription">
          Every community is on a plan — choose one below to restore yours.
        </Callout>
      )}

      {/* ── The other tiers ───────────────────────────────────────── */}
      <h2 className="mb-3 text-[15px] font-semibold text-navy-900">
        {subscription ? 'Change your plan' : 'Plans'}
      </h2>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {plans.length === 0 ? (
          <Card className="lg:col-span-4 md:col-span-2">
            <EmptyState
              icon={<CreditCard className="h-5 w-5" />}
              title="No plans published"
              body="Rendi has not published subscription plans yet."
            />
          </Card>
        ) : (
          plans.map((p) => {
            const current = subscription?.plan.id === p.id;
            const scheduled = subscription?.pendingPlan?.id === p.id;
            return (
              <Card
                key={p.id}
                className={cn('flex flex-col', current && 'ring-2 ring-brand-500')}
              >
                <div className="flex flex-1 flex-col px-5 py-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[15px] font-semibold text-navy-900">{p.name}</p>
                    {current && <Badge tone="green">Current</Badge>}
                    {scheduled && <Badge tone="blue">From next renewal</Badge>}
                  </div>

                  {p.isNegotiated ? (
                    <>
                      <p className="mt-2 text-2xl font-semibold text-navy-900">Custom</p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        Priced for your cooperative, agreed with Rendi
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="mt-2 text-2xl font-semibold text-navy-900">
                        {Number(p.monthlyPrice) === 0
                          ? 'Free'
                          : money(p.monthlyPrice, p.currencyCode, { decimals: false })}
                        {Number(p.monthlyPrice) > 0 && (
                          <span className="text-sm font-normal text-slate-500"> /month</span>
                        )}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {Number(p.monthlyPrice) === 0
                          ? 'The plan every community starts on'
                          : `or ${money(p.annualPrice, p.currencyCode, { decimals: false })} a year`}
                      </p>
                      {/* A trial is the single most persuasive thing a plan
                          card can say, and it was a bullet three lines down
                          among the limits. */}
                      {p.trialDays > 0 && (
                        <p className="mt-2 inline-block rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                          Free for your first {p.trialDays} days
                        </p>
                      )}
                    </>
                  )}

                  {p.description && (
                    <p className="mt-3 text-[13px] text-slate-600">{p.description}</p>
                  )}

                  {/* Limits first: they are what an officer compares across
                      tiers, and the feature list above already covers the
                      detail for the plan they are on. */}
                  <ul className="mt-4 space-y-1.5">
                    <Feature>{limitLabel(p.maxMembers)} members</Feature>
                    <Feature>{limitLabel(p.maxStaffSeats)} staff seats</Feature>
                    <Feature>{limitLabel(p.maxAjoGroups)} Ajo groups</Feature>
                    <Feature>
                      {p.featureDetails.length} feature
                      {p.featureDetails.length === 1 ? '' : 's'}
                      {p.allowsApiAccess ? ' · API access' : ''}
                    </Feature>
                  </ul>

                  <div className="flex-1" />

                  {p.isNegotiated ? (
                    <Button
                      block
                      className="mt-5"
                      variant={current ? 'secondary' : 'primary'}
                      disabled={current}
                      onClick={() => setEnquiring(p)}
                    >
                      {current ? 'Current plan' : 'Contact support'}
                    </Button>
                  ) : (
                    <Button
                      block
                      className="mt-5"
                      variant={current ? 'secondary' : 'primary'}
                      disabled={current || scheduled}
                      loading={changePlan.pending && choosing?.id === p.id}
                      onClick={() => setChoosing(p)}
                    >
                      {current
                        ? 'Current plan'
                        : scheduled
                          ? 'Scheduled'
                          : !subscription
                            ? 'Choose this plan'
                            : isDowngrade(p)
                              ? 'Move down at renewal'
                              : 'Upgrade'}
                    </Button>
                  )}
                </div>
              </Card>
            );
          })
        )}
      </div>

      {subscription?.invoices && subscription.invoices.length > 0 && (
        <Card className="mt-6">
          <CardHeader title="Invoices" subtitle="Every charge Rendi has raised for this community" />
          <DataTable
            rows={subscription.invoices}
            rowKey={(i) => i.id}
            columns={[
              { key: 'number', header: 'Invoice', cell: (i) => i.invoiceNumber },
              { key: 'issued', header: 'Issued', cell: (i) => date(i.issuedAt) },
              { key: 'due', header: 'Due', hideOnMobile: true, cell: (i) => date(i.dueAt) },
              {
                key: 'total',
                header: 'Total',
                align: 'right',
                cell: (i) => money(i.total, i.currencyCode),
              },
              { key: 'status', header: 'Status', cell: (i) => <StatusBadge status={i.status.toLowerCase()} /> },
            ]}
            empty={<EmptyState compact icon={<Receipt className="h-5 w-5" />} title="No invoices yet" />}
          />
        </Card>
      )}

      {/* The owner's approval code, prompted when the wallet is the source. */}
      <MoneyOutOtpDialog gate={pay} />

      <ConfirmDialog
        open={Boolean(choosing)}
        onClose={() => setChoosing(null)}
        title={`Switch to ${choosing?.name ?? ''}?`}
        confirmLabel={
          subscription && choosing && isDowngrade(choosing)
            ? 'Schedule the change'
            : subscription?.status === 'TRIALING'
              ? 'Confirm plan'
              : choosing && choosing.trialDays > 0
                ? `Start the ${choosing.trialDays}-day trial`
                : choosing && walletCovers(choosing)
                  ? 'Pay and upgrade'
                  : 'Raise the invoice'
        }
        loading={checkout.pending || changePlan.pending}
        onConfirm={() => {
          if (!choosing) return;
          // Checkout opens a subscription; changePlan moves one that exists.
          // Sending a change through checkout is what produced "this
          // community already has an active subscription".
          if (subscription) void changePlan.run(choosing.id);
          else void checkout.run(choosing.id);
        }}
        body={
          !subscription ? (
            <>
              {money(choosing?.monthlyPrice ?? '0', choosing?.currencyCode)} a month, charged to
              this community&apos;s Rendi wallet.
              {choosing?.trialDays ? ` The first ${choosing.trialDays} days are free.` : ''}
            </>
          ) : choosing && isDowngrade(choosing) ? (
            <>
              You keep {subscription.plan.name} until{' '}
              {date(subscription.currentPeriodEnd)} — the period you have already paid for — and
              move to {choosing.name} at{' '}
              {money(choosing.monthlyPrice, choosing.currencyCode)} a month from then. Nothing is
              charged today, and you can drop the change any time before it takes effect.
            </>
          ) : subscription.status === 'TRIALING' ? (
            <>
              {choosing?.name} applies straight away — you are inside a trial, so nothing is owed
              until it ends. The first invoice is {money(choosing?.monthlyPrice ?? '0', choosing?.currencyCode)}.
            </>
          ) : choosing && choosing.trialDays > 0 ? (
            <>
              {choosing.name} is <strong>free for {choosing.trialDays} days</strong>. Nothing is
              owed today — the first invoice for{' '}
              {money(choosing.monthlyPrice, choosing.currencyCode)} is raised when the trial ends,
              and you can change or cancel before then.
            </>
          ) : walletCovers(choosing) ? (
            <>
              <strong>{money(choosing?.monthlyPrice ?? '0', choosing?.currencyCode)}</strong> will be
              paid from the community wallet now, and {choosing?.name} starts as soon as it clears.
              The wallet holds {money(usage.walletBalance ?? '0', 'NGN', { decimals: false })}.
            </>
          ) : (
            <>
              This raises an invoice for{' '}
              <strong>{money(choosing?.monthlyPrice ?? '0', choosing?.currencyCode)}</strong>.{' '}
              <strong>{choosing?.name} starts once it is paid</strong> — you can settle it by card
              or transfer on the next screen. Until then this community stays on{' '}
              {subscription.plan.name}.
            </>
          )
        }
      />

      <ConfirmDialog
        open={Boolean(enquiring)}
        onClose={() => setEnquiring(null)}
        title={`Talk to Rendi about ${enquiring?.name ?? 'Enterprise'}`}
        confirmLabel="Send request"
        loading={enquire.pending}
        onConfirm={() => void enquire.run(enquiryMessage)}
        body={
          <div className="space-y-3">
            <p>
              {enquiring?.name ?? 'Enterprise'} is priced for your cooperative and agreed with
              Rendi directly. Send a request and the team will reach out on the community&apos;s
              official email — you&apos;ll get a support ticket reference to follow it with.
            </p>
            <label className="block text-xs font-semibold text-slate-600">
              Anything that helps scope it (optional)
              <textarea
                rows={3}
                value={enquiryMessage}
                onChange={(event) => setEnquiryMessage(event.target.value)}
                placeholder="Member numbers, branches, timelines…"
                className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-sm font-normal outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </label>
          </div>
        }
      />

      <ConfirmDialog
        open={cancelling}
        onClose={() => setCancelling(false)}
        title="Cancel the subscription?"
        confirmLabel="Cancel subscription"
        tone="danger"
        requireReason
        reasonLabel="Why are you cancelling?"
        loading={cancel.pending}
        onConfirm={(reason) => void cancel.run(reason)}
        body={
          <div className="space-y-3">
            <p>
              Your records are never deleted. The community moves to the{' '}
              {basePlan ? `${basePlan.name} plan` : 'base plan'} — every community stays on a plan —
              and can upgrade again any time.
            </p>
            <div className="space-y-2">
              <label className="flex items-start gap-2.5 rounded-xl border border-slate-200 p-3">
                <input
                  type="radio"
                  className="mt-1"
                  checked={!cancelNow}
                  onChange={() => setCancelNow(false)}
                />
                <span className="text-[13px]">
                  <span className="font-semibold text-navy-900">
                    At the end of the paid period
                  </span>
                  <span className="block text-slate-600">
                    Everything keeps working until{' '}
                    {subscription ? date(subscription.currentPeriodEnd) : 'the period ends'}, then
                    it stops renewing. Nothing further is charged.
                  </span>
                </span>
              </label>
              <label className="flex items-start gap-2.5 rounded-xl border border-slate-200 p-3">
                <input
                  type="radio"
                  className="mt-1"
                  checked={cancelNow}
                  onChange={() => setCancelNow(true)}
                />
                <span className="text-[13px]">
                  <span className="font-semibold text-navy-900">Immediately</span>
                  <span className="block text-slate-600">
                    The plan ends today. The rest of the period you have paid for is not
                    refunded, and officers lose the plan&apos;s limits at once.
                  </span>
                </span>
              </label>
            </div>
          </div>
        }
      />
    </>
  );
}

/**
 * One allowance, with how much of it is gone.
 *
 * An unlimited allowance gets no bar: a progress bar against infinity is a
 * decoration that implies a ceiling which does not exist.
 */
function Allowance({
  icon,
  label,
  used,
  limit,
}: {
  icon: React.ReactNode;
  label: string;
  used: number;
  limit: number | null;
}) {
  const pct = limit === null || limit === 0 ? 0 : (used / limit) * 100;
  const full = limit !== null && used >= limit;
  const nearly = !full && pct >= 80;

  return (
    <div>
      <div className="flex items-center gap-2 text-[13px] font-semibold text-navy-900">
        <span className="text-slate-400">{icon}</span>
        {label}
      </div>
      <p className="mt-2 text-xl font-semibold tabular-nums text-navy-900">
        {num(used)}
        <span className="text-sm font-normal text-slate-500">
          {limit === null ? ' used · unlimited' : ` of ${num(limit)}`}
        </span>
      </p>
      {limit !== null && (
        <>
          <ProgressBar
            className="mt-2"
            value={pct}
            tone={full ? 'red' : nearly ? 'amber' : 'brand'}
          />
          <p
            className={cn(
              'mt-1 text-[11px]',
              full ? 'font-semibold text-red-600' : nearly ? 'text-amber-700' : 'text-slate-500',
            )}
          >
            {full
              ? 'Limit reached — upgrade to add more'
              : `${num(limit - used)} remaining`}
          </p>
        </>
      )}
    </div>
  );
}

function Feature({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2 text-[13px] text-slate-600">
      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-600" />
      {children}
    </li>
  );
}
