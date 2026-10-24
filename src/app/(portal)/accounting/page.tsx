import type { Metadata } from 'next';
import { communityGet } from '@/server/portal-data';
import type {
  AccountingPeriod,
  BookAccount,
  CashAccount,
  Expense,
  JournalEntry,
  PostingRule,
  Statements,
} from '@/types';
import { AccountingClient } from './accounting-client';

export const metadata: Metadata = { title: 'Accounting' };

export default async function AccountingPage() {
  // One parallel fetch for the whole screen: the tabs switch instantly
  // afterwards, which is how an officer actually works through the books.
  const [chart, journals, statements, cashAccounts, expenses, periods] = await Promise.all([
    communityGet<{ accounts: BookAccount[]; postingRules: PostingRule[] }>('/accounting/accounts'),
    communityGet<JournalEntry[]>('/accounting/journals'),
    communityGet<Statements>('/accounting/statements'),
    communityGet<CashAccount[]>('/accounting/cash-accounts'),
    communityGet<Expense[]>('/accounting/expenses'),
    communityGet<AccountingPeriod[]>('/accounting/periods'),
  ]);

  return (
    <AccountingClient
      initial={{ chart, journals, statements, cashAccounts, expenses, periods }}
    />
  );
}
