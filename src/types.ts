/**
 * Shapes returned by the Rendi API.
 *
 * Money arrives as a decimal *string* and stays a string until it is
 * formatted. Parsing it to a JS number on the way in is how a cooperative's
 * balance ends up two kobo out, so anything that adds up money uses the
 * helpers in `lib/money.ts` rather than `+`.
 */

export type Money = string;
export type IsoDate = string;

// ───────────────────────────── Session ─────────────────────────────

export interface PortalUser {
  id: string;
  email: string;
  phone?: string;
  firstName?: string | null;
  lastName?: string | null;
  name: string;
}

export interface CommunitySummary {
  id: string;
  name: string;
  slug: string;
  role: string;
  title: string | null;
  membershipStatus: 'PENDING' | 'ACTIVE' | 'REJECTED' | 'SUSPENDED' | 'LEFT';
  status: CommunityStatus;
  memberCount: number;
  /** Verified but the public listing page is still a draft: the portal gates on this. */
  listingSetupRequired: boolean;
}

export interface PortalSession {
  user: PortalUser;
  communities: CommunitySummary[];
  community: CommunitySummary | null;
}

export type CommunityStatus = 'PENDING' | 'VERIFIED' | 'SUSPENDED' | 'REJECTED';

// ───────────────────────────── Dashboard ─────────────────────────────

export interface CommunityWallet {
  depositAccount: { accountNumber: string; bankName: string; accountName: string } | null;
  id: string;
  accounts: Array<{ currencyCode: string; available: Money; pending: Money; held: Money }>;
}

export interface WalletTransaction {
  id: string;
  reference: string;
  type: string;
  status: string;
  credit: boolean;
  amount: Money;
  currencyCode: string;
  counterparty: string | null;
  narration: string | null;
  createdAt: IsoDate;
}

export interface WalletData {
  wallet: CommunityWallet | null;
  transactions: WalletTransaction[];
}

export interface DashboardData {
  community: {
    id: string;
    name: string;
    slug: string;
    status: CommunityStatus;
    isDiscoverable: boolean;
    logoUrl: string | null;
    category: string | null;
    city: string | null;
    country: string;
    createdAt: IsoDate;
  };
  members: { active: number; pendingApplications: number };
  wallet: CommunityWallet | null;
  ajo: { groups: number; active: number; arrears: Money; obligationsOutstanding: number };
  lending: {
    applications: number;
    awaitingReview: number;
    outstanding: Money;
    defaulted: number;
  };
  actions: {
    pendingApplications: number;
    loansAwaitingReview: number;
    expensesAwaitingApproval: number;
    unpaidFines: number;
    unpaidFinesValue: Money;
  };
  upcomingMeeting: { id: string; title: string; scheduledFor: IsoDate; venue: string } | null;
  subscription: { id: string; plan: string; status: string; renewsAt: IsoDate | null } | null;
  recentActivity: Array<{
    id: string;
    action: string;
    entityType: string;
    actorId: string | null;
    at: IsoDate;
  }>;
}

// ───────────────────────────── Members ─────────────────────────────

export type MemberStatus = 'PENDING' | 'ACTIVE' | 'REJECTED' | 'SUSPENDED' | 'LEFT';

export interface MemberRow {
  id: string;
  userId: string;
  memberNumber: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  title: string | null;
  status: MemberStatus;
  kyc: string;
  joinedAt: IsoDate;
  city: string | null;
  state: string | null;
  savings: Money;
  contributions: Money;
  loanBalance: Money;
  unpaidFines: number;
  ajoGroupIds: string[];
}

export interface MemberDetail {
  id: string;
  userId: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  title: string | null;
  status: MemberStatus;
  joinedAt: IsoDate;
  kyc: string;
  address: string | null;
  city: string | null;
  state: string | null;
  savingsAccounts: Array<{
    id: string;
    accountNumber: string;
    product: string;
    balance: Money;
    status: string;
    recent: Array<{ id: string; type: string; amount: Money; balanceAfter: Money; at: IsoDate }>;
  }>;
  fines: Array<{ id: string; reason: string; amount: Money; status: FineStatus; issuedAt: IsoDate }>;
  attendance: Array<{ meetingId: string; title: string; date: IsoDate; state: AttendanceState }>;
  ajo: Array<{
    membershipId: string;
    group: { id: string; name: string; contributionAmount: Money; currencyCode: string };
    obligations: Array<{
      id: string;
      periodNumber: number;
      dueDate: IsoDate;
      amountDue: Money;
      amountPaid: Money;
      status: ObligationStatus;
    }>;
    loans: Array<{
      id: string;
      reference: string;
      status: LoanStatus;
      principal: Money;
      outstanding: Money;
      dueDate: IsoDate | null;
    }>;
    positions: Array<{
      position: number;
      status: string;
      payoutStatus: string | null;
      paidAt: IsoDate | null;
    }>;
  }>;
}

// ───────────────────────────── Join review ─────────────────────────────

export type JoinReviewStage =
  | 'NEW'
  | 'IN_REVIEW'
  | 'INFO_REQUESTED'
  | 'AWAITING_REFEREE'
  | 'APPROVED'
  | 'DECLINED'
  | 'WAITLISTED';

export type RefereeState = 'NOT_REQUIRED' | 'PENDING' | 'CONFIRMED' | 'DECLINED';
export type IdCheckState = 'NOT_REQUIRED' | 'PENDING' | 'PASSED' | 'FAILED';
export type EntryFeeState = 'NOT_REQUIRED' | 'UNPAID' | 'PAID';

export interface JoinRequest {
  membershipId: string;
  reference: string;
  userId: string;
  name: string;
  email: string;
  phone: string;
  location: string | null;
  applicationNote: string | null;
  appliedAt: IsoDate;
  kycStatus: string;
  kycTier: string;
  /** Tier 2 reached (or fully approved) — the same bar the join gate enforces. */
  identityVerified: boolean;
  review: {
    stage: JoinReviewStage;
    source?: string;
    answers?: Record<string, string> | null;
    refereeId?: string | null;
    refereeState?: RefereeState;
    phoneVerified?: boolean;
    idCheck?: IdCheckState;
    entryFee?: EntryFeeState;
    declineReason?: string | null;
    notes: Array<{
      id: string;
      authorId: string;
      text: string;
      toApplicant: boolean;
      at: IsoDate;
    }>;
  };
}

// ───────────────────────────── Listing ─────────────────────────────

export type ListingStatus = 'DRAFT' | 'IN_REVIEW' | 'LIVE' | 'PAUSED' | 'REJECTED';
export type JoinQuestionKind = 'SHORT' | 'LONG' | 'CHOICE' | 'YESNO';

export interface Listing {
  id: string;
  communityId: string;
  status: ListingStatus;
  visibility: 'PUBLIC' | 'UNLISTED';
  tagline: string | null;
  category: string | null;
  about: string | null;
  joinMode: 'REQUEST' | 'OPEN' | 'INVITE_ONLY';
  entryFee: Money;
  requirements: string[];
  tags: string[];
  coverImageUrl: string | null;
  requireReferee: boolean;
  requireIdCheck: boolean;
  showMemberCount: boolean;
  showLocation: boolean;
  approvalSteps: string[];
  autoDeclineAfterDays: number;
  views: number;
  rejectionNote: string | null;
  questions: Array<{
    id: string;
    label: string;
    kind: JoinQuestionKind;
    options: string[];
    isRequired: boolean;
    position: number;
  }>;
  community: {
    status: CommunityStatus;
    isDiscoverable: boolean;
    name: string;
    city: string | null;
    category: string | null;
    logoUrl: string | null;
  } | null;
  stats: { views: number; requests: number; approved: number };
}

// ───────────────────────────── Accounting ─────────────────────────────

export type BookAccountType = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'INCOME' | 'EXPENSE';
export type BookEntryStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'POSTED' | 'REVERSED';

export interface BookAccount {
  id: string;
  code: string;
  name: string;
  type: BookAccountType;
  group: string;
  description: string | null;
  isSystem: boolean;
  isActive: boolean;
  balance: Money;
}

export interface PostingRule {
  event: string;
  debit: string;
  credit: string;
  note?: string;
}

export interface JournalEntry {
  id: string;
  reference: string;
  date: IsoDate;
  periodKey: string;
  description: string;
  source: string;
  status: BookEntryStatus;
  createdById: string;
  approvedById: string | null;
  attachmentUrl: string | null;
  sourceReference: string | null;
  reversalOfId: string | null;
  total: Money;
  lines: Array<{
    id: string;
    lineNumber: number;
    accountId: string;
    accountCode: string;
    accountName: string;
    accountType: BookAccountType;
    debit: Money;
    credit: Money;
    memo: string | null;
  }>;
}

export interface Statements {
  period: { from: string | null; to: string | null };
  rows: Array<{
    id: string;
    code: string;
    name: string;
    type: BookAccountType;
    group: string;
    debit: Money;
    credit: Money;
    balance: Money;
  }>;
  trialBalance: { debit: Money; credit: Money; balanced: boolean };
  incomeStatement: { income: Money; expense: Money; surplus: Money };
  balanceSheet: { assets: Money; liabilities: Money; equity: Money; surplus: Money };
}

export interface CashAccount {
  id: string;
  name: string;
  institution: string;
  maskedNumber: string;
  kind: 'BANK' | 'CASH' | 'CLEARING';
  ledgerCode: string;
  bookBalance: Money;
  statementBalance: Money;
  statementDate: IsoDate | null;
  lastReconciledAt: IsoDate | null;
  difference: Money;
  reconciled: boolean;
}

export type ExpenseStatus = 'PENDING_APPROVAL' | 'APPROVED' | 'PAID' | 'REJECTED';

export interface Expense {
  id: string;
  reference: string;
  date: IsoDate;
  payee: string;
  accountCode: string;
  accountName: string;
  amount: Money;
  paidFrom: { id: string; name: string } | null;
  status: ExpenseStatus;
  hasReceipt: boolean;
  note: string | null;
  rejectionReason: string | null;
  journalEntryId: string | null;
}

export interface BudgetLine {
  accountId: string;
  accountCode: string;
  accountName: string;
  type: BookAccountType;
  annual: Money;
  actual: Money;
  variance: Money;
}

export interface AccountingPeriod {
  id: string;
  periodKey: string;
  label: string;
  status: 'OPEN' | 'CLOSED';
  closedAt: IsoDate | null;
}

export interface AccountLedger {
  account: { id: string; code: string; name: string; type: BookAccountType };
  lines: Array<{
    entryId: string;
    reference: string;
    date: IsoDate;
    description: string;
    memo: string | null;
    debit: Money;
    credit: Money;
    running: Money;
  }>;
}

// ───────────────────────────── Governance ─────────────────────────────

export type MeetingKind = 'AGM' | 'GENERAL' | 'EXECUTIVE' | 'SPECIAL';
export type MeetingStatus = 'SCHEDULED' | 'HELD' | 'CANCELLED';
export type MinutesStatus = 'NONE' | 'DRAFT' | 'APPROVED';
export type AttendanceState = 'PRESENT' | 'ABSENT' | 'APOLOGY';

export interface Meeting {
  id: string;
  title: string;
  kind: MeetingKind;
  scheduledFor: IsoDate;
  venue: string;
  agenda: string[];
  status: MeetingStatus;
  minutes: string | null;
  minutesStatus: MinutesStatus;
  resolutions: string[];
  quorumPercent: number;
  attendance: Array<{ memberId: string; name: string; state: AttendanceState }>;
  quorum: {
    present: number;
    apologies: number;
    eligible: number;
    required: number;
    met: boolean | null;
  };
}

export type PollStatus = 'SCHEDULED' | 'OPEN' | 'CLOSED' | 'CERTIFIED';

export interface Poll {
  id: string;
  title: string;
  kind: 'POLL' | 'ELECTION' | 'RESOLUTION';
  question: string;
  eligibility: 'ALL_ACTIVE' | 'OFFICERS' | 'SHAREHOLDERS';
  isAnonymous: boolean;
  opensAt: IsoDate;
  closesAt: IsoDate;
  status: PollStatus;
  certifiedAt: IsoDate | null;
  /** Live tally; voters listed per option unless the ballot is anonymous. */
  options: Array<{ id: string; label: string; votes: number; voters?: string[] }>;
  totalVotes: number;
  eligibleCount: number;
  turnout: number;
  myVote: string | null;
}

export interface CommunityDocument {
  id: string;
  name: string;
  category: 'GOVERNANCE' | 'MINUTES' | 'FINANCIAL' | 'FORMS' | 'POLICIES';
  visibility: 'MEMBERS' | 'OFFICERS';
  fileUrl: string;
  sizeBytes: number;
  version: number;
  uploadedById: string;
  createdAt: IsoDate;
}

export type FineStatus = 'UNPAID' | 'PAID' | 'WAIVED';

export interface Fine {
  id: string;
  memberId: string;
  memberName: string;
  reason: string;
  amount: Money;
  status: FineStatus;
  waiverReason: string | null;
  issuedAt: IsoDate;
  paidAt: IsoDate | null;
}

// ───────────────────────────── Savings ─────────────────────────────

export type SavingsWithdrawalPolicy = 'LOCKED' | 'NOTICE' | 'ANYTIME';

export interface SavingsProduct {
  id: string;
  name: string;
  description: string | null;
  interestRate: string;
  minBalance: Money;
  withdrawalPolicy: SavingsWithdrawalPolicy;
  noticeDays: number;
  currencyCode: string;
  isActive: boolean;
  _count?: { accounts: number };
}

export interface SavingsAccountRow {
  id: string;
  accountNumber: string;
  memberId: string;
  memberName: string;
  product: { id: string; name: string; policy: SavingsWithdrawalPolicy };
  balance: Money;
  status: 'ACTIVE' | 'DORMANT' | 'CLOSED';
  openedAt: IsoDate;
}

export interface SavingsWithdrawalRequestRow {
  id: string;
  reference: string;
  memberName: string;
  productName: string;
  accountNumber: string;
  accountBalance: string;
  amount: string;
  note: string | null;
  status: 'PENDING' | 'PAID' | 'REJECTED';
  reviewNote: string | null;
  requestedAt: IsoDate;
  decidedAt: IsoDate | null;
  paidAt: IsoDate | null;
}

export interface SavingsOverview {
  accounts: SavingsAccountRow[];
  totals: {
    members: number;
    savingsLedger: Money;
    controlAccount: Money;
    difference: Money;
    inAgreement: boolean;
  };
}

export interface SavingsStatement {
  id: string;
  accountNumber: string;
  memberName: string;
  product: {
    name: string;
    policy: SavingsWithdrawalPolicy;
    noticeDays: number;
    minBalance: Money;
  };
  balance: Money;
  status: string;
  transactions: Array<{
    id: string;
    reference: string;
    type: 'DEPOSIT' | 'WITHDRAWAL' | 'INTEREST' | 'ADJUSTMENT';
    amount: Money;
    balanceAfter: Money;
    note: string | null;
    at: IsoDate;
  }>;
}

// ───────────────────────────── Lending ─────────────────────────────

export type LoanStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'DISBURSED'
  | 'REPAYING'
  | 'SETTLED'
  | 'DEFAULTED'
  | 'CANCELLED';

export interface LoanProduct {
  id: string;
  name: string;
  description: string | null;
  minPrincipal: Money;
  maxPrincipal: Money;
  tenorMonths: number[];
  interestRate: string;
  rateLabel: string;
  repaymentFrequency: 'WEEKLY' | 'MONTHLY';
  processingFeePercent: string;
  eligibility: string[];
  requiredApprovals: string[];
  currencyCode: string;
  status: 'ACTIVE' | 'PAUSED';
  loanCount: number;
}

export interface LoanQuote {
  product: { id: string; name: string; rateLabel: string };
  principal: Money;
  tenorMonths: number;
  serviceCharge: Money;
  processingFee: Money;
  netDisbursed: Money;
  totalRepayable: Money;
  instalments: number;
  perInstalment: Money;
  finalInstalment: Money;
  currencyCode: string;
}

export interface Loan {
  id: string;
  loanReference: string;
  status: LoanStatus;
  principal: Money;
  interestRate: string;
  totalRepayable: Money;
  amountRepaid: Money;
  outstanding: Money;
  currencyCode: string;
  termDays: number;
  purpose: string | null;
  dueDate: IsoDate | null;
  disbursedAt: IsoDate | null;
  settledAt: IsoDate | null;
  borrower?: string;
}

// ───────────────────────────── Ajo ─────────────────────────────

export type ObligationStatus =
  | 'DUE'
  | 'PENDING'
  | 'PAID'
  | 'OVERDUE'
  | 'WAIVED'
  | 'FAILED'
  | 'REVERSED';

export interface AjoGroupSummary {
  groupId: string;
  name: string;
  /** Reusable join code. Null for groups that do not publish one. */
  invitationCode?: string | null;
  type: 'PERSONAL' | 'MANAGED' | 'COOPERATIVE';
  status: string;
  frequency: string;
  contributionAmount: Money;
  currencyCode: string;
  memberCount: number;
  memberLimit: number;
  role: string;
  /** The running cycle, when there is one. Drives the round label. */
  activeCycle: {
    id: string;
    cycleNumber: number;
    status: string;
    totalPeriods: number;
    currentRound: number | null;
    progress: number;
  } | null;
}

export interface AjoGroupDetail {
  id: string;
  name: string;
  description: string | null;
  type: string;
  status: string;
  frequency: string;
  contributionAmount: Money;
  currencyCode: string;
  memberLimit: number;
  invitationCode: string | null;
  /** How payout numbers are decided: ADMIN_ASSIGNED, MEMBER_SELECTED or RANDOM_DRAW. */
  payoutSelectionMode: string;
  /** MEMBER_SELECTED only: after this, unclaimed numbers can be auto-assigned. */
  selectionDeadline: IsoDate | null;
  pool: { balance: Money } | null;
  members: Array<{
    membershipId: string;
    userId: string;
    name: string;
    role: string;
    status: string;
    joinedAt: IsoDate | null;
  }>;
  cycles: Array<{
    id: string;
    cycleNumber: number;
    status: string;
    totalPeriods: number;
    startDate: IsoDate;
    endDate: IsoDate;
  }>;
}

export interface ContributionBoardRow {
  membershipId: string;
  name: string;
  status: ObligationStatus;
  amountDue: Money;
  amountPaid: Money;
  dueDate: IsoDate;
}

export interface ContributionBoard {
  cycleId: string;
  round: number;
  members: ContributionBoardRow[];
  collected: Money;
  expected: Money;
}

/** One payout turn, as `/ajo-cycles/:id/payouts` returns it. */
export interface AjoPayoutRow {
  id: string;
  position: number;
  recipient: string;
  payoutReference: string;
  status:
    | 'SCHEDULED'
    | 'PENDING_APPROVAL'
    | 'APPROVED'
    | 'PROCESSING'
    | 'PAID'
    | 'FAILED'
    | 'REVERSED';
  grossAmount: Money;
  vistaFee: Money;
  organizerFee: Money;
  providerFee: Money;
  tax: Money;
  netAmount: Money;
  currencyCode: string;
  scheduledFor: IsoDate;
  paidAt: IsoDate | null;
  failureReason: string | null;
}

export interface PayoutPosition {
  id: string;
  position: number;
  status: string;
  scheduledPayoutDate: IsoDate | null;
  holder: { membershipId: string; name: string } | null;
  payout: { id: string; status: string; netAmount: Money } | null;
}

// ───────────────────────── Communications ─────────────────────────

export interface Broadcast {
  id: string;
  title: string;
  body: string;
  channel: 'SMS' | 'EMAIL' | 'APP';
  audience: string;
  status: 'DRAFT' | 'SCHEDULED' | 'SENT' | 'FAILED';
  scheduledFor: IsoDate | null;
  sentAt: IsoDate | null;
  recipientCount: number;
  deliveredCount: number;
  failureReason: string | null;
  createdAt: IsoDate;
}

export interface Announcement {
  id: string;
  audience: 'COMMUNITY' | 'AJO_GROUP';
  title: string | null;
  body: string;
  isPinned: boolean;
  isRead: boolean;
  author: string | null;
  createdAt: IsoDate;
}

// ───────────────────────────── Billing ─────────────────────────────

export interface SubscriptionPlan {
  id: string;
  code: string;
  name: string;
  description: string | null;
  monthlyPrice: Money;
  annualPrice: Money;
  currencyCode: string;
  maxMembers: number | null;
  maxStaffSeats: number | null;
  maxAjoGroups: number | null;
  features: string[];
  isActive: boolean;
}

export interface Subscription {
  id: string;
  communityId: string;
  plan: SubscriptionPlan;
  status: string;
  billingPeriod: string;
  currentPeriodStart: IsoDate;
  currentPeriodEnd: IsoDate;
  trialEndsAt: IsoDate | null;
  graceEndsAt: IsoDate | null;
  invoices?: Array<{
    id: string;
    invoiceNumber: string;
    status: string;
    total: Money;
    currencyCode: string;
    issuedAt: IsoDate;
    dueAt: IsoDate;
    paidAt: IsoDate | null;
  }>;
}

// ───────────────────────────── Services ─────────────────────────────

export interface ServiceCatalogItem {
  id: string;
  code: string;
  name: string;
  description: string | null;
  feeCode: string | null;
  requiresApproval: boolean;
}

export type ServiceRequestStatus =
  | 'SUBMITTED'
  | 'IN_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'FULFILLED'
  | 'CANCELLED';

export interface ServiceRequest {
  id: string;
  status: ServiceRequestStatus;
  createdAt: IsoDate;
  service: ServiceCatalogItem;
}

// ───────────────────────────── Audit ─────────────────────────────

export interface AuditEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  actorId: string | null;
  actorType: string;
  reason: string | null;
  createdAt: IsoDate;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: IsoDate;
  metadata?: Record<string, unknown> | null;
}

// ───────────────────────────── Welfare ─────────────────────────────

export type WelfareStatus = 'SUBMITTED' | 'INFO_REQUESTED' | 'APPROVED' | 'REJECTED' | 'PAID';

export interface WelfareRequestRow {
  id: string;
  reference: string;
  type: 'MEDICAL' | 'BEREAVEMENT' | 'EDUCATION' | 'OTHER';
  customType: string | null;
  amount: string;
  story: string;
  status: WelfareStatus;
  communityId: string;
  decidedAt: IsoDate | null;
  paidAt: IsoDate | null;
  createdAt: IsoDate;
  memberName: string;
}

export interface WelfareRequestDetail extends Omit<WelfareRequestRow, 'memberName'> {
  communityName: string;
  messages: {
    id: string;
    text: string;
    attachmentUrl: string | null;
    fromOfficer: boolean;
    authorName: string;
    authorTitle: string | null;
    at: IsoDate;
  }[];
}

export interface Opportunity {
  id: string;
  title: string;
  kind: 'PROGRAMME' | 'PARTNER_OFFER';
  category: string | null;
  description: string;
  detail: string | null;
  howToApply: string | null;
  closesAt: IsoDate | null;
  isActive: boolean;
  createdAt: IsoDate;
}

/** A contribution group as the portal's community-scoped endpoint returns it. */
export interface CommunityGroupRow {
  groupId: string;
  name: string;
  description: string | null;
  status: string;
  contributionAmount: Money;
  currencyCode: string;
  frequency: string;
  memberCount: number;
  memberLimit: number;
  startDate: IsoDate;
  payoutSelectionMode: string;
  rulesVersion: number;
  isOpen: boolean;
  myStatus: string | null;
  invitationCode?: string;
  pendingRequests?: number;
  activeCycle: { id: string; cycleNumber: number; totalPeriods: number; status: string } | null;
}

export interface AjoJoinRequestRow {
  membershipId: string;
  userId: string;
  name: string;
  phone: string;
  kycTier: string;
  kycApproved: boolean;
  acceptedRules: boolean;
  requestedAt: IsoDate;
}

/** Full loan application, as the committee reviews it. */
export interface LoanApplicationDetail extends Omit<Loan, 'borrower'> {
  createdAt: IsoDate;
  groupName: string;
  termsAcceptedAt: IsoDate | null;
  interestAmount: Money;
  processingFee: Money;
  netDisbursed: Money;
  approvedAt: IsoDate | null;
  reviewNotes: string | null;
  productName: string | null;
  borrower: {
    userId: string;
    memberId: string | null;
    name: string;
    email: string;
    phone: string;
    kycTier: string;
    kycStatus: string;
    membershipStatus: string;
    memberSince: IsoDate | null;
    savingsBalance: Money | null;
  } | null;
  guarantors: {
    id: string;
    userId: string | null;
    name: string;
    email?: string | null;
    phone?: string | null;
    external?: boolean;
    kycTier?: string | null;
    kycStatus?: string | null;
    status: 'PENDING' | 'CONFIRMED' | 'DECLINED';
  }[];
  schedule: { number: number; amount: Money; dueDate: IsoDate; status: 'PAID' | 'SCHEDULED' }[];
}
