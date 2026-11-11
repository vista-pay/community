'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowDownLeft, ArrowUpRight, BookOpen, Check, Copy, Download, Landmark, PiggyBank, ReceiptText, Wallet } from 'lucide-react';
import {
  Button,
  Card,
  CardHeader,
  DataTable,
  EmptyState,
  Input,
  Modal,
  PageHeader,
  Select,
  Stat,
  StatusBadge,
} from '@/components/ui';
import { useQuery } from '@/hooks/use-query';
import { useMutation } from '@/hooks/use-query';
import { useCommunityId } from '@/components/providers/session-provider';
import { useToast } from '@/components/providers/toast-provider';
import { portalApi } from '@/services/portal';
import { date, humanise, money } from '@/lib/format';
import { isZeroMoney } from '@/lib/money';
import { downloadCsv } from '@/lib/csv';
import type { CoaChoice, WalletData, WalletTransaction } from '@/types';
import { AccountSelector, isCoaChoiceComplete, SYSTEM_COA_CHOICE } from '@/components/accounting/account-selector';

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
  const { toast } = useToast();
  const { data, refresh } = useQuery<WalletData>(() => portalApi.wallet(communityId), [communityId], {
    initial,
  });
  const [copied, setCopied] = useState(false);
  const [query, setQuery] = useState('');
  const [direction, setDirection] = useState<'all' | 'in' | 'out'>('all');
  const [status, setStatus] = useState('all');
  const [classifying, setClassifying] = useState<WalletTransaction | null>(null);
  const [coaChoice, setCoaChoice] = useState<CoaChoice>(SYSTEM_COA_CHOICE);
  const assignAccount = useMutation(
    () => portalApi.assignWalletTransactionAccount(communityId, classifying!.id, coaChoice),
    {
      onSuccess: async () => {
        toast('Account assigned', 'success', 'The wallet movement is now posted in the community books.');
        setClassifying(null);
        setCoaChoice(SYSTEM_COA_CHOICE);
        await refresh();
      },
      onError: (message) => toast('Could not assign account', 'error', message),
    },
  );

  const d = data ?? initial;
  const ngn = d.wallet?.accounts.find((a) => a.currencyCode === 'NGN') ?? d.wallet?.accounts[0];
  const depositAccount = d.wallet?.depositAccount ?? null;
  const pots = d.ajoPots;
  const transactions = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return d.transactions.filter((transaction) => {
      const haystack = `${typeLabel(transaction)} ${transaction.reference} ${transaction.counterparty ?? ''} ${transaction.narration ?? ''} ${transaction.coaAccount?.code ?? ''} ${transaction.coaAccount?.name ?? ''}`.toLowerCase();
      return (
        (!needle || haystack.includes(needle)) &&
        (direction === 'all' || (direction === 'in' ? transaction.credit : !transaction.credit)) &&
        (status === 'all' || transaction.status === status)
      );
    });
  }, [d.transactions, direction, query, status]);
  const statuses = [...new Set(d.transactions.map((transaction) => transaction.status))];

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
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
        {/* Deliberately its own card rather than folded into Available or
            Held. Available would say the community can spend money that
            belongs to whoever the rotation pays next; Held means reserved
            *within this wallet*, and these pots are separate wallets. */}
        <Stat
          label="Contribution pots"
          value={money(pots?.total ?? '0', ngn?.currencyCode ?? 'NGN')}
          hint={
            pots && pots.count > 0
              ? `Held for members in ${pots.count} pot${pots.count === 1 ? '' : 's'} — not spendable here`
              : 'No contribution pots open'
          }
          icon={<PiggyBank className="h-4 w-4" />}
        />
      </div>

      {/* Held for members, in each group's own pool wallet rather than this
          one — so it is reported next to the balance, never inside it. Its
          absence here is what made the wallet and the books read as if they
          disagreed. */}
      {pots && pots.count > 0 && (
        <Card className="mb-6">
          <div className="flex flex-wrap items-center gap-4 px-5 py-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-700">
              <PiggyBank className="h-4 w-4" aria-hidden />
            </span>
            <div className="min-w-[220px] flex-1">
              <p className="text-sm font-medium text-navy-900">
                Where the {money(pots.total, ngn?.currencyCode ?? 'NGN')} in pots is sitting
              </p>
              <p className="mt-0.5 text-[13px] leading-relaxed text-slate-500">
                Each contribution group banks into its own pool, not this wallet. Your books count
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
              href={'/contributions' as never}
              className="shrink-0 text-[13px] font-medium text-brand-700 hover:underline"
            >
              Open contributions →
            </Link>
          </div>
        </Card>
      )}

      {/* History */}
      <Card id="transactions">
        <CardHeader
          title="Transactions"
          subtitle="Every movement in or out of the community wallet"
          action={
            <Button
              size="sm"
              variant="secondary"
              icon={<Download className="h-3.5 w-3.5" />}
              disabled={transactions.length === 0}
              onClick={() =>
                downloadCsv(
                  `community-wallet-${transactions.length === d.transactions.length ? 'all' : 'filtered'}-transactions.csv`,
                  transactions.map((transaction) => ({
                    Date: date(transaction.createdAt, 'datetime'),
                    Transaction: typeLabel(transaction),
                    Direction: transaction.credit ? 'In' : 'Out',
                    Amount: money(transaction.amount, transaction.currencyCode),
                    Status: humanise(transaction.status),
                    Reference: transaction.reference,
                    Counterparty: transaction.counterparty,
                    Narration: transaction.narration,
                    'Chart of account': transaction.coaAccount ? `${transaction.coaAccount.code} · ${transaction.coaAccount.name}` : 'Unassigned',
                  })),
                )
              }
            >
              Export CSV
            </Button>
          }
        />
        <div className="grid gap-3 border-b border-slate-100 px-5 py-4 md:grid-cols-[minmax(0,1fr)_10rem_10rem]">
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search reference, type or counterparty" aria-label="Search wallet transactions" />
          <Select value={direction} onChange={(event) => setDirection(event.target.value as 'all' | 'in' | 'out')} aria-label="Filter by direction">
            <option value="all">All movements</option><option value="in">Money in</option><option value="out">Money out</option>
          </Select>
          <Select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Filter by status">
            <option value="all">All statuses</option>
            {statuses.map((value) => <option key={value} value={value}>{humanise(value)}</option>)}
          </Select>
        </div>
        <DataTable
          rows={transactions}
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
                    <div className="mt-1 md:hidden">
                      {t.coaAccount ? (
                        <p className="truncate text-[11.5px] text-slate-500">
                          COA <span className="font-mono">{t.coaAccount.code}</span> · {t.coaAccount.name}
                        </p>
                      ) : t.status === 'SUCCESS' ? (
                        <button
                          type="button"
                          onClick={() => {
                            setClassifying(t);
                            setCoaChoice(SYSTEM_COA_CHOICE);
                          }}
                          className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-brand-700"
                        >
                          <BookOpen className="h-3 w-3" /> Assign COA
                        </button>
                      ) : null}
                    </div>
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
              key: 'account',
              header: 'Chart of account',
              hideOnMobile: true,
              cell: (t) => t.coaAccount ? (
                <span className="text-[12.5px] text-slate-600"><span className="font-mono">{t.coaAccount.code}</span> · {t.coaAccount.name}</span>
              ) : t.status === 'SUCCESS' ? (
                <button
                  type="button"
                  onClick={() => {
                    setClassifying(t);
                    setCoaChoice(SYSTEM_COA_CHOICE);
                  }}
                  className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-brand-700 hover:underline"
                >
                  <BookOpen className="h-3.5 w-3.5" /> Assign account
                </button>
              ) : <span className="text-xs text-slate-400">—</span>,
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
              title={d.transactions.length ? 'No matching transactions' : 'No transactions yet'}
              body={d.transactions.length ? 'Try changing or clearing the filters.' : 'Dues, contributions and bank transfers into the deposit account will appear here.'}
            />
          }
        />
      </Card>

      <Modal
        open={Boolean(classifying)}
        onClose={() => !assignAccount.pending && setClassifying(null)}
        size="lg"
        title="Assign chart of account"
        description={classifying ? `${typeLabel(classifying)} · ${money(classifying.amount, classifying.currencyCode)}` : undefined}
        footer={<>
          <Button variant="secondary" onClick={() => setClassifying(null)} disabled={assignAccount.pending}>Cancel</Button>
          <Button loading={assignAccount.pending} disabled={!isCoaChoiceComplete(coaChoice)} onClick={() => void assignAccount.run()}>Assign and post</Button>
        </>}
      >
        {classifying && (
          <AccountSelector
            selection={classifying.credit ? 'MERCHANT_MONEY_IN' : 'MERCHANT_MONEY_OUT'}
            value={coaChoice}
            onChange={setCoaChoice}
            idPrefix={`wallet-${classifying.id}`}
          />
        )}
      </Modal>
    </>
  );
}
