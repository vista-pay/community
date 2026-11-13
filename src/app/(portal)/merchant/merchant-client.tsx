'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowDownLeft,
  ArrowUpRight,
  BadgeCheck,
  BookOpen,
  Check,
  Copy,
  FileText,
  Landmark,
  Link2,
  PiggyBank,
  Receipt,
  Send,
  Users,
  Wallet as WalletIcon,
} from 'lucide-react';
import {
  Badge,
  Button,
  Callout,
  Card,
  CardHeader,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Segmented,
  Stat,
} from '@/components/ui';
import { AreaTrend, Bars, C, Donut, Legendary } from '@/components/charts/Charts';
import { useCommunityId } from '@/components/providers/session-provider';
import { useQuery } from '@/hooks/use-query';
import { portalApi } from '@/services/portal';
import { date, humanise, money, num } from '@/lib/format';
import { isZeroMoney } from '@/lib/money';
import type {
  MerchantFlows,
  MerchantOverview,
  PayoutSettingsData,
  WalletData,
} from '@/types';

type Window = '7' | '30' | '90' | 'custom';

function isoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function defaultCustomRange() {
  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - 29);
  return { from: isoDate(from), to: isoDate(to) };
}

/** Charts need numbers; the API sends decimal strings. Parsed only here. */
const point = (row: MerchantFlows['series'][number]) => ({
  label: new Date(row.date).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' }),
  in: Number(row.in),
  out: Number(row.out),
  net: Number(row.net),
});

const TYPE_COLOURS = [C.green, C.navy, C.gold, C.navySoft, C.slate, C.amber];

/**
 * The merchant account: one surface for the money, not two.
 *
 * Wallet and "merchant account" used to be separate pages describing the same
 * balance from different angles — one showed the collection account and the
 * COA, the other showed payment links and invoices, and neither answered "how
 * much have we taken this month, and where did it go". They are one account,
 * so they are one screen: what it holds, what flows through it, what is still
 * owed to the community, and the actions that move any of it.
 */
export function MerchantClient({ initial }: { initial: MerchantOverview }) {
  const communityId = useCommunityId();
  const [window, setWindow] = useState<Window>('30');
  const [customDraft, setCustomDraft] = useState(defaultCustomRange);
  const [customRange, setCustomRange] = useState(defaultCustomRange);
  const customError =
    customDraft.from && customDraft.to && customDraft.from > customDraft.to
      ? 'Start date must be before the end date'
      : '';

  const { data } = useQuery<MerchantOverview>(
    () => portalApi.merchantOverview(communityId),
    [communityId],
    { initial },
  );
  const { data: walletData } = useQuery<WalletData>(
    () => portalApi.wallet(communityId),
    [communityId],
  );
  const { data: flows, loading: flowsLoading } = useQuery<MerchantFlows>(
    () =>
      portalApi.merchantFlows(
        communityId,
        window === 'custom' ? customRange : Number(window),
      ),
    [communityId, window, customRange.from, customRange.to],
  );
  const { data: payouts } = useQuery<PayoutSettingsData>(
    () => portalApi.payoutSettings(communityId),
    [communityId],
  );

  const d = data ?? initial;
  const [copied, setCopied] = useState(false);
  function copyAccountNumber() {
    if (!d.collectionAccount) return;
    void navigator.clipboard.writeText(d.collectionAccount.accountNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const ngn =
    walletData?.wallet?.accounts.find((a) => a.currencyCode === 'NGN') ??
    walletData?.wallet?.accounts[0];
  const currency = ngn?.currencyCode ?? 'NGN';
  const pots = walletData?.ajoPots;
  const summary = payouts?.summary;
  const series = (flows?.series ?? []).map(point);
  const recent = (walletData?.transactions ?? []).slice(0, 6);

  // Only the kinds that actually moved money, biggest first, capped so the
  // legend stays readable. Everything else collapses into one slice rather
  // than being dropped, which would make the donut disagree with the total.
  const byType = flows?.byType ?? [];
  const topTypes = byType.slice(0, 5);
  const restTotal = byType.slice(5).reduce((sum, row) => sum + Number(row.amount), 0);
  const donut = [
    ...topTypes.map((row, index) => ({
      name: humanise(row.type),
      value: Number(row.amount),
      color: TYPE_COLOURS[index] ?? C.slate,
    })),
    ...(restTotal > 0 ? [{ name: 'Everything else', value: restTotal, color: C.slate }] : []),
  ];

  return (
    <>
      <PageHeader
        title="Merchant account"
        subtitle="Everything the community collects and everything it pays out, in one account"
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/merchant/payouts">
              <Button icon={<Send className="h-4 w-4" />}>Send money</Button>
            </Link>
            <Link href="/merchant/transactions">
              <Button variant="secondary" icon={<Receipt className="h-4 w-4" />}>
                All transactions
              </Button>
            </Link>
          </div>
        }
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
            <h2 className="mt-2 text-2xl font-bold">{d.community.name}</h2>
            {/* One line, not a paragraph. An officer opening this screen is
                looking for the account number to hand out — the explanation
                was three sentences standing between them and it. */}
            <p className="mt-1.5 text-[13px] leading-5 text-white/70">
              Share with members, transfers from any Nigerian bank credit it automatically.
            </p>
            {d.walletNumber && (
              <p className="mt-4 text-[12px] text-white/40">
                Wallet <span className="tnum font-medium text-white/60">{d.walletNumber}</span>
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

      {/* The balance, and the two numbers officers confuse it with: money
          held for members in pots, and money collected but not yet settled. */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Available"
          value={ngn ? money(ngn.available, ngn.currencyCode) : '—'}
          hint="Spendable now — loans, welfare and transfers out pay from this"
          icon={<WalletIcon className="h-4 w-4" />}
        />
        <Stat
          label="Pending"
          value={ngn ? money(ngn.pending, ngn.currencyCode) : '—'}
          hint="Arriving, not yet cleared"
          icon={<ArrowDownLeft className="h-4 w-4" />}
        />
        <Stat
          label="Waiting to settle"
          value={summary ? money(summary.unsettled, summary.currencyCode) : '—'}
          hint={
            summary
              ? (summary.blockedReason ?? 'Ready to sweep to your settlement destination')
              : 'Collections are held until a settlement run sweeps them'
          }
          tone={summary?.canSettle ? 'positive' : 'default'}
          icon={<PiggyBank className="h-4 w-4" />}
          footer={
            <Link href="/merchant/payouts?tab=settlement" className="font-semibold text-brand-700">
              Settlement settings
            </Link>
          }
        />
        {/* Deliberately its own card rather than folded into Available.
            Available would say the community can spend money that belongs to
            whoever the rotation pays next. */}
        <Stat
          label="Contribution pots"
          value={money(pots?.total ?? '0', currency)}
          hint={
            pots && pots.count > 0
              ? `Held for members in ${pots.count} pot${pots.count === 1 ? '' : 's'} — not spendable here`
              : 'No contribution pots open'
          }
          icon={<Users className="h-4 w-4" />}
        />
      </div>

      {pots && pots.count > 0 && !isZeroMoney(pots.total) && (
        <Card className="mb-6">
          <div className="flex flex-wrap items-center gap-4 px-5 py-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-700">
              <PiggyBank className="h-4 w-4" aria-hidden />
            </span>
            <div className="min-w-[220px] flex-1">
              <p className="text-sm font-medium text-navy-900">
                Where the {money(pots.total, currency)} in pots is sitting
              </p>
              <p className="mt-0.5 text-[13px] leading-relaxed text-slate-500">
                Each contribution group banks into its own pool, not this account. Your books count
                it as an asset against a matching liability, which is why Accounting reads higher
                than Available.
              </p>
              <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                {pots.groups.map((g) => (
                  <li key={g.id} className="text-[13px] text-slate-600">
                    <span className="font-medium text-navy-800">{g.name}</span>{' '}
                    {money(g.balance, g.currencyCode)}
                  </li>
                ))}
              </ul>
            </div>
            <Link
              href="/contributions"
              className="shrink-0 text-[13px] font-medium text-brand-700 hover:underline"
            >
              Open contributions →
            </Link>
          </div>
        </Card>
      )}

      {/* ── How money flows ────────────────────────────────────────────── */}
      <Card className="mb-6">
        <CardHeader
          title="How money flows"
          subtitle="Successful movements only — pending money has not arrived yet"
          action={
            <Segmented
              size="sm"
              label="Window"
              value={window}
              onChange={setWindow}
              options={[
                { value: '7', label: '7 days' },
                { value: '30', label: '30 days' },
                { value: '90', label: '90 days' },
                { value: 'custom', label: 'Custom' },
              ]}
            />
          }
        />

        {window === 'custom' && (
          <div className="flex flex-wrap items-end gap-3 border-b border-slate-100 bg-slate-50/70 px-5 py-4">
            <Field label="From" htmlFor="merchant-flow-from" error={customError}>
              <Input
                id="merchant-flow-from"
                type="date"
                max={customDraft.to || isoDate(new Date())}
                value={customDraft.from}
                onChange={(event) =>
                  setCustomDraft((current) => ({ ...current, from: event.target.value }))
                }
              />
            </Field>
            <Field label="To" htmlFor="merchant-flow-to">
              <Input
                id="merchant-flow-to"
                type="date"
                min={customDraft.from || undefined}
                max={isoDate(new Date())}
                value={customDraft.to}
                onChange={(event) =>
                  setCustomDraft((current) => ({ ...current, to: event.target.value }))
                }
              />
            </Field>
            <Button
              size="sm"
              disabled={!customDraft.from || !customDraft.to || Boolean(customError)}
              onClick={() => setCustomRange(customDraft)}
            >
              Apply range
            </Button>
            <p className="pb-2 text-xs text-slate-500">
              Maximum range: 365 days. Both dates are included.
            </p>
          </div>
        )}

        <div className="grid gap-4 border-b border-slate-100 px-5 py-4 sm:grid-cols-3">
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-wider text-slate-500">
              Money in
            </p>
            <p className="tnum mt-1 text-xl font-bold text-emerald-600">
              +{money(flows?.totals.in ?? '0', currency)}
            </p>
          </div>
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-wider text-slate-500">
              Money out
            </p>
            <p className="tnum mt-1 text-xl font-bold text-navy-900">
              −{money(flows?.totals.out ?? '0', currency)}
            </p>
          </div>
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-wider text-slate-500">
              Net
            </p>
            <p
              className={`tnum mt-1 text-xl font-bold ${
                Number(flows?.totals.net ?? 0) < 0 ? 'text-red-600' : 'text-navy-900'
              }`}
            >
              {money(flows?.totals.net ?? '0', currency)}
            </p>
            <p className="mt-0.5 text-[12px] text-slate-500">
              across {num(flows?.totals.count ?? 0)} movement
              {flows?.totals.count === 1 ? '' : 's'}
            </p>
          </div>
        </div>

        <div className="p-5">
          {flowsLoading && !flows ? (
            <p className="py-10 text-center text-sm text-slate-500">Reading the flow…</p>
          ) : flows?.totals.count === 0 ? (
            <EmptyState
              compact
              title="No movement in this window"
              body="Try a longer window, or share the collection account with members."
            />
          ) : (
            <>
              <AreaTrend
                data={series}
                x="label"
                height={260}
                series={[
                  { key: 'in', name: 'Money in', color: C.green },
                  { key: 'out', name: 'Money out', color: C.navy },
                ]}
              />
              <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1fr]">
                <div>
                  <p className="mb-2 text-[13px] font-semibold text-navy-900">
                    Net movement per day
                  </p>
                  <Bars
                    data={series}
                    x="label"
                    height={200}
                    series={[{ key: 'net', name: 'Net', color: C.gold }]}
                  />
                </div>
                <div>
                  <p className="mb-2 text-[13px] font-semibold text-navy-900">
                    What the flow is made of
                  </p>
                  <div className="grid items-center gap-4 sm:grid-cols-[180px_1fr]">
                    <Donut
                      data={donut}
                      center={{
                        label: 'total flow',
                        value: money(
                          String(Number(flows?.totals.in ?? 0) + Number(flows?.totals.out ?? 0)),
                          currency,
                          { compact: true },
                        ),
                      }}
                    />
                    <Legendary
                      items={donut.map((slice) => ({
                        name: slice.name,
                        color: slice.color,
                        value: money(String(slice.value), currency, { compact: true }),
                      }))}
                    />
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </Card>

      {/* ── What the desk does ─────────────────────────────────────────── */}
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
          hint="Shareable requests that credit this account"
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
      </div>

      {/* ── Latest movements ───────────────────────────────────────────── */}
      <Card id="merchant-wallet-coa">
        <CardHeader
          title="Latest movements"
          subtitle="Where every payment received or sent belongs in your books"
          action={
            <Link href="/merchant/transactions">
              <Button size="sm" variant="secondary" icon={<Receipt className="h-4 w-4" />}>
                View all
              </Button>
            </Link>
          }
        />

        {recent.length === 0 ? (
          <EmptyState
            compact
            title="No movements yet"
            body="Payments received through the collection account, payment links or invoices will appear here."
          />
        ) : (
          <div className="divide-y divide-slate-100">
            {recent.map((transaction) => (
              <div
                key={transaction.id}
                className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center"
              >
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                    transaction.credit
                      ? 'bg-emerald-50 text-emerald-600'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {transaction.credit ? (
                    <ArrowDownLeft className="h-4 w-4" />
                  ) : (
                    <ArrowUpRight className="h-4 w-4" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <p className="text-[13px] font-semibold text-navy-900">
                      {humanise(transaction.type)}
                    </p>
                    <span className="text-xs text-slate-400">{date(transaction.createdAt)}</span>
                  </div>
                  <p className="mt-0.5 truncate font-mono text-[11.5px] text-slate-500">
                    {transaction.reference}
                  </p>
                  {transaction.coaAccount ? (
                    <p className="mt-1 text-[12.5px] text-slate-600">
                      COA{' '}
                      <span className="font-mono font-semibold text-navy-800">
                        {transaction.coaAccount.code}
                      </span>{' '}
                      · {transaction.coaAccount.name}
                    </p>
                  ) : transaction.status === 'SUCCESS' ? (
                    <Link
                      href="/merchant/transactions"
                      className="mt-1 inline-flex items-center gap-1 text-[12.5px] font-semibold text-amber-700 hover:underline"
                    >
                      <BookOpen className="h-3.5 w-3.5" /> COA not assigned — assign now
                    </Link>
                  ) : (
                    <p className="mt-1 text-[12px] text-slate-400">COA available after completion</p>
                  )}
                </div>
                <div className="sm:text-right">
                  <p
                    className={`tnum text-sm font-bold ${
                      transaction.credit ? 'text-emerald-600' : 'text-navy-900'
                    }`}
                  >
                    {transaction.credit ? '+' : '−'}
                    {money(transaction.amount, transaction.currencyCode)}
                  </p>
                  <p className="mt-0.5 text-[11.5px] text-slate-500">
                    <Badge tone={transaction.status === 'SUCCESS' ? 'green' : 'slate'}>
                      {humanise(transaction.status)}
                    </Badge>
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </>
  );
}
