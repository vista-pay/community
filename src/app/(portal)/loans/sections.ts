import {
  Banknote,
  CheckCircle2,
  Inbox,
  Package,
  ShieldCheck,
  Undo2,
} from 'lucide-react';
import type { Route } from 'next';
import type { LoanStatus } from '@/types';

/**
 * The loan book, one page per stage.
 *
 * Read by both the hub and the sidebar so a section cannot exist in one and
 * be missing from the other. `statuses` is what makes each page a view of the
 * same list rather than a separate query.
 */
export const LOAN_SECTIONS: Array<{
  href: Route;
  label: string;
  description: string;
  icon: typeof Package;
  /** Which loans belong on this page. Absent for pages that are not loan lists. */
  statuses?: LoanStatus[];
}> = [
  {
    href: '/loans/offers' as Route,
    label: 'Loan offers',
    description: 'The terms you lend on — rate, amounts, tenors, who approves.',
    icon: Package,
  },
  {
    href: '/loans/requested' as Route,
    label: 'Requested',
    description: 'Applications waiting on a decision from the committee.',
    icon: Inbox,
    statuses: ['SUBMITTED', 'UNDER_REVIEW'],
  },
  {
    href: '/loans/approved' as Route,
    label: 'Approved',
    description: 'Approved but not yet paid out. Disbursing needs owner approval.',
    icon: CheckCircle2,
    statuses: ['APPROVED'],
  },
  {
    href: '/loans/disbursed' as Route,
    label: 'Disbursed',
    description: 'Money that has left the community and is being repaid.',
    icon: Banknote,
    statuses: ['DISBURSED', 'REPAYING', 'DEFAULTED'],
  },
  {
    href: '/loans/repayments' as Route,
    label: 'Repayments',
    description: 'Every repayment recorded, including on loans already settled.',
    icon: Undo2,
  },
  {
    href: '/loans/guarantors' as Route,
    label: 'Guarantors',
    description: 'Who stands behind each loan, and who has not answered yet.',
    icon: ShieldCheck,
  },
];
