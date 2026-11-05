'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  BadgeCheck,
  Check,
  Copy,
  FileText,
  Landmark,
  Link2,
} from 'lucide-react';
import {
  Callout,
  PageHeader,
  Stat,
} from '@/components/ui';
import { useCommunityId } from '@/components/providers/session-provider';
import { useQuery } from '@/hooks/use-query';
import { portalApi } from '@/services/portal';
import type { MerchantOverview } from '@/types';

export function MerchantClient({ initial }: { initial: MerchantOverview }) {
  const communityId = useCommunityId();
  const { data } = useQuery<MerchantOverview>(
    () => portalApi.merchantOverview(communityId),
    [communityId],
    { initial },
  );

  const d = data ?? initial;
  const [copied, setCopied] = useState(false);
  function copyAccountNumber() {
    if (!d.collectionAccount) return;
    void navigator.clipboard.writeText(d.collectionAccount.accountNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <>
      <PageHeader
        title="Merchant account"
        subtitle="This community collects money in its own name — from members, and from anyone it bills"
      />

      {/* What is still outstanding, in order. The sequence is not obvious:
          registration needs a bank account that is unknown at verification. */}
      {d.outstanding.length > 0 && (
        <Callout tone="warning" title="Worth finishing" className="mb-6">
          <ol className="ml-4 list-decimal space-y-1">
            {d.outstanding.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </Callout>
      )}

      {/* The collection account — what members are actually told to pay into */}
      <div className="mb-6 overflow-hidden rounded-2xl bg-navy-900 text-white">
        <div className="flex flex-col gap-6 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
          <div className="max-w-md">
            <p className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wider text-white/60">
              <Landmark className="h-4 w-4" /> Merchant collection account
            </p>
            <h2 className="mt-2 text-lg font-bold">{d.community.name}</h2>
            <p className="mt-1 text-[13px] leading-5 text-white/70">
              A transfer from any Nigerian bank credits the community wallet automatically. The
              account answers to the community&rsquo;s own name, not an officer&rsquo;s.
            </p>
            {d.walletNumber && (
              <p className="mt-3 text-[12px] text-white/50">
                Wallet <span className="tnum font-semibold text-white/70">{d.walletNumber}</span>
              </p>
            )}
          </div>

          {d.collectionAccount ? (
            <div className="shrink-0 rounded-2xl bg-white/10 p-5 ring-1 ring-white/15 backdrop-blur">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-white/60">
                {d.collectionAccount.bankName}
              </p>
              <div className="mt-1 flex items-center gap-3">
                <p className="tnum text-[26px] font-bold tracking-wide">
                  {d.collectionAccount.accountNumber}
                </p>
                <button
                  type="button"
                  onClick={copyAccountNumber}
                  aria-label="Copy account number"
                  className="flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1.5 text-[12px] font-bold text-navy-900 transition hover:bg-slate-100"
                >
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
              <p className="mt-1 text-[13px] font-medium text-white/80">
                {d.collectionAccount.accountName}
              </p>
              {/* A dev stub is not a bank account. Saying so prevents an
                  officer circulating ten digits that collect nothing. */}
              {d.collectionAccount.isTestAccount && (
                <p className="mt-2 rounded-lg bg-amber-400/20 px-2 py-1 text-[11px] font-semibold text-amber-200">
                  Test account — do not share with members
                </p>
              )}
            </div>
          ) : (
            <div className="shrink-0 rounded-2xl border border-dashed border-white/30 bg-white/5 px-5 py-4 text-[13px] text-white/70">
              The account number is being set up —<br /> it appears here shortly after verification.
            </div>
          )}
        </div>
      </div>

      {/* Merchant status + what the desk holds. Only what the backend can
          actually do: the collection account, payment links and invoices. */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Stat
          label="Account type"
          value={d.merchant.isMerchant ? 'Merchant' : 'Not a merchant'}
          hint={
            d.merchant.canCollect
              ? 'Collects in the community’s own name — the same kind of account a business holds'
              : 'Verification is what unlocks collecting'
          }
          icon={<BadgeCheck className="h-4 w-4" />}
          tone={d.merchant.isMerchant && d.merchant.canCollect ? 'positive' : 'warning'}
          footer={
            <span className="text-slate-500">
              Wallet classified {d.merchant.accountType ?? 'unknown'}
            </span>
          }
        />
        <Stat
          label="Payment links"
          value={d.counts.paymentLinks}
          hint="Shareable requests that credit the wallet"
          icon={<Link2 className="h-4 w-4" />}
          footer={
            <Link href="/merchant/payment-links" className="font-semibold text-brand-700">
              Manage links
            </Link>
          }
        />
        <Stat
          label="Invoices"
          value={d.counts.invoices}
          hint="Issued in the community’s name"
          icon={<FileText className="h-4 w-4" />}
          footer={
            <Link href="/merchant/invoices" className="font-semibold text-brand-700">
              Manage invoices
            </Link>
          }
        />
        {/* Integrations tile hidden with the API-key and webhook pages: a key
            authenticates nothing and no endpoint is ever called, so a count of
            them told an officer they had working integrations. Restore this
            alongside the two nav entries in app-shell.tsx.
        <Stat
          label="Integrations"
          value={`${d.counts.apiKeys} / ${d.counts.webhooks}`}
          hint="Active API keys / webhook endpoints"
          icon={<KeyRound className="h-4 w-4" />}
          footer={
            <span className="flex gap-3">
              <Link href="/merchant/api-keys" className="font-semibold text-brand-700">API keys</Link>
              <Link href="/merchant/webhooks" className="font-semibold text-brand-700">Webhooks</Link>
            </span>
          }
        />
        */}
      </div>

      {/* Settlement accounts — intentionally not rendered yet.

          Nothing consumes one for a community: WithdrawalsService handles
          personal and business wallets only, and its allowlist check is gated
          on businessId, so there is no community-to-bank payout path for the
          details to feed. Asking an officer for a bank account that no code
          reads is the same mistake the removed Paystack subaccount made.

          The component is real, typed and linted in ./settlement-accounts —
          re-enable by importing SettlementAccountsCard and uncommenting:

          <SettlementAccountsCard
            accounts={d.settlementAccounts}
            onChanged={refresh}   // destructure `refresh` from useQuery above
          />
      */}
    </>
  );
}
