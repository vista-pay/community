'use client';

import { useMemo, useState } from 'react';
import { Check, CreditCard, Receipt, Wallet } from 'lucide-react';
import {
  Badge,
  Button,
  Callout,
  Card,
  CardHeader,
  ConfirmDialog,
  DataTable,
  EmptyState,
  KV,
  PageHeader,
  StatusBadge,
} from '@/components/ui';
import { useMutation } from '@/hooks/use-query';
import { useCommunityId } from '@/components/providers/session-provider';
import { useToast } from '@/components/providers/toast-provider';
import { portalApi } from '@/services/portal';
import { date, daysUntil, humanise, money } from '@/lib/format';
import type { Subscription, SubscriptionPlan } from '@/types';

export function BillingClient({
  plans,
  subscription,
}: {
  plans: SubscriptionPlan[];
  subscription: Subscription | null;
}) {
  const communityId = useCommunityId();
  const { toast } = useToast();
  const [choosing, setChoosing] = useState<SubscriptionPlan | null>(null);
  const [cancelling, setCancelling] = useState(false);
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
            ? 'The plan has ended and this community is back to the free allowance.'
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

  /** Cheaper than what they are on today: it waits for the paid period. */
  const isDowngrade = (plan: SubscriptionPlan) =>
    Boolean(subscription) && Number(plan.monthlyPrice) < Number(subscription!.plan.monthlyPrice);

  const trialDays = subscription?.trialEndsAt ? daysUntil(subscription.trialEndsAt) : null;

  return (
    <>
      <PageHeader title="Billing & plan" subtitle="What Rendi charges this community" />

      {subscription?.status === 'PAST_DUE' && (
        <Callout tone="danger" className="mb-6" title="Payment is overdue">
          Settle the outstanding invoice to keep accounting, loans and your public listing
          available.
        </Callout>
      )}

      {trialDays !== null && trialDays > 0 && subscription?.status === 'TRIALING' && (
        <Callout tone="info" className="mb-6" title={`${trialDays} days left on your trial`}>
          Choose a plan before the trial ends to keep everything running.
        </Callout>
      )}

      {subscription ? (
        <Card className="mb-6">
          <CardHeader
            title={subscription.plan.name}
            subtitle={subscription.plan.description ?? undefined}
            action={<StatusBadge status={subscription.status.toLowerCase()} />}
          />
          <dl className="grid gap-4 px-5 py-4 sm:grid-cols-4">
            <KV label="Billing">
              {humanise(subscription.billingPeriod)} ·{' '}
              {money(
                subscription.billingPeriod === 'ANNUAL'
                  ? subscription.plan.annualPrice
                  : subscription.plan.monthlyPrice,
                subscription.plan.currencyCode,
              )}
            </KV>
            <KV label="Current period">
              {date(subscription.currentPeriodStart)} – {date(subscription.currentPeriodEnd)}
            </KV>
            {/* The entitlements in force for the period that was billed —
                not the plan as an administrator may since have edited it. */}
            <KV label="Member limit">
              {subscription.entitlements.maxMembers > 100000
                ? 'Unlimited'
                : subscription.entitlements.maxMembers}
            </KV>
            <KV label="Staff seats">
              {subscription.entitlements.maxStaffSeats > 1000
                ? 'Unlimited'
                : subscription.entitlements.maxStaffSeats}
            </KV>
          </dl>

          {/* What this community is actually paying for. Listing the plan's
              price without its features leaves an officer unable to judge
              whether it is worth it, or what they would lose by moving. */}
          {subscription.plan.featureDetails.length > 0 && (
            <div className="border-t border-slate-100 px-5 py-4">
              <p className="mb-2 text-xs font-semibold tracking-wide text-slate-500">
                INCLUDED IN THIS PLAN
              </p>
              <ul className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                {subscription.plan.featureDetails.map((f) => (
                  <Feature key={f.slug}>
                    <span title={f.description}>{f.label}</span>
                  </Feature>
                ))}
                {subscription.entitlements.allowsApiAccess && <Feature>API access</Feature>}
              </ul>
            </div>
          )}

          <div className="flex items-start gap-2.5 border-t border-slate-100 px-5 py-4">
            <Wallet className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
            <p className="text-[13px] leading-relaxed text-slate-600">
              {subscription.billedTo.description}
            </p>
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
                renew; after that this community falls back to the free allowance. Choosing a plan
                below undoes it.
              </p>
            </div>
          )}

          {!subscription.cancelAtPeriodEnd && (
            <div className="border-t border-slate-100 px-5 py-3">
              <Button size="sm" variant="ghost" onClick={() => setCancelling(true)}>
                Cancel subscription
              </Button>
            </div>
          )}
        </Card>
      ) : (
        <Callout tone="warning" className="mb-6" title="No active subscription">
          Choose a plan below to keep the portal available to your officers.
        </Callout>
      )}

      <h2 className="mb-3 text-[15px] font-semibold text-navy-900">Plans</h2>
      <div className="grid gap-4 md:grid-cols-3">
        {plans.length === 0 ? (
          <Card className="md:col-span-3">
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
              <Card key={p.id} className={current ? 'ring-2 ring-brand-500' : undefined}>
                <div className="px-5 py-4">
                  <div className="flex items-center justify-between">
                    <p className="text-[15px] font-semibold text-navy-900">{p.name}</p>
                    {current && <Badge tone="green">Current</Badge>}
                    {scheduled && <Badge tone="blue">From next renewal</Badge>}
                  </div>
                  <p className="mt-2 text-2xl font-semibold text-navy-900">
                    {money(p.monthlyPrice, p.currencyCode, { decimals: false })}
                    <span className="text-sm font-normal text-slate-500"> /month</span>
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    or {money(p.annualPrice, p.currencyCode, { decimals: false })} a year
                  </p>

                  {p.description && (
                    <p className="mt-3 text-[13px] text-slate-600">{p.description}</p>
                  )}

                  <ul className="mt-4 space-y-1.5">
                    <Feature>
                      {p.maxMembers ? `Up to ${p.maxMembers} members` : 'Unlimited members'}
                    </Feature>
                    <Feature>
                      {p.maxStaffSeats ? `${p.maxStaffSeats} staff seats` : 'Unlimited staff'}
                    </Feature>
                    <Feature>
                      {p.maxAjoGroups ? `${p.maxAjoGroups} Ajo groups` : 'Unlimited Ajo groups'}
                    </Feature>
                    {p.trialDays > 0 && (
                      <Feature>{p.trialDays}-day free trial</Feature>
                    )}
                    {/* The catalogue's own label and description, not a
                        de-underscored slug. The description is the title so
                        hovering explains a bullet without crowding the card. */}
                    {p.featureDetails.map((f) => (
                      <Feature key={f.slug}>
                        <span title={f.description}>{f.label}</span>
                      </Feature>
                    ))}
                    {p.allowsApiAccess && <Feature>API access</Feature>}
                  </ul>

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
                            : 'Upgrade now'}
                  </Button>
                </div>
              </Card>
            );
          })
        )}
      </div>

      {subscription?.invoices && subscription.invoices.length > 0 && (
        <Card className="mt-6">
          <CardHeader title="Invoices" />
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

      <ConfirmDialog
        open={Boolean(choosing)}
        onClose={() => setChoosing(null)}
        title={`Switch to ${choosing?.name ?? ''}?`}
        confirmLabel={
          subscription && choosing && isDowngrade(choosing) ? 'Schedule the change' : 'Confirm plan'
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
          ) : (
            <>
              {choosing?.name} starts today at{' '}
              {money(choosing?.monthlyPrice ?? '0', choosing?.currencyCode)} a month, charged to
              this community&apos;s Rendi wallet.
              {subscription.status === 'TRIALING'
                ? ' Your trial continues, so nothing is charged until it ends.'
                : ''}
            </>
          )
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
              Your records are never deleted. The community falls back to the free allowance —
              25 members, 2 staff seats, one contribution group — until it subscribes again.
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

function Feature({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2 text-[13px] text-slate-600">
      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-600" />
      {children}
    </li>
  );
}
