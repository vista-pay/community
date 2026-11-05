'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  BookOpen,
  Calculator,
  Landmark,
  Lock,
  LockOpen,
  Plus,
  Receipt,
  RotateCcw,
  Scale,
} from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  ConfirmDialog,
  DataTable,
  EmptyState,
  KV,
  PageHeader,
  StatusBadge,
  Stat,
  Tabs,
  type Column,
} from '@/components/ui';
import { useMutation, useQuery } from '@/hooks/use-query';
import { useCommunityId } from '@/components/providers/session-provider';
import { useToast } from '@/components/providers/toast-provider';
import { portalApi } from '@/services/portal';
import { date, humanise, money } from '@/lib/format';
import { ACCOUNT_TYPE_LABELS } from '@/data/catalog';
import { isNegativeMoney, isZeroMoney } from '@/lib/money';
import type {
  AccountingPeriod,
  BookAccount,
  CashAccount,
  Expense,
  JournalEntry,
  PostingRule,
  Statements,
} from '@/types';
import { JournalModal } from './journal-modal';
import { ExpenseModal } from './expense-modal';
import { ReconcileModal } from './reconcile-modal';
import { ModuleAccounting } from '@/components/accounting/module-accounting';
import { ProfitAndLoss } from '@/components/accounting/profit-and-loss';

type Tab = 'journals' | 'chart' | 'statements' | 'banking' | 'expenses' | 'periods';

interface Initial {
  chart: { accounts: BookAccount[]; postingRules: PostingRule[] };
  journals: JournalEntry[];
  statements: Statements;
  cashAccounts: CashAccount[];
  expenses: Expense[];
  periods: AccountingPeriod[];
}

export function AccountingClient({ initial }: { initial: Initial }) {
  const communityId = useCommunityId();
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>('journals');

  const chart = useQuery(() => portalApi.accounts(communityId), [communityId], {
    initial: initial.chart,
  });
  const journals = useQuery(() => portalApi.journals(communityId), [communityId], {
    initial: initial.journals,
  });
  const statements = useQuery(() => portalApi.statements(communityId), [communityId], {
    initial: initial.statements,
  });
  const cash = useQuery(() => portalApi.cashAccounts(communityId), [communityId], {
    initial: initial.cashAccounts,
  });
  const expenses = useQuery(() => portalApi.expenses(communityId), [communityId], {
    initial: initial.expenses,
  });
  const periods = useQuery(() => portalApi.periods(communityId), [communityId], {
    initial: initial.periods,
  });

  const [journalOpen, setJournalOpen] = useState(false);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [reconciling, setReconciling] = useState<CashAccount | null>(null);
  const [reversing, setReversing] = useState<JournalEntry | null>(null);
  const [closingPeriod, setClosingPeriod] = useState<AccountingPeriod | null>(null);

  const accounts = chart.data?.accounts ?? [];
  const s = statements.data ?? initial.statements;

  /** Posting, reversing and paying all move the books; refetch the lot. */
  async function refreshBooks() {
    await Promise.all([journals.refresh(), statements.refresh(), cash.refresh(), chart.refresh()]);
  }

  const reverse = useMutation(
    (entryId: string, reason: string) => portalApi.reverseJournal(communityId, entryId, reason),
    {
      onSuccess: async () => {
        toast('Entry reversed', 'success', 'The original stays on the record.');
        setReversing(null);
        await refreshBooks();
      },
      onError: (message) => toast('Could not reverse', 'error', message),
    },
  );

  const postDraft = useMutation((entryId: string) => portalApi.postJournal(communityId, entryId), {
    onSuccess: async () => {
      toast('Entry posted', 'success');
      await refreshBooks();
    },
    onError: (message) => toast('Could not post', 'error', message),
  });

  const closePeriod = useMutation(
    (periodKey: string) => portalApi.closePeriod(communityId, periodKey),
    {
      onSuccess: async () => {
        toast('Period closed', 'success', 'Nothing more can be posted into it.');
        setClosingPeriod(null);
        await periods.refresh();
      },
      onError: (message) => toast('Could not close the period', 'error', message),
    },
  );

  const reopenPeriod = useMutation(
    (periodKey: string) => portalApi.reopenPeriod(communityId, periodKey),
    {
      onSuccess: async () => {
        toast('Period reopened', 'info', 'This is recorded in the audit log.');
        await periods.refresh();
      },
      onError: (message) => toast('Could not reopen', 'error', message),
    },
  );

  const reviewExpense = useMutation(
    (expenseId: string, decision: 'APPROVE' | 'REJECT' | 'PAY') =>
      portalApi.reviewExpense(communityId, expenseId, { decision }),
    {
      onSuccess: async () => {
        await Promise.all([expenses.refresh(), refreshBooks()]);
      },
      onError: (message) => toast('Could not update the expense', 'error', message),
    },
  );

  const pendingDrafts = (journals.data ?? []).filter(
    (j) => j.status === 'DRAFT' || j.status === 'PENDING_APPROVAL',
  ).length;
  const pendingExpenses = (expenses.data ?? []).filter((e) => e.status === 'PENDING_APPROVAL').length;
  const unreconciled = (cash.data ?? []).filter((c) => !c.reconciled).length;

  return (
    <>
      <PageHeader
        title="Accounting"
        subtitle="The community's own books. Separate from Rendi's wallet ledger."
        actions={
          <>
            <Button
              variant="secondary"
              icon={<Receipt className="h-4 w-4" />}
              onClick={() => setExpenseOpen(true)}
            >
              Record expense
            </Button>
            <Button icon={<Plus className="h-4 w-4" />} onClick={() => setJournalOpen(true)}>
              New journal entry
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Total assets"
          value={money(s.balanceSheet.assets)}
          icon={<Landmark className="h-4 w-4" />}
        />
        <Stat
          label="Owed to members"
          value={money(s.balanceSheet.liabilities)}
          icon={<Scale className="h-4 w-4" />}
        />
        <Stat
          label="Surplus this period"
          value={money(s.incomeStatement.surplus)}
          hint={`${money(s.incomeStatement.income)} in · ${money(s.incomeStatement.expense)} out`}
          icon={<Calculator className="h-4 w-4" />}
          tone={isNegativeMoney(s.incomeStatement.surplus) ? 'danger' : 'positive'}
        />
        <Stat
          label="Trial balance"
          value={s.trialBalance.balanced ? 'Balanced' : 'Out'}
          hint={`${money(s.trialBalance.debit)} Dr · ${money(s.trialBalance.credit)} Cr`}
          icon={<BookOpen className="h-4 w-4" />}
          tone={s.trialBalance.balanced ? 'positive' : 'danger'}
        />
      </div>

      <ModuleAccounting modules={s.modules ?? []} />
      <ProfitAndLoss data={s.profitAndLoss} />

      <Tabs
        className="mt-6"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'journals', label: 'Journals', count: pendingDrafts || undefined },
          { value: 'chart', label: 'Chart of accounts' },
          { value: 'statements', label: 'Statements' },
          { value: 'banking', label: 'Banking', count: unreconciled || undefined },
          { value: 'expenses', label: 'Expenses', count: pendingExpenses || undefined },
          { value: 'periods', label: 'Periods' },
        ]}
      />

      <div className="mt-4">
        {tab === 'journals' && (
          <JournalsTab
            entries={journals.data ?? []}
            loading={journals.loading}
            onPost={(e) => void postDraft.run(e.id)}
            onReverse={setReversing}
            busy={postDraft.pending}
          />
        )}

        {tab === 'chart' && (
          <ChartTab accounts={accounts} rules={chart.data?.postingRules ?? []} loading={chart.loading} />
        )}

        {tab === 'statements' && <StatementsTab statements={s} />}

        {tab === 'banking' && (
          <BankingTab
            accounts={cash.data ?? []}
            loading={cash.loading}
            onReconcile={setReconciling}
          />
        )}

        {tab === 'expenses' && (
          <ExpensesTab
            expenses={expenses.data ?? []}
            loading={expenses.loading}
            busy={reviewExpense.pending}
            onDecision={(id, decision) => void reviewExpense.run(id, decision)}
          />
        )}

        {tab === 'periods' && (
          <PeriodsTab
            periods={periods.data ?? []}
            onClose={setClosingPeriod}
            onReopen={(p) => void reopenPeriod.run(p.periodKey)}
            busy={closePeriod.pending || reopenPeriod.pending}
          />
        )}
      </div>

      <JournalModal
        open={journalOpen}
        onClose={() => setJournalOpen(false)}
        accounts={accounts}
        communityId={communityId}
        onPosted={refreshBooks}
      />

      <ExpenseModal
        open={expenseOpen}
        onClose={() => setExpenseOpen(false)}
        accounts={accounts}
        cashAccounts={cash.data ?? []}
        communityId={communityId}
        onCreated={expenses.refresh}
      />

      <ReconcileModal
        account={reconciling}
        accounts={accounts}
        communityId={communityId}
        onClose={() => setReconciling(null)}
        onDone={async () => {
          setReconciling(null);
          await refreshBooks();
        }}
      />

      <ConfirmDialog
        open={Boolean(reversing)}
        onClose={() => setReversing(null)}
        title={`Reverse ${reversing?.reference ?? ''}?`}
        confirmLabel="Post reversal"
        tone="danger"
        requireReason
        reasonLabel="Why is this being reversed?"
        loading={reverse.pending}
        onConfirm={(reason) => reversing && void reverse.run(reversing.id, reason)}
        body={
          <>
            A mirror entry is posted today. The original stays exactly as it is, so the books show
            both the mistake and the correction.
          </>
        }
      />

      <ConfirmDialog
        open={Boolean(closingPeriod)}
        onClose={() => setClosingPeriod(null)}
        title={`Close ${closingPeriod?.label ?? ''}?`}
        confirmLabel="Close period"
        loading={closePeriod.pending}
        onConfirm={() => closingPeriod && void closePeriod.run(closingPeriod.periodKey)}
        body={
          <>
            Nothing can be posted into {closingPeriod?.label} afterwards. Any draft entry still in
            that month must be posted or discarded first.
          </>
        }
      />
    </>
  );
}

function JournalsTab({
  entries,
  loading,
  onPost,
  onReverse,
  busy,
}: {
  entries: JournalEntry[];
  loading: boolean;
  onPost: (entry: JournalEntry) => void;
  onReverse: (entry: JournalEntry) => void;
  busy: boolean;
}) {
  const columns: Column<JournalEntry>[] = [
    {
      key: 'ref',
      header: 'Reference',
      cell: (j) => (
        <span>
          <span className="block font-medium text-navy-900">{j.reference}</span>
          <span className="block text-xs text-slate-500">{date(j.date)}</span>
        </span>
      ),
    },
    {
      key: 'description',
      header: 'Description',
      cell: (j) => (
        <span className="block max-w-sm truncate" title={j.description}>
          {j.description}
        </span>
      ),
    },
    {
      key: 'lines',
      header: 'Accounts',
      hideOnMobile: true,
      cell: (j) => (
        <span className="text-xs text-slate-500">
          {j.lines.map((l) => l.accountCode).join(' / ')}
        </span>
      ),
    },
    { key: 'source', header: 'Source', hideOnMobile: true, cell: (j) => <Badge tone="slate">{humanise(j.source)}</Badge> },
    { key: 'amount', header: 'Amount', align: 'right', cell: (j) => money(j.total) },
    { key: 'status', header: 'Status', cell: (j) => <StatusBadge status={j.status.toLowerCase()} /> },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (j) =>
        j.status === 'POSTED' ? (
          <Button
            size="xs"
            variant="ghost"
            icon={<RotateCcw className="h-3.5 w-3.5" />}
            onClick={() => onReverse(j)}
          >
            Reverse
          </Button>
        ) : j.status === 'REVERSED' ? (
          <span className="text-xs text-slate-400">—</span>
        ) : (
          <Button size="xs" variant="secondary" disabled={busy} onClick={() => onPost(j)}>
            Post
          </Button>
        ),
    },
  ];

  return (
    <Card>
      <DataTable
        rows={entries}
        columns={columns}
        rowKey={(j) => j.id}
        loading={loading}
        empty={
          <EmptyState
            icon={<BookOpen className="h-5 w-5" />}
            title="No journal entries yet"
            body="Contributions, loans and savings post here automatically. You can also record an entry by hand."
          />
        }
      />
    </Card>
  );
}

function ChartTab({
  accounts,
  rules,
  loading,
}: {
  accounts: BookAccount[];
  rules: PostingRule[];
  loading: boolean;
}) {
  const grouped = useMemo(() => {
    const map = new Map<string, BookAccount[]>();
    for (const a of accounts) {
      map.set(a.type, [...(map.get(a.type) ?? []), a]);
    }
    return map;
  }, [accounts]);

  if (loading && accounts.length === 0) {
    return (
      <Card>
        <EmptyState title="Loading the chart of accounts" body="One moment." />
      </Card>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        {(['ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE'] as const).map((type) => {
          const rows = grouped.get(type) ?? [];
          if (!rows.length) return null;
          return (
            <Card key={type}>
              <CardHeader title={ACCOUNT_TYPE_LABELS[type]} subtitle={`${rows.length} accounts`} />
              <ul className="divide-y divide-slate-100">
                {rows.map((a) => (
                  <li key={a.id} className="flex items-center gap-3 px-5 py-2.5">
                    <span className="tnum w-14 text-[13px] text-slate-500">{a.code}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] text-navy-900">
                        {a.name}
                        {!a.isActive && <span className="ml-2 text-xs text-slate-400">inactive</span>}
                      </span>
                      <span className="block text-[11px] text-slate-400">{a.group}</span>
                    </span>
                    {a.isSystem && <Badge tone="slate">System</Badge>}
                    <span className="tnum w-28 text-right text-[13px] font-medium text-navy-900">
                      {money(a.balance)}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          );
        })}
      </div>

      <Card className="h-fit">
        <CardHeader
          title="Automatic postings"
          subtitle="What the system posts when money moves"
        />
        <ul className="divide-y divide-slate-100">
          {rules.map((r) => (
            <li key={r.event} className="px-5 py-3">
              <p className="text-[13px] text-navy-900">{r.event}</p>
              <p className="mt-0.5 text-xs text-slate-500">
                Dr {r.debit} · Cr {r.credit}
              </p>
              {r.note && <p className="mt-0.5 text-xs italic text-slate-400">{r.note}</p>}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

function StatementsTab({ statements }: { statements: Statements }) {
  const byType = (type: BookAccount['type']) => statements.rows.filter((r) => r.type === type);

  return (
    <div className="space-y-6">
      {!statements.trialBalance.balanced && (
        <Card className="border-red-200 bg-red-50">
          <div className="px-5 py-4">
            <p className="text-sm font-semibold text-red-900">The trial balance does not balance</p>
            <p className="mt-1 text-[13px] text-red-800">
              Debits total {money(statements.trialBalance.debit)} against credits of{' '}
              {money(statements.trialBalance.credit)}. Every entry posted through the portal
              balances, so a difference means something was written directly to the database.
            </p>
          </div>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Income & expenditure" />
          <dl className="divide-y divide-slate-100">
            {byType('INCOME').map((r) => (
              <Row key={r.id} label={`${r.code} ${r.name}`} value={money(r.balance)} />
            ))}
            <Row label="Total income" value={money(statements.incomeStatement.income)} strong />
            {byType('EXPENSE').map((r) => (
              <Row key={r.id} label={`${r.code} ${r.name}`} value={money(r.balance)} />
            ))}
            <Row label="Total expenditure" value={money(statements.incomeStatement.expense)} strong />
            <Row
              label="Surplus / (deficit)"
              value={money(statements.incomeStatement.surplus)}
              strong
              tone={isNegativeMoney(statements.incomeStatement.surplus) ? 'danger' : 'positive'}
            />
          </dl>
        </Card>

        <Card>
          <CardHeader title="Balance sheet" />
          <dl className="divide-y divide-slate-100">
            {byType('ASSET').map((r) => (
              <Row key={r.id} label={`${r.code} ${r.name}`} value={money(r.balance)} />
            ))}
            <Row label="Total assets" value={money(statements.balanceSheet.assets)} strong />
            {byType('LIABILITY').map((r) => (
              <Row key={r.id} label={`${r.code} ${r.name}`} value={money(r.balance)} />
            ))}
            <Row label="Total liabilities" value={money(statements.balanceSheet.liabilities)} strong />
            {byType('EQUITY').map((r) => (
              <Row key={r.id} label={`${r.code} ${r.name}`} value={money(r.balance)} />
            ))}
            <Row label="Equity & reserves" value={money(statements.balanceSheet.equity)} strong />
          </dl>
        </Card>
      </div>

      <Card>
        <CardHeader title="Trial balance" subtitle="Now available as a dedicated finance workspace" />
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <p className="max-w-2xl text-[13px] leading-5 text-slate-600">
            Review account-level debits and credits, filter by period or account type, investigate
            imbalances and export the complete schedule from the Trial balance page.
          </p>
          <Link
            href="/trial-balance"
            className="inline-flex h-10 items-center justify-center rounded-lg bg-navy-900 px-4 text-sm font-semibold text-white transition hover:bg-navy-800 focus-ring"
          >
            Open trial balance
          </Link>
        </div>
      </Card>
    </div>
  );
}

function Row({
  label,
  value,
  strong,
  tone,
}: {
  label: string;
  value: string;
  strong?: boolean;
  tone?: 'positive' | 'danger';
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-2">
      <dt
        className={
          strong ? 'text-[13px] font-semibold text-navy-900' : 'text-[13px] text-slate-600'
        }
      >
        {label}
      </dt>
      <dd
        className={[
          'tnum text-[13px]',
          strong ? 'font-semibold' : '',
          tone === 'danger' ? 'text-red-700' : tone === 'positive' ? 'text-brand-700' : 'text-navy-900',
        ].join(' ')}
      >
        {value}
      </dd>
    </div>
  );
}

function BankingTab({
  accounts,
  loading,
  onReconcile,
}: {
  accounts: CashAccount[];
  loading: boolean;
  onReconcile: (account: CashAccount) => void;
}) {
  if (!loading && accounts.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={<Landmark className="h-5 w-5" />}
          title="No bank accounts yet"
          body="Add the account your community actually banks with, then reconcile it against your statement."
        />
      </Card>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {accounts.map((a) => (
        <Card key={a.id}>
          <CardHeader
            title={a.name}
            subtitle={`${a.institution} · ${a.maskedNumber}`}
            action={<Badge tone={a.reconciled ? 'green' : 'amber'}>{a.reconciled ? 'Reconciled' : 'Unreconciled'}</Badge>}
          />
          <dl className="grid gap-4 px-5 py-4 sm:grid-cols-3">
            <KV label="Per the books">{money(a.bookBalance)}</KV>
            <KV label="Per the statement">{money(a.statementBalance)}</KV>
            <KV label="Difference">
              <span className={isZeroMoney(a.difference) ? '' : 'text-amber-700'}>
                {money(a.difference)}
              </span>
            </KV>
          </dl>
          <div className="flex items-center gap-3 border-t border-slate-100 px-5 py-3">
            <span className="flex-1 text-xs text-slate-500">
              {a.lastReconciledAt
                ? `Last reconciled ${date(a.lastReconciledAt)}`
                : 'Never reconciled'}
            </span>
            <Button size="sm" variant="secondary" onClick={() => onReconcile(a)}>
              Reconcile
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
}

function ExpensesTab({
  expenses,
  loading,
  busy,
  onDecision,
}: {
  expenses: Expense[];
  loading: boolean;
  busy: boolean;
  onDecision: (id: string, decision: 'APPROVE' | 'REJECT' | 'PAY') => void;
}) {
  const columns: Column<Expense>[] = [
    {
      key: 'ref',
      header: 'Reference',
      cell: (e) => (
        <span>
          <span className="block font-medium text-navy-900">{e.reference}</span>
          <span className="block text-xs text-slate-500">{date(e.date)}</span>
        </span>
      ),
    },
    { key: 'payee', header: 'Payee', cell: (e) => e.payee },
    {
      key: 'account',
      header: 'Account',
      hideOnMobile: true,
      cell: (e) => (
        <span className="text-[13px] text-slate-600">
          {e.accountCode} {e.accountName}
        </span>
      ),
    },
    { key: 'amount', header: 'Amount', align: 'right', cell: (e) => money(e.amount) },
    { key: 'status', header: 'Status', cell: (e) => <StatusBadge status={e.status.toLowerCase()} /> },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (e) => (
        <span className="flex justify-end gap-1.5">
          {e.status === 'PENDING_APPROVAL' && (
            <>
              <Button size="xs" variant="ghost" disabled={busy} onClick={() => onDecision(e.id, 'REJECT')}>
                Reject
              </Button>
              <Button size="xs" variant="secondary" disabled={busy} onClick={() => onDecision(e.id, 'APPROVE')}>
                Approve
              </Button>
            </>
          )}
          {e.status === 'APPROVED' && (
            <Button size="xs" disabled={busy} onClick={() => onDecision(e.id, 'PAY')}>
              Record payment
            </Button>
          )}
        </span>
      ),
    },
  ];

  return (
    <Card>
      <CardHeader
        title="Expenses"
        subtitle="Approval must come from someone other than the officer who raised it"
      />
      <DataTable
        rows={expenses}
        columns={columns}
        rowKey={(e) => e.id}
        loading={loading}
        empty={
          <EmptyState
            icon={<Receipt className="h-5 w-5" />}
            title="No expenses recorded"
            body="Record what the community spends so the books and the bank agree."
          />
        }
      />
    </Card>
  );
}

function PeriodsTab({
  periods,
  onClose,
  onReopen,
  busy,
}: {
  periods: AccountingPeriod[];
  onClose: (period: AccountingPeriod) => void;
  onReopen: (period: AccountingPeriod) => void;
  busy: boolean;
}) {
  return (
    <Card>
      <CardHeader
        title="Accounting periods"
        subtitle="Closing a month freezes posting into it"
      />
      <ul className="divide-y divide-slate-100">
        {periods.map((p) => (
          <li key={p.id} className="flex items-center gap-3 px-5 py-3">
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-navy-900">{p.label}</span>
              <span className="block text-xs text-slate-500">
                {p.status === 'CLOSED' && p.closedAt ? `Closed ${date(p.closedAt)}` : 'Open'}
              </span>
            </span>
            {p.status === 'CLOSED' ? (
              <Button
                size="xs"
                variant="ghost"
                disabled={busy}
                icon={<LockOpen className="h-3.5 w-3.5" />}
                onClick={() => onReopen(p)}
              >
                Reopen
              </Button>
            ) : (
              <Button
                size="xs"
                variant="secondary"
                disabled={busy}
                icon={<Lock className="h-3.5 w-3.5" />}
                onClick={() => onClose(p)}
              >
                Close
              </Button>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}
