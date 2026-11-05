'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowDownLeft, ArrowUpRight, Check, Copy, Landmark, ReceiptText, Wallet } from 'lucide-react';
import {
  Card,
  CardHeader,
  DataTable,
  EmptyState,
  PageHeader,
  Stat,
  StatusBadge,
} from '@/components/ui';
import { useQuery } from '@/hooks/use-query';
import { useCommunityId } from '@/components/providers/session-provider';
import { portalApi } from '@/services/portal';
import { date, humanise, money } from '@/lib/format';
import { isZeroMoney } from '@/lib/money';
import type { WalletData, WalletTransaction } from '@/types';

const TYPE_LABELS: Record<string, string> = {
  DEPOSIT: 'Bank deposit',
  COMMUNITY_DUES: 'Monthly dues',
  COMMUNITY_CONTRIBUTION: 'Contribution',
  WELFARE_PAYOUT: 'Welfare payout',
  SUBSCRIPTION: 'Subscription',
  ORGANIZER_FEE_SETTLEMENT: 'Organizer fee settlement',
  TRANSFER: 'Transfer',
  REVERSAL: 'Reversal',
  ADJUSTMENT: 'Adjustment',
};

function typeLabel(t: WalletTransaction) {
  return TYPE_LABELS[t.type] ?? humanise(t.type);
}

export function WalletClient({ initial }: { initial: WalletData }) {
  const communityId = useCommunityId();
  const { data } = useQuery<WalletData>(() => portalApi.wallet(communityId), [communityId], {
    initial,
  });
  const [copied, setCopied] = useState(false);

  const d = data ?? initial;
  const ngn = d.wallet?.accounts.find((a) => a.currencyCode === 'NGN') ?? d.wallet?.accounts[0];
  const depositAccount = d.wallet?.depositAccount ?? null;

  function copyAccountNumber() {
    if (!depositAccount) return;
    void navigator.clipboard.writeText(depositAccount.accountNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <>
      <PageHeader
        title="Wallet"
        subtitle="The community's own money: fund it by bank transfer, spend it on loans and welfare"
      />

      {/* Deposit account — the headline of this page, not a corner of another */}
      <div className="mb-6 overflow-hidden rounded-2xl bg-navy-900 text-white">
        <div className="flex flex-col gap-6 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
          <div className="max-w-md">
            <p className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wider text-white/60">
              <Landmark className="h-4 w-4" /> Merchant account
            </p>
            <h2 className="mt-2 text-lg font-bold">Fund the wallet by bank transfer</h2>
            <p className="mt-1 text-[13px] leading-5 text-white/70">
              A transfer from any Nigerian bank to this account credits the wallet automatically —
              share it with members for dues, levies and donations. It is a merchant account in the
              community&rsquo;s own name, not a personal one.
            </p>
            <Link
              href="/merchant"
              className="mt-3 inline-block text-[13px] font-semibold text-white/80 underline-offset-4 hover:underline"
            >
              Merchant settings
            </Link>
          </div>

          {depositAccount ? (
            <div className="shrink-0 rounded-2xl bg-white/10 p-5 ring-1 ring-white/15 backdrop-blur">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-white/60">
                {depositAccount.bankName}
              </p>
              <div className="mt-1 flex items-center gap-3">
                <p className="tnum text-[26px] font-bold tracking-wide">
                  {depositAccount.accountNumber}
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
              <p className="mt-1 text-[13px] font-medium text-white/80">{depositAccount.accountName}</p>
            </div>
          ) : (
            <div className="shrink-0 rounded-2xl border border-dashed border-white/30 bg-white/5 px-5 py-4 text-[13px] text-white/70">
              Your dedicated account is being set up —<br /> it appears here shortly after verification.
            </div>
          )}
        </div>
      </div>

      {/* Balances */}
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat
          label="Available"
          value={ngn ? money(ngn.available, ngn.currencyCode) : '—'}
          hint="Spendable now — loans and welfare pay from this"
          icon={<Wallet className="h-4 w-4" />}
        />
        <Stat
          label="Pending"
          value={ngn ? money(ngn.pending, ngn.currencyCode) : '—'}
          hint="Arriving, not yet settled"
          icon={<ArrowDownLeft className="h-4 w-4" />}
        />
        <Stat
          label="Held"
          value={ngn ? money(ngn.held, ngn.currencyCode) : '—'}
          hint={ngn && !isZeroMoney(ngn.held) ? 'Reserved against payouts in flight' : 'Nothing reserved'}
          icon={<ArrowUpRight className="h-4 w-4" />}
        />
      </div>

      {/* History */}
      <Card>
        <CardHeader
          title="Transactions"
          subtitle="Every movement in or out of the community wallet"
        />
        <DataTable
          rows={d.transactions}
          rowKey={(t) => t.id}
          columns={[
            {
              key: 'what',
              header: 'Transaction',
              cell: (t) => (
                <div className="flex items-center gap-3">
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                      t.credit ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {t.credit ? (
                      <ArrowDownLeft className="h-4 w-4" />
                    ) : (
                      <ArrowUpRight className="h-4 w-4" />
                    )}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium text-navy-900">{typeLabel(t)}</p>
                    {(t.counterparty || t.narration) && (
                      <p className="truncate text-xs text-slate-500">
                        {t.counterparty ?? t.narration}
                      </p>
                    )}
                  </div>
                </div>
              ),
            },
            {
              key: 'reference',
              header: 'Reference',
              hideOnMobile: true,
              cell: (t) => <span className="font-mono text-xs text-slate-500">{t.reference}</span>,
            },
            {
              key: 'status',
              header: 'Status',
              hideOnMobile: true,
              cell: (t) => <StatusBadge status={t.status.toLowerCase()} />,
            },
            {
              key: 'date',
              header: 'Date',
              hideOnMobile: true,
              cell: (t) => <span className="text-slate-500">{date(t.createdAt)}</span>,
            },
            {
              key: 'amount',
              header: 'Amount',
              align: 'right',
              cell: (t) => (
                <span
                  className={`tnum text-[13px] font-semibold ${
                    t.credit ? 'text-emerald-600' : 'text-navy-900'
                  }`}
                >
                  {t.credit ? '+' : '−'}
                  {money(t.amount, t.currencyCode)}
                </span>
              ),
            },
          ]}
          empty={
            <EmptyState
              icon={<ReceiptText className="h-5 w-5" />}
              title="No transactions yet"
              body="Dues, contributions and bank transfers into the deposit account will appear here."
            />
          }
        />
      </Card>
    </>
  );
}
