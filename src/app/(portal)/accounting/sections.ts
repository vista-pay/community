import {
  BookOpen,
  FileSpreadsheet,
  ListTree,
  NotebookPen,
  Rows3,
  Scale,
  TrendingUp,
} from 'lucide-react';
import type { Route } from 'next';

/**
 * The accounting sections, in one place.
 *
 * The sidebar, the hub page and the breadcrumbs all read this list, so a new
 * section appears in all three at once rather than being added to the nav and
 * quietly missing from the hub.
 */
export const ACCOUNTING_SECTIONS: Array<{
  href: Route;
  label: string;
  description: string;
  icon: typeof BookOpen;
}> = [
  {
    href: '/accounting/chart-of-accounts' as Route,
    label: 'Chart of accounts',
    description: 'Every account the books post to, grouped by class.',
    icon: ListTree,
  },
  {
    href: '/accounting/ledger' as Route,
    label: 'Ledger entries',
    description: 'Every posting against a single account, with its running balance.',
    icon: Rows3,
  },
  {
    href: '/accounting/journals' as Route,
    label: 'Journals',
    description: 'Draft, post and reverse entries. Automatic postings appear here too.',
    icon: NotebookPen,
  },
  {
    href: '/accounting/books' as Route,
    label: 'Books',
    description: 'Balance sheet and the position of each account class.',
    icon: BookOpen,
  },
  {
    href: '/trial-balance' as Route,
    label: 'Trial balance',
    description: 'Every account side by side, and whether the books balance.',
    icon: Scale,
  },
  {
    href: '/accounting/revenue' as Route,
    label: 'Revenue',
    description: 'Where income came from and what it cost to earn.',
    icon: TrendingUp,
  },
  {
    href: '/accounting/statements' as Route,
    label: 'Statements',
    description: 'Filter by period and account, and export to CSV.',
    icon: FileSpreadsheet,
  },
];
