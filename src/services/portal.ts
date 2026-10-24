/**
 * Every API call the portal makes, in one place and typed.
 *
 * Each function takes the community id explicitly rather than reading it from
 * a context: a server component and a client component both call the same
 * function, and the server has no React context to read from.
 *
 * `path()` builds the community-scoped prefix once so a typo in one screen
 * cannot quietly point at the wrong community.
 */
import { del, get, patch, post } from '@/lib/api';
import type {
  AccountLedger,
  AccountingPeriod,
  AjoGroupDetail,
  AjoGroupSummary,
  Announcement,
  AuditEntry,
  BookAccount,
  Broadcast,
  BudgetLine,
  CashAccount,
  CommunityDocument,
  ContributionBoard,
  DashboardData,
  Expense,
  Fine,
  JoinRequest,
  JoinReviewStage,
  JournalEntry,
  Listing,
  Loan,
  LoanProduct,
  LoanQuote,
  Meeting,
  MemberDetail,
  MemberRow,
  NotificationItem,
  PayoutPosition,
  Poll,
  PostingRule,
  SavingsOverview,
  SavingsProduct,
  SavingsStatement,
  ServiceCatalogItem,
  ServiceRequest,
  Statements,
  Subscription,
  SubscriptionPlan,
} from '@/types';

const path = (communityId: string, suffix = '') => `/communities/${communityId}${suffix}`;

// ───────────────────────────── Overview ─────────────────────────────

export const portalApi = {
  dashboard: (communityId: string) => get<DashboardData>(path(communityId, '/dashboard')),

  auditLogs: (communityId: string, page = 1, limit = 50) =>
    get<AuditEntry[]>(path(communityId, '/audit-logs'), { page, limit }),

  // ───────────────────────────── Members ─────────────────────────────

  members: (communityId: string, search?: string) =>
    get<MemberRow[]>(path(communityId, '/members'), { search }),

  member: (communityId: string, memberId: string) =>
    get<MemberDetail>(path(communityId, `/members/${memberId}`)),

  addStaff: (
    communityId: string,
    body: { userId?: string; email?: string; roleName: string; title?: string },
  ) => post<unknown>(path(communityId, '/staff'), body),

  removeStaff: (communityId: string, memberId: string) =>
    del<unknown>(path(communityId, `/staff/${memberId}`)),

  // ───────────────────────── Join review ─────────────────────────

  joinQueue: (communityId: string, stage?: JoinReviewStage) =>
    get<JoinRequest[]>(path(communityId, '/join-review'), { stage }),

  advanceJoinReview: (
    communityId: string,
    membershipId: string,
    body: {
      stage: JoinReviewStage;
      admit?: boolean;
      declineReason?: string;
      refereeState?: string;
      idCheck?: string;
      entryFee?: string;
      note?: string;
    },
  ) => patch<unknown>(path(communityId, `/join-review/${membershipId}`), body),

  addJoinNote: (
    communityId: string,
    membershipId: string,
    body: { text: string; toApplicant?: boolean },
  ) => post<unknown>(path(communityId, `/join-review/${membershipId}/notes`), body),

  // ───────────────────────────── Listing ─────────────────────────────

  listing: (communityId: string) => get<Listing>(path(communityId, '/listing')),
  updateListing: (communityId: string, body: Record<string, unknown>) =>
    patch<Listing>(path(communityId, '/listing'), body),
  submitListing: (communityId: string) => post<unknown>(path(communityId, '/listing/submit')),
  pauseListing: (communityId: string) => post<unknown>(path(communityId, '/listing/pause')),
  resumeListing: (communityId: string) => post<unknown>(path(communityId, '/listing/resume')),

  // ───────────────────────────── Accounting ─────────────────────────────

  accounts: (communityId: string) =>
    get<{ accounts: BookAccount[]; postingRules: PostingRule[] }>(
      path(communityId, '/accounting/accounts'),
    ),

  createAccount: (communityId: string, body: Record<string, unknown>) =>
    post<BookAccount>(path(communityId, '/accounting/accounts'), body),

  updateAccount: (communityId: string, accountId: string, body: Record<string, unknown>) =>
    patch<BookAccount>(path(communityId, `/accounting/accounts/${accountId}`), body),

  accountLedger: (communityId: string, accountId: string) =>
    get<AccountLedger>(path(communityId, `/accounting/accounts/${accountId}/ledger`)),

  journals: (communityId: string, params?: { status?: string; from?: string; to?: string }) =>
    get<JournalEntry[]>(path(communityId, '/accounting/journals'), params),

  createJournal: (
    communityId: string,
    body: {
      entryDate: string;
      description: string;
      lines: Array<{ accountCode: string; debit?: string; credit?: string; memo?: string }>;
      post?: boolean;
      reference?: string;
      sourceReference?: string;
    },
  ) => post<JournalEntry>(path(communityId, '/accounting/journals'), body),

  postJournal: (communityId: string, entryId: string) =>
    post<JournalEntry>(path(communityId, `/accounting/journals/${entryId}/post`)),

  reverseJournal: (communityId: string, entryId: string, reason: string) =>
    post<JournalEntry>(path(communityId, `/accounting/journals/${entryId}/reverse`), { reason }),

  statements: (communityId: string, params?: { from?: string; to?: string }) =>
    get<Statements>(path(communityId, '/accounting/statements'), params),

  cashAccounts: (communityId: string) =>
    get<CashAccount[]>(path(communityId, '/accounting/cash-accounts')),

  createCashAccount: (communityId: string, body: Record<string, unknown>) =>
    post<unknown>(path(communityId, '/accounting/cash-accounts'), body),

  reconcile: (
    communityId: string,
    cashAccountId: string,
    body: { statementBalance: string; statementDate: string; adjustmentAccountCode?: string },
  ) =>
    post<{
      bookBalance: string;
      statementBalance: string;
      difference: string;
      reconciled: boolean;
    }>(path(communityId, `/accounting/cash-accounts/${cashAccountId}/reconcile`), body),

  expenses: (communityId: string, status?: string) =>
    get<Expense[]>(path(communityId, '/accounting/expenses'), { status }),

  createExpense: (communityId: string, body: Record<string, unknown>) =>
    post<Expense>(path(communityId, '/accounting/expenses'), body),

  reviewExpense: (
    communityId: string,
    expenseId: string,
    body: { decision: 'APPROVE' | 'REJECT' | 'PAY'; reason?: string },
  ) => patch<Expense>(path(communityId, `/accounting/expenses/${expenseId}`), body),

  budget: (communityId: string, year: number) =>
    get<BudgetLine[]>(path(communityId, '/accounting/budget'), { year }),

  setBudget: (
    communityId: string,
    body: { year: number; lines: Array<{ accountCode: string; annual: string }> },
  ) => post<BudgetLine[]>(path(communityId, '/accounting/budget'), body),

  periods: (communityId: string) =>
    get<AccountingPeriod[]>(path(communityId, '/accounting/periods')),

  closePeriod: (communityId: string, periodKey: string) =>
    post<AccountingPeriod>(path(communityId, '/accounting/periods/close'), { periodKey }),

  reopenPeriod: (communityId: string, periodKey: string) =>
    post<AccountingPeriod>(path(communityId, `/accounting/periods/${periodKey}/reopen`)),

  // ───────────────────────────── Governance ─────────────────────────────

  meetings: (communityId: string) => get<Meeting[]>(path(communityId, '/governance/meetings')),

  createMeeting: (communityId: string, body: Record<string, unknown>) =>
    post<Meeting>(path(communityId, '/governance/meetings'), body),

  updateMeeting: (communityId: string, meetingId: string, body: Record<string, unknown>) =>
    patch<Meeting>(path(communityId, `/governance/meetings/${meetingId}`), body),

  recordAttendance: (
    communityId: string,
    meetingId: string,
    entries: Array<{ memberId: string; state: string }>,
  ) => post<Meeting>(path(communityId, `/governance/meetings/${meetingId}/attendance`), { entries }),

  polls: (communityId: string) => get<Poll[]>(path(communityId, '/governance/polls')),

  createPoll: (communityId: string, body: Record<string, unknown>) =>
    post<Poll>(path(communityId, '/governance/polls'), body),

  vote: (communityId: string, pollId: string, optionId: string) =>
    post<{ recorded: boolean }>(path(communityId, `/governance/polls/${pollId}/vote`), { optionId }),

  certifyPoll: (communityId: string, pollId: string) =>
    post<Poll>(path(communityId, `/governance/polls/${pollId}/certify`)),

  documents: (communityId: string) =>
    get<CommunityDocument[]>(path(communityId, '/governance/documents')),

  addDocument: (communityId: string, body: Record<string, unknown>) =>
    post<CommunityDocument>(path(communityId, '/governance/documents'), body),

  removeDocument: (communityId: string, documentId: string) =>
    del<unknown>(path(communityId, `/governance/documents/${documentId}`)),

  fines: (communityId: string, status?: string) =>
    get<Fine[]>(path(communityId, '/governance/fines'), { status }),

  issueFine: (communityId: string, body: { memberId: string; reason: string; amount: string }) =>
    post<Fine>(path(communityId, '/governance/fines'), body),

  waiveFine: (communityId: string, fineId: string, reason: string) =>
    post<Fine>(path(communityId, `/governance/fines/${fineId}/waive`), { reason }),

  payFine: (communityId: string, fineId: string) =>
    post<Fine>(path(communityId, `/governance/fines/${fineId}/pay`)),

  // ───────────────────────────── Savings ─────────────────────────────

  savingsProducts: (communityId: string) =>
    get<SavingsProduct[]>(path(communityId, '/savings/products')),

  createSavingsProduct: (communityId: string, body: Record<string, unknown>) =>
    post<SavingsProduct>(path(communityId, '/savings/products'), body),

  savingsAccounts: (communityId: string) =>
    get<SavingsOverview>(path(communityId, '/savings/accounts')),

  openSavingsAccount: (communityId: string, body: { memberId: string; productId: string }) =>
    post<unknown>(path(communityId, '/savings/accounts'), body),

  savingsStatement: (communityId: string, accountId: string) =>
    get<SavingsStatement>(path(communityId, `/savings/accounts/${accountId}`)),

  recordSavingsEntry: (
    communityId: string,
    accountId: string,
    body: {
      type: 'DEPOSIT' | 'WITHDRAWAL' | 'INTEREST' | 'ADJUSTMENT';
      amount: string;
      cashAccountCode?: string;
      reduceBalance?: boolean;
      note?: string;
    },
  ) => post<unknown>(path(communityId, `/savings/accounts/${accountId}/entries`), body),

  // ───────────────────────────── Lending ─────────────────────────────

  loanProducts: (communityId: string) =>
    get<LoanProduct[]>(path(communityId, '/loan-products')),

  createLoanProduct: (communityId: string, body: Record<string, unknown>) =>
    post<LoanProduct>(path(communityId, '/loan-products'), body),

  updateLoanProduct: (communityId: string, productId: string, body: Record<string, unknown>) =>
    patch<LoanProduct>(path(communityId, `/loan-products/${productId}`), body),

  quoteLoan: (
    communityId: string,
    productId: string,
    body: { principal: string; tenorMonths: number },
  ) => post<LoanQuote>(path(communityId, `/loan-products/${productId}/quote`), body),

  // Loan applications live on the Ajo group that funds them.
  groupLoans: (ajoGroupId: string, status?: string) =>
    get<Loan[]>(`/ajo-groups/${ajoGroupId}/loans`, { status }),

  reviewLoan: (loanId: string, approve: boolean, interestRate?: string, notes?: string) =>
    post<Loan>(`/ajo-loans/${loanId}/review`, { approve, interestRate, notes }),

  disburseLoan: (loanId: string) => post<Loan>(`/ajo-loans/${loanId}/disburse`),

  // ───────────────────────────── Ajo ─────────────────────────────

  ajoGroups: () => get<AjoGroupSummary[]>('/ajo-groups'),
  ajoGroup: (groupId: string) => get<AjoGroupDetail>(`/ajo-groups/${groupId}`),
  createAjoGroup: (body: Record<string, unknown>) => post<AjoGroupDetail>('/ajo-groups', body),
  /**
   * Mints invitations. With `identifiers` each person gets their own expiring
   * token; without, the group's reusable code is the invitation.
   */
  inviteMembers: (
    groupId: string,
    body: { identifiers?: string[]; expiresInDays?: number },
  ) =>
    post<
      Array<{
        identifier: string | null;
        token: string;
        expiresAt: string;
        shareUrl: string;
      }>
    >(`/ajo-groups/${groupId}/invitations`, body),

  createCycle: (groupId: string, body: Record<string, unknown>) =>
    post<unknown>(`/ajo-groups/${groupId}/cycles`, body),
  activateCycle: (cycleId: string) => post<unknown>(`/ajo-cycles/${cycleId}/activate`),
  lockCycle: (cycleId: string) => post<unknown>(`/ajo-cycles/${cycleId}/lock`),

  contributionBoard: (cycleId: string, round?: number) =>
    get<ContributionBoard>(`/ajo-cycles/${cycleId}/contribution-board`, { round }),

  sendReminders: (cycleId: string, round?: number) =>
    post<{ message: string }>(`/ajo-cycles/${cycleId}/reminders`, { round }),

  positions: (cycleId: string) => get<PayoutPosition[]>(`/ajo-cycles/${cycleId}/positions`),

  autoAssignPositions: (cycleId: string) =>
    post<unknown>(`/ajo-cycles/${cycleId}/positions/auto-assign`),

  runDraw: (cycleId: string, body?: Record<string, unknown>) =>
    post<unknown>(`/ajo-cycles/${cycleId}/draw`, body ?? {}),

  draws: (cycleId: string) => get<unknown[]>(`/ajo-cycles/${cycleId}/draws`),

  payouts: (cycleId: string) => get<unknown[]>(`/ajo-cycles/${cycleId}/payouts`),

  approvePayout: (payoutId: string) => post<unknown>(`/ajo-payouts/${payoutId}/approve`),

  groupEarnings: (groupId: string) => get<unknown>(`/ajo-groups/${groupId}/earnings`),

  feeSettings: (groupId: string) => get<unknown>(`/ajo-groups/${groupId}/fee-settings`),

  updateFeeSettings: (groupId: string, body: Record<string, unknown>) =>
    patch<unknown>(`/ajo-groups/${groupId}/fee-settings`, body),

  // ───────────────────────── Communications ─────────────────────────

  broadcasts: (communityId: string) => get<Broadcast[]>(path(communityId, '/broadcasts')),

  createBroadcast: (communityId: string, body: Record<string, unknown>) =>
    post<Broadcast>(path(communityId, '/broadcasts'), body),

  announcements: (communityId: string) =>
    get<Announcement[]>('/announcements', { communityId }),

  postAnnouncement: (body: {
    communityId?: string;
    ajoGroupId?: string;
    title?: string;
    body: string;
    pin?: boolean;
    notify?: boolean;
  }) => post<Announcement>('/announcements', body),

  // ───────────────────────────── Services ─────────────────────────────

  serviceCatalog: () => get<ServiceCatalogItem[]>('/community-services/catalog'),

  serviceRequests: (communityId: string, status?: string) =>
    get<ServiceRequest[]>(path(communityId, '/services'), { status }),

  // ───────────────────────────── Billing ─────────────────────────────

  plans: () => get<SubscriptionPlan[]>('/community-subscriptions/plans'),

  subscription: (subscriptionId: string) =>
    get<Subscription>(`/community-subscriptions/${subscriptionId}`),

  checkout: (communityId: string, planId: string) =>
    post<Subscription>('/community-subscriptions/checkout', { communityId, planId }),

  cancelSubscription: (subscriptionId: string, reason: string) =>
    post<Subscription>(`/community-subscriptions/${subscriptionId}/cancel`, { reason }),

  // ───────────────────────── Notifications & settings ─────────────────────────

  notifications: () => get<NotificationItem[]>('/notifications'),
  markNotificationRead: (id: string) => patch<unknown>(`/notifications/${id}/read`),
  markAllNotificationsRead: () => patch<unknown>('/notifications/read-all'),

  updateCommunity: (communityId: string, body: Record<string, unknown>) =>
    patch<unknown>(path(communityId), body),
};
