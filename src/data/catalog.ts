/**
 * Static reference data: the vocabulary the portal shows, not records.
 *
 * Role names here mirror the Role rows the API creates (COMMUNITY_OWNER and
 * friends); the label is what an officer should read on screen.
 */

export const ROLE_LABELS: Record<string, string> = {
  COMMUNITY_OWNER: 'Owner',
  COMMUNITY_ADMIN: 'Administrator',
  COMMUNITY_TREASURER: 'Treasurer',
  COMMUNITY_SECRETARY: 'Secretary',
  COMMUNITY_LOAN_OFFICER: 'Loan officer',
  COMMUNITY_AUDITOR: 'Auditor',
  COMMUNITY_MEMBER: 'Member',
};

export const roleName = (role: string) =>
  ROLE_LABELS[role] ??
  role.replace(/^COMMUNITY_/, '').replace(/_/g, ' ').toLowerCase().replace(/^./, (c) => c.toUpperCase());

/** Roles an owner can assign from the Staff screen. */
export const ASSIGNABLE_ROLES = [
  { value: 'COMMUNITY_ADMIN', label: 'Administrator', description: 'Everything except billing and ownership' },
  { value: 'COMMUNITY_TREASURER', label: 'Treasurer', description: 'Books, expenses, savings and reconciliation' },
  { value: 'COMMUNITY_SECRETARY', label: 'Secretary', description: 'Members, meetings, minutes and communications' },
  { value: 'COMMUNITY_LOAN_OFFICER', label: 'Loan officer', description: 'Loan applications and products' },
  { value: 'COMMUNITY_AUDITOR', label: 'Auditor', description: 'Read-only across the books and records' },
  {
    value: 'COMMUNITY_MERCHANT_MANAGER',
    label: 'Merchant manager',
    description: 'Payment links, invoices, settlement accounts and integrations',
  },
] as const;

export const ORG_CATEGORIES = [
  'Cooperative society',
  'Thrift association',
  'Ajo / Esusu',
  'Professional association',
  'Community development',
  'Religious organisation',
  'Alumni association',
  'Other',
] as const;

/** The services a community can offer its members in the Rendi app. These are
 * the chips on the Discover card, so the vocabulary is fixed rather than
 * free text — a member comparing communities sees the same words everywhere. */
export const SERVICE_TAGS = [
  'Loans',
  'Savings',
  'Welfare',
  'Contributions',
  'Programmes',
  'Partner offers',
  'Events',
] as const;

export const MEETING_KINDS = [
  { value: 'AGM', label: 'Annual general meeting' },
  { value: 'GENERAL', label: 'General meeting' },
  { value: 'EXECUTIVE', label: 'Executive meeting' },
  { value: 'SPECIAL', label: 'Special meeting' },
] as const;

export const DOCUMENT_CATEGORIES = [
  { value: 'GOVERNANCE', label: 'Governance' },
  { value: 'MINUTES', label: 'Minutes' },
  { value: 'FINANCIAL', label: 'Financial' },
  { value: 'FORMS', label: 'Forms' },
  { value: 'POLICIES', label: 'Policies' },
] as const;

export const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  ASSET: 'Assets',
  LIABILITY: 'Liabilities',
  EQUITY: 'Equity & reserves',
  INCOME: 'Income',
  EXPENSE: 'Expenditure',
};
