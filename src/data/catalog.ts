/**
 * Static reference data: the vocabulary the portal shows, not records.
 *
 * A fallback only. Roles are per community now and carry their own `label`,
 * which a community may rename — so anywhere the full role object is to hand,
 * read `role.label` instead of looking a name up here. This map exists for
 * the places that have only a name (a member row, a staff invitation) and
 * still need to print something sensible.
 *
 * Both spellings are listed: migration 20261111150000 dropped the
 * `COMMUNITY_` prefix, and a payload minted before it can still be in a
 * cookie.
 */

export const ROLE_LABELS: Record<string, string> = {
  REGISTRAR: 'Registrar',
  PRESIDENT: 'President',
  VICE_PRESIDENT: 'Vice President',
  SECRETARY: 'Secretary',
  FINANCIAL_SECRETARY: 'Financial Secretary',
  TREASURER: 'Treasurer',
  AUDITOR: 'Auditor',
  LOAN_OFFICER: 'Loan officer',
  MERCHANT_MANAGER: 'Merchant manager',
  MEMBER: 'Member',

  // Pre-rename spellings.
  COMMUNITY_OWNER: 'Registrar',
  COMMUNITY_ADMIN: 'Administrator',
  COMMUNITY_TREASURER: 'Treasurer',
  COMMUNITY_SECRETARY: 'Secretary',
  COMMUNITY_LOAN_OFFICER: 'Loan officer',
  COMMUNITY_AUDITOR: 'Auditor',
  COMMUNITY_MEMBER: 'Member',
};

export const roleName = (role: string) =>
  ROLE_LABELS[role] ??
  // A community's own invented post: CUSTOM_WELFARE_OFFICER -> Welfare officer.
  role
    .replace(/^(COMMUNITY|CUSTOM)_/, '')
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/^./, (c) => c.toUpperCase());

// ASSIGNABLE_ROLES used to live here. Roles are now per community and read
// from GET /communities/:id/roles — a hardcoded list cannot name a post a
// community invented, and this one had already drifted into offering three
// roles the API did not have.

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
