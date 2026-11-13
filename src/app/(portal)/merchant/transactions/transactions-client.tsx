'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowUpRight,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Download,
  ReceiptText,
} from 'lucide-react';
import {
  Button,
  Card,
  CardHeader,
  type Column,
  DataTable,
  EmptyState,
  Input,
  Modal,
  PageHeader,
  Select,
  StatusBadge,
} from '@/components/ui';
import { useMutation, useQuery } from '@/hooks/use-query';
import { useDebounced } from '@/hooks/use-debounced';
import { useCommunityId } from '@/components/providers/session-provider';
import { useToast } from '@/components/providers/toast-provider';
import { portalApi } from '@/services/portal';
import { date, humanise, money, num } from '@/lib/format';
import { downloadCsv } from '@/lib/csv';
import type {
  CoaChoice,
  MerchantTransaction,
  MerchantTransactionPage,
  WalletData,
} from '@/types';
import {
  AccountSelector,
  isCoaChoiceComplete,
  SYSTEM_COA_CHOICE,
} from '@/components/accounting/account-selector';

const PAGE_SIZE = 50;

const TYPE_LABELS: Record<string, string> = {
  DEPOSIT: 'Bank deposit',
  COMMUNITY_DUES: 'Monthly dues',
  COMMUNITY_CONTRIBUTION: 'Contribution',
  WELFARE_PAYOUT: 'Welfare payout',
  MERCHANT_PAYOUT: 'Transfer out',
  SUBSCRIPTION: 'Subscription',
  ORGANIZER_FEE_SETTLEMENT: 'Organizer fee settlement',
  TRANSFER: 'Transfer',
  REVERSAL: 'Reversal',
  ADJUSTMENT: 'Adjustment',
};

const typeLabel = (t: { type: string }) => TYPE_LABELS[t.type] ?? humanise(t.type);

/**
 * Every movement through the merchant account.
 *
 * Paged on the server, unlike the overview card above it, which shows the
 * latest fifty and cannot go back further. That limit is right for "what
 * happened lately" and useless for "find the payment from March", which is
 * the only question this page exists to answer — hence filters on direction,
 * status and date, and a search that reaches references and counterparties.
 */
export function TransactionsClient({ initial }: { initial: MerchantTransactionPage }) {
  const communityId = useCommunityId();
  const { toast } = useToast();

  const [page, setPage] = useState(1);
  const [direction, setDirection] = useState<'all' | 'in' | 'out'>('all');
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  // One request per word, not per keystroke: the server runs four ILIKEs
  // across a table that only grows.
  const debouncedSearch = useDebounced(search, 350);

  const untouched =
    page === 1 && direction === 'all' && status === 'all' && !debouncedSearch && !from && !to;

  const { data, loading, refresh } = useQuery<MerchantTransactionPage>(
    () =>
      portalApi.merchantTransactions(communityId, {
        page,
        limit: PAGE_SIZE,
        direction,
        status,
        search: debouncedSearch.trim() || undefined,
        from: from || undefined,
        to: to || undefined,
      }),
    [communityId, page, direction, status, debouncedSearch, from, to],
    // Only the untouched first page matches what the server already sent.
    { initial: untouched ? initial : undefined },
  );

  // Contribution pots bank into their own wallets, so none of their movement
  // is in the list below. Read here only to name them and link out.
  const { data: walletData } = useQuery<WalletData>(
    () => portalApi.wallet(communityId),
    [communityId],
  );
  const pots = walletData?.ajoPots;

  const [classifying, setClassifying] = useState<MerchantTransaction | null>(null);
  const [coaChoice, setCoaChoice] = useState<CoaChoice>(SYSTEM_COA_CHOICE);
  const assignAccount = useMutation(
    () => portalApi.assignWalletTransactionAccount(communityId, classifying!.id, coaChoice),
    {
      onSuccess: async () => {
        toast('Account assigned', 'success', 'The movement is now posted in the community books.');
        setClassifying(null);
        setCoaChoice(SYSTEM_COA_CHOICE);
        await refresh();
      },
      onError: (message) => toast('Could not assign account', 'error', message),
    },
  );

  const rows = data?.items ?? [];
  const total = data?.total ?? 0;
  const lastPage = Math.max(1, data?.pages ?? 1);

  /** Any filter change invalidates the page number it was read on. */
  const resetTo =
    <T,>(setter: (value: T) => void) =>
    (value: T) => {
      setter(value);
      setPage(1);
    };

  function openClassifier(transaction: MerchantTransaction) {
    setClassifying(transaction);
    setCoaChoice(SYSTEM_COA_CHOICE);
  }

  /**
   * The chart-of-accounts line, and the one action that makes sense on it.
   *
   * An account being present means the movement is already in the books —
   * either classified by hand or posted by the service that raised it — and
   * the API refuses to reassign either. So a present account is a link to its
   * ledger, not a dialog that would throw; only a genuinely unclassified
   * movement offers to be assigned.
   */
  const coaCell = (t: MerchantTransaction) =>
    t.coaAccount ? (
      <Link
        href={{ pathname: '/accounting/ledger', query: { account: t.coaAccount.id } }}
        className="inline-flex items-center gap-1 text-[12.5px] font-medium text-brand-700 hover:underline"
        title={
          t.coaLocked
            ? 'Posted in the community books — open its ledger'
            : 'Open this account’s ledger'
        }
      >
        <BookOpen className="h-3.5 w-3.5 shrink-0" />
        <span className="font-mono">{t.coaAccount.code}</span>
        <span className="truncate">· {t.coaAccount.name}</span>
      </Link>
    ) : t.status === 'SUCCESS' ? (
      <button
        type="button"
        onClick={() => openClassifier(t)}
        className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-amber-700 hover:underline"
      >
        <BookOpen className="h-3.5 w-3.5" /> Assign account
      </button>
    ) : (
      <span className="text-xs text-slate-400">—</span>
    );

  const columns: Column<MerchantTransaction>[] = [
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
            {t.credit ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
          </span>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-medium text-navy-900">{typeLabel(t)}</p>
            {/* The stated reason outranks the counterparty here. It is the
                whole point of requiring one, and on a transfer out it is the
                line an auditor reads first. */}
            {(t.reason || t.counterparty || t.narration) && (
              <p className="truncate text-xs text-slate-500">
                {t.reason ?? t.counterparty ?? t.narration}
                {t.reason && t.counterparty ? ` · ${t.counterparty}` : ''}
              </p>
            )}
            {t.expense && (
              <p className="truncate text-[11.5px] text-slate-400">
                Settles expense {t.expense.reference} · {t.expense.payee}
              </p>
            )}
            <div className="mt-1 md:hidden">{coaCell(t)}</div>
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
    { key: 'account', header: 'Chart of account', hideOnMobile: true, cell: coaCell },
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
  ];

  return (
    <>
      <PageHeader
        title="Transaction history"
        subtitle="Every movement in or out of the merchant account"
        breadcrumb={
          <Link href="/merchant" className="inline-flex items-center gap-1.5 hover:text-navy-900">
            <ArrowLeft className="h-3.5 w-3.5" />
            Merchant account
          </Link>
        }
      />

      <Card>
        <CardHeader
          title={total ? `${num(total)} transaction${total === 1 ? '' : 's'}` : 'Transactions'}
          subtitle={
            <span className="flex flex-wrap items-center gap-x-1.5">
              {untouched ? 'Newest first' : 'Newest first, matching your filters'}
              {pots && pots.count > 0 && (
                <>
                  <span className="text-slate-300">·</span>
                  {/* Contribution pools bank separately, so their payments are
                      genuinely not in this list. One line pointing at the
                      right page beats a banner explaining the architecture. */}
                  <Link
                    href="/contributions/transactions"
                    className="font-medium text-brand-700 hover:underline"
                  >
                    Contribution payments are tracked separately
                  </Link>
                </>
              )}
            </span>
          }
          action={
            <Button
              size="sm"
              variant="secondary"
              icon={<Download className="h-3.5 w-3.5" />}
              disabled={rows.length === 0}
              onClick={() =>
                downloadCsv(
                  `merchant-transactions-page-${page}.csv`,
                  rows.map((t) => ({
                    Date: date(t.createdAt, 'datetime'),
                    Transaction: typeLabel(t),
                    Direction: t.credit ? 'In' : 'Out',
                    Amount: money(t.amount, t.currencyCode),
                    Fee: money(t.feeAmount, t.currencyCode),
                    Status: humanise(t.status),
                    Reference: t.reference,
                    Counterparty: t.counterparty,
                    Reason: t.reason,
                    Expense: t.expense ? `${t.expense.reference} · ${t.expense.payee}` : null,
                    'Chart of account': t.coaAccount
                      ? `${t.coaAccount.code} · ${t.coaAccount.name}`
                      : 'Unassigned',
                  })),
                )
              }
            >
              Export this page
            </Button>
          }
        />

        <div className="grid gap-3 border-b border-slate-100 px-5 py-4 md:grid-cols-[minmax(0,1fr)_9rem_9rem] lg:grid-cols-[minmax(0,1fr)_9rem_9rem_9rem_9rem]">
          <Input
            value={search}
            onChange={(event) => resetTo(setSearch)(event.target.value)}
            placeholder="Search reference or counterparty"
            aria-label="Search transactions"
          />
          <Select
            value={direction}
            onChange={(event) => resetTo(setDirection)(event.target.value as 'all' | 'in' | 'out')}
            aria-label="Filter by direction"
          >
            <option value="all">All movements</option>
            <option value="in">Money in</option>
            <option value="out">Money out</option>
          </Select>
          <Select
            value={status}
            onChange={(event) => resetTo(setStatus)(event.target.value)}
            aria-label="Filter by status"
          >
            <option value="all">All statuses</option>
            <option value="SUCCESS">Successful</option>
            <option value="PROCESSING">Processing</option>
            <option value="PENDING">Pending</option>
            <option value="FAILED">Failed</option>
            <option value="REVERSED">Reversed</option>
          </Select>
          <Input
            type="date"
            value={from}
            onChange={(event) => resetTo(setFrom)(event.target.value)}
            aria-label="From date"
          />
          <Input
            type="date"
            value={to}
            onChange={(event) => resetTo(setTo)(event.target.value)}
            aria-label="To date"
          />
        </div>

        <DataTable
          rows={rows}
          rowKey={(t) => t.id}
          columns={columns}
          loading={loading && !data}
          empty={
            <EmptyState
              icon={<ReceiptText className="h-5 w-5" />}
              title={untouched ? 'No transactions yet' : 'No matching transactions'}
              body={
                untouched
                  ? 'Dues, contributions and bank transfers into the collection account will appear here.'
                  : 'Try changing or clearing the filters.'
              }
            />
          }
          mobile={(t) => (
            <div className="space-y-1">
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium text-navy-900">{typeLabel(t)}</p>
                <span
                  className={`tnum text-[13px] font-semibold ${
                    t.credit ? 'text-emerald-600' : 'text-navy-900'
                  }`}
                >
                  {t.credit ? '+' : '−'}
                  {money(t.amount, t.currencyCode)}
                </span>
              </div>
              {(t.reason || t.counterparty) && (
                <p className="text-xs text-slate-500">{t.reason ?? t.counterparty}</p>
              )}
              <p className="text-xs text-slate-400">
                {date(t.createdAt, 'datetime')} · {humanise(t.status)}
              </p>
              {coaCell(t)}
            </div>
          )}
        />

        {lastPage > 1 && (
          <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-4 py-3">
            <p className="text-sm text-slate-500">
              Page {data?.page ?? page} of {num(lastPage)}
            </p>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="h-4 w-4" /> Previous
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={page >= lastPage || loading}
                onClick={() => setPage((p) => p + 1)}
              >
                Next <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      <Modal
        open={Boolean(classifying)}
        onClose={() => !assignAccount.pending && setClassifying(null)}
        size="lg"
        title="Assign chart of account"
        description={
          classifying
            ? `${typeLabel(classifying)} · ${money(classifying.amount, classifying.currencyCode)}`
            : undefined
        }
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setClassifying(null)}
              disabled={assignAccount.pending}
            >
              Cancel
            </Button>
            <Button
              loading={assignAccount.pending}
              disabled={!isCoaChoiceComplete(coaChoice)}
              onClick={() => void assignAccount.run()}
            >
              Assign and post
            </Button>
          </>
        }
      >
        {classifying && (
          <AccountSelector
            selection={classifying.credit ? 'MERCHANT_MONEY_IN' : 'MERCHANT_MONEY_OUT'}
            value={coaChoice}
            onChange={setCoaChoice}
            idPrefix={`merchant-${classifying.id}`}
          />
        )}
      </Modal>
    </>
  );
}
