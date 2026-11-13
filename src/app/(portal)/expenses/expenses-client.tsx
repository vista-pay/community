'use client';

import { useMemo, useState } from 'react';
import { ArrowUpRight, CheckCircle2, Clock3, Plus, ReceiptText, Wallet } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  DataTable,
  EmptyState,
  LinkButton,
  PageHeader,
  Stat,
  StatusBadge,
  Tabs,
  type Column,
} from '@/components/ui';
import { useCommunityId } from '@/components/providers/session-provider';
import { useToast } from '@/components/providers/toast-provider';
import { useMutation, useQuery } from '@/hooks/use-query';
import { date, money } from '@/lib/format';
import { portalApi } from '@/services/portal';
import type { BookAccount, CashAccount, Expense, ExpenseStatus } from '@/types';
import { ExpenseModal } from '../accounting/expense-modal';

type View = 'all' | 'pending' | 'approved' | 'paid';

export function ExpensesClient({
  initial,
  accounts,
  cashAccounts,
}: {
  initial: Expense[];
  accounts: BookAccount[];
  cashAccounts: CashAccount[];
}) {
  const communityId = useCommunityId();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>('all');
  const expenses = useQuery(() => portalApi.expenses(communityId), [communityId], { initial });

  const review = useMutation(
    ({ id, decision }: { id: string; decision: 'APPROVE' | 'REJECT' }) =>
      portalApi.reviewExpense(communityId, id, { decision }),
    {
      onSuccess: async () => {
        toast('Expense updated', 'success');
        await expenses.refresh();
      },
      onError: (message) => toast('Could not update expense', 'error', message),
    },
  );

  const rows = expenses.data ?? initial;
  const pending = rows.filter((item) => item.status === 'PENDING_APPROVAL');
  const approved = rows.filter((item) => item.status === 'APPROVED');
  const paid = rows.filter((item) => item.status === 'PAID');
  const visible = useMemo(() => {
    const status: Partial<Record<View, ExpenseStatus>> = {
      pending: 'PENDING_APPROVAL',
      approved: 'APPROVED',
      paid: 'PAID',
    };
    return status[view] ? rows.filter((item) => item.status === status[view]) : rows;
  }, [rows, view]);

  const columns: Column<Expense>[] = [
    {
      key: 'expense',
      header: 'Expense',
      cell: (item) => (
        <div className="min-w-0">
          <p className="font-medium text-navy-900">{item.payee}</p>
          <p className="text-xs text-slate-500">{item.reference} · {date(item.date)}</p>
        </div>
      ),
    },
    {
      key: 'account',
      header: 'Chart of account',
      hideOnMobile: true,
      cell: (item) => (
        <div>
          <p className="text-[13px] font-medium text-navy-900">{item.accountName}</p>
          <p className="text-xs text-slate-500">{item.accountCode}</p>
        </div>
      ),
    },
    { key: 'amount', header: 'Amount', align: 'right', cell: (item) => <span className="tnum font-medium">{money(item.amount)}</span> },
    { key: 'status', header: 'Status', cell: (item) => <StatusBadge status={item.status.toLowerCase()} /> },
    {
      key: 'action',
      header: '',
      align: 'right',
      cell: (item) => (
        <div className="flex flex-wrap justify-end gap-1.5">
          {item.status === 'PENDING_APPROVAL' && (
            <>
              <Button size="xs" variant="ghost" disabled={review.pending} onClick={() => void review.run({ id: item.id, decision: 'REJECT' })}>Reject</Button>
              <Button size="xs" variant="secondary" disabled={review.pending} onClick={() => void review.run({ id: item.id, decision: 'APPROVE' })}>Approve</Button>
            </>
          )}
          {item.status === 'APPROVED' && (
            <LinkButton
              size="xs"
              href={`/merchant/payouts?tab=send&expenseId=${encodeURIComponent(item.id)}`}
              iconRight={<ArrowUpRight className="h-3.5 w-3.5" />}
            >
              Pay from merchant
            </LinkButton>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Expenses"
        subtitle="Record spending, approve it, then pay it from the merchant wallet against the correct account."
        actions={<Button onClick={() => setOpen(true)} icon={<Plus className="h-4 w-4" />}>Record expense</Button>}
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Awaiting approval" value={pending.length} icon={<Clock3 className="h-4 w-4" />} tone={pending.length ? 'warning' : 'default'} />
        <Stat label="Ready to pay" value={money(approved.reduce((sum, item) => sum + Number(item.amount), 0))} hint={`${approved.length} approved expense${approved.length === 1 ? '' : 's'}`} icon={<Wallet className="h-4 w-4" />} />
        <Stat label="Paid" value={money(paid.reduce((sum, item) => sum + Number(item.amount), 0))} hint={`${paid.length} completed payment${paid.length === 1 ? '' : 's'}`} icon={<CheckCircle2 className="h-4 w-4" />} tone="positive" />
      </div>

      <Tabs
        className="mb-4"
        value={view}
        onChange={setView}
        tabs={[
          { value: 'all', label: 'All', count: rows.length },
          { value: 'pending', label: 'Awaiting approval', count: pending.length || undefined },
          { value: 'approved', label: 'Ready to pay', count: approved.length || undefined },
          { value: 'paid', label: 'Paid', count: paid.length || undefined },
        ]}
      />

      <Card>
        <CardHeader
          title="Expense register"
          subtitle="Every expense retains its evidence, approval status, payment and Chart of Accounts classification."
          action={<Badge tone="slate">{visible.length} records</Badge>}
        />
        <DataTable
          rows={visible}
          columns={columns}
          rowKey={(item) => item.id}
          loading={expenses.loading}
          empty={<EmptyState icon={<ReceiptText className="h-5 w-5" />} title="No expenses here" body="Record community spending so approvals, merchant payments and the books stay connected." action={<Button onClick={() => setOpen(true)}>Record expense</Button>} />}
        />
      </Card>

      <ExpenseModal
        open={open}
        onClose={() => setOpen(false)}
        accounts={accounts}
        cashAccounts={cashAccounts}
        communityId={communityId}
        onCreated={expenses.refresh}
      />
    </>
  );
}
