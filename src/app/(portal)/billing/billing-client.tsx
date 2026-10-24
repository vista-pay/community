'use client';

import { useState } from 'react';
import { Check, CreditCard, Receipt } from 'lucide-react';
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

  const checkout = useMutation((planId: string) => portalApi.checkout(communityId, planId), {
    onSuccess: () => {
      toast('Plan changed', 'success');
      setChoosing(null);
      window.location.reload();
    },
    onError: (message) => toast('Could not change the plan', 'error', message),
  });

  const cancel = useMutation(
    (reason: string) => portalApi.cancelSubscription(subscription!.id, reason),
    {
      onSuccess: () => {
        toast('Subscription cancelled', 'info');
        setCancelling(false);
        window.location.reload();
      },
      onError: (message) => toast('Could not cancel', 'error', message),
    },
  );

  const trialDays = subscription?.trialEndsAt ? daysUntil(subscription.trialEndsAt) : null;

  return (
    <>
      <PageHeader title="Billing & plan" subtitle="What Vista charges this community" />

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
            <KV label="Member limit">{subscription.plan.maxMembers ?? 'Unlimited'}</KV>
            <KV label="Staff seats">{subscription.plan.maxStaffSeats ?? 'Unlimited'}</KV>
          </dl>
          <div className="border-t border-slate-100 px-5 py-3">
            <Button size="sm" variant="ghost" onClick={() => setCancelling(true)}>
              Cancel subscription
            </Button>
          </div>
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
              body="Vista has not published subscription plans yet."
            />
          </Card>
        ) : (
          plans.map((p) => {
            const current = subscription?.plan.id === p.id;
            return (
              <Card key={p.id} className={current ? 'ring-2 ring-brand-500' : undefined}>
                <div className="px-5 py-4">
                  <div className="flex items-center justify-between">
                    <p className="text-[15px] font-semibold text-navy-900">{p.name}</p>
                    {current && <Badge tone="green">Current</Badge>}
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
                    {p.features.map((f) => (
                      <Feature key={f}>{humanise(f)}</Feature>
                    ))}
                  </ul>

                  <Button
                    block
                    className="mt-5"
                    variant={current ? 'secondary' : 'primary'}
                    disabled={current}
                    onClick={() => setChoosing(p)}
                  >
                    {current ? 'Current plan' : 'Choose this plan'}
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
        confirmLabel="Confirm plan"
        loading={checkout.pending}
        onConfirm={() => choosing && void checkout.run(choosing.id)}
        body={
          <>
            Billing changes to {money(choosing?.monthlyPrice ?? '0', choosing?.currencyCode)} a
            month from the start of the next period.
          </>
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
          <>
            The portal stays available until {subscription ? date(subscription.currentPeriodEnd) : 'the end of the period'}.
            Your records are not deleted.
          </>
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
