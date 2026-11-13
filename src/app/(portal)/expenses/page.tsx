import type { Metadata } from 'next';
import { communityGet } from '@/server/portal-data';
import type { BookAccount, CashAccount, Expense, PostingRule } from '@/types';
import { ExpensesClient } from './expenses-client';

export const metadata: Metadata = { title: 'Expenses' };

export default async function ExpensesPage() {
  const [expenses, chart, cashAccounts] = await Promise.all([
    communityGet<Expense[]>('/accounting/expenses'),
    communityGet<{ accounts: BookAccount[]; postingRules: PostingRule[] }>('/accounting/accounts'),
    communityGet<CashAccount[]>('/accounting/cash-accounts'),
  ]);

  return <ExpensesClient initial={expenses} accounts={chart.accounts} cashAccounts={cashAccounts} />;
}
