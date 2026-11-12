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
import { del, get, getBlob, patch, post, postBlob } from '@/lib/api';
import type { MoneyOutExtra } from '@/components/money-out-otp';
import type {
  AccountLedger,
  AccountingPeriod,
  ActivityFeed,
  AjoGroupDetail,
  AjoGroupSummary,
  AjoPayoutRow,
  Announcement,
  AuditEntry,
  BookAccount,
  Broadcast,
  BudgetLine,
  CashAccount,
  CoaChoice,
  CoaOptions,
  CoaSelectionKey,
  CommunityDocument,
  CommunityPolicy,
  ContributionBoard,
  DashboardData,
  WalletData,
  Expense,
  Fine,
  JoinRequest,
  JoinReviewStage,
  JournalEntry,
  Listing,
  LoanApplicationDetail,
  Opportunity,
  CommunityGroupRow,
  AjoJoinRequestRow,
  WelfareRequestDetail,
  WelfareRequestRow,
  Loan,
  LoanProduct,
  LoanQuote,
  Meeting,
  MemberDetail,
  MemberRow,
  MemberSuspension,
  SuspensionScope,
  SuspensionScopeOption,
  NotificationItem,
  PayoutPosition,
  Poll,
  PollDetail,
  PostingRule,
  SavingsOverview,
  SavingsProduct,
  SavingsStatement,
  SavingsWithdrawalRequestRow,
  ServiceCatalogItem,
  ServiceRequest,
  Statements,
  StaffInvitation,
  Subscription,
  SubscriptionPlan,
  MerchantApiKey,
  MerchantApiKeyCreated,
  MerchantInvoice,
  MerchantInvoiceDetail,
  MerchantOverview,
  MerchantPaymentLink,
  MerchantSettlementAccount,
  MerchantWebhook,
  MerchantWebhookCreated,
  CommunityConfiguration,
  CommunityLevy,
  DuesLeviesOverview,
  DuesLeviesCollections,
  InviteResult,
  ExistingMemberInvite,
  BatchPreview,
  MigrationRowKind,
  MigrationStatus,
  LoanGuarantorRow,
  LoanRepaymentRow,
  PendingInvitation,
  LevyFrequency,
  RendiAiConversationSummary,
  RendiAiConversationDetail,
  VerificationProfileInput,
  CommunityRole,
  RoleInput,
  RolePermissionVocabulary,
} from '@/types';

const path = (communityId: string, suffix = '') => `/communities/${communityId}${suffix}`;

// ───────────────────────────── Overview ─────────────────────────────

export const portalApi = {
  dashboard: (communityId: string) => get<DashboardData>(path(communityId, '/dashboard')),
  navigationBadges: (communityId: string) =>
    get<NonNullable<DashboardData['navigationCounts']>>(path(communityId, '/navigation/badges')),
  markNavigationRead: (communityId: string, section: string) =>
    post<{ read: true }>(path(communityId, `/navigation/${section}/read`)),
  wallet: (communityId: string) => get<WalletData>(path(communityId, '/wallet')),
  assignWalletTransactionAccount: (
    communityId: string,
    transactionId: string,
    choice: CoaChoice,
  ) => patch<{ transactionId: string; account: BookAccount }>(
    path(communityId, `/wallet/transactions/${transactionId}/account`),
    { choice },
  ),

  /**
   * The verification profile, from the modal the portal will not let the
   * owner dismiss. Submitting it is what puts the community in Rendi's review
   * queue, so there is no separate "send for review" action.
   */
  submitVerificationProfile: (communityId: string, body: VerificationProfileInput) =>
    post<{ id: string; profileSubmittedAt: string }>(
      path(communityId, '/verification-profile'),
      body,
    ),

  /** Whether Rendi AI has a model configured in this environment. */
  rendiAiAvailability: (communityId: string) =>
    get<{ enabled: boolean }>(path(communityId, '/rendi-ai/availability')),
  rendiAiConversations: (communityId: string) =>
    get<RendiAiConversationSummary[]>(path(communityId, '/rendi-ai/conversations')),
  rendiAiConversation: (communityId: string, conversationId: string) =>
    get<RendiAiConversationDetail>(
      path(communityId, `/rendi-ai/conversations/${conversationId}`),
    ),
  deleteRendiAiConversation: (communityId: string, conversationId: string) =>
    del<{ deleted: true }>(path(communityId, `/rendi-ai/conversations/${conversationId}`)),

  auditLogs: (communityId: string, page = 1, limit = 50) =>
    get<AuditEntry[]>(path(communityId, '/audit-logs'), { page, limit }),

  /**
   * The full activity trail behind the dashboard's "Recent activity" card.
   * Unlike `auditLogs` it carries actor names, a category and a total, which
   * is what a page (rather than a glance) needs.
   */
  activity: (
    communityId: string,
    params: {
      page?: number;
      limit?: number;
      category?: string;
      search?: string;
      from?: string;
      to?: string;
    } = {},
  ) => get<ActivityFeed>(path(communityId, '/activity'), params),

  // ───────────────────────────── Members ─────────────────────────────

  members: (communityId: string, search?: string, includeOwner = false) =>
    get<MemberRow[]>(path(communityId, '/members'), { search, includeOwner }),

  member: (communityId: string, memberId: string) =>
    get<MemberDetail>(path(communityId, `/members/${memberId}`)),

  /**
   * Suspension, as officers do it: pick the services, give the reason.
   *
   * The scope list comes from the API rather than being hard-coded here, so
   * the officer's checkbox wording and the sentence the member is emailed are
   * the same string.
   */
  suspensionScopes: (communityId: string) =>
    get<SuspensionScopeOption[]>(path(communityId, '/member-suspension-scopes')),

  suspendMember: (
    communityId: string,
    memberId: string,
    body: { scopes: SuspensionScope[]; reason: string },
  ) => post<MemberSuspension>(path(communityId, `/members/${memberId}/suspension`), body),

  /** Omit `scopes` to restore everything. */
  liftMemberSuspension: (
    communityId: string,
    memberId: string,
    body: { scopes?: SuspensionScope[]; note?: string } = {},
  ) =>
    del<MemberSuspension | null>(path(communityId, `/members/${memberId}/suspension`), body),

  addStaff: (
    communityId: string,
    body: { userId?: string; email?: string; roleName: string; title?: string },
  ) => post<{ kind: 'MEMBER' | 'INVITATION' }>(path(communityId, '/staff'), body),

  // ───────────────────────── Roles & posts ─────────────────────────

  roles: (communityId: string) => get<CommunityRole[]>(path(communityId, '/roles')),
  roleVocabulary: (communityId: string) =>
    get<RolePermissionVocabulary>(path(communityId, '/roles/vocabulary')),
  createRole: (communityId: string, body: RoleInput) =>
    post<CommunityRole>(path(communityId, '/roles'), body),
  updateRole: (communityId: string, roleId: string, body: Partial<RoleInput>) =>
    patch<CommunityRole>(path(communityId, `/roles/${roleId}`), body),
  deleteRole: (communityId: string, roleId: string) =>
    del<{ deleted: true }>(path(communityId, `/roles/${roleId}`)),
  /** Hand an elected post over, or add someone to a standing role. */
  assignRole: (communityId: string, roleId: string, body: { memberId: string; title?: string }) =>
    post<{ memberId: string; replaced: string | null }>(
      path(communityId, `/roles/${roleId}/assign`),
      body,
    ),
  standDown: (communityId: string, memberId: string) =>
    post<{ memberId: string }>(path(communityId, `/members/${memberId}/stand-down`)),

  staffInvitations: (communityId: string) =>
    get<StaffInvitation[]>(path(communityId, '/staff/invitations')),

  revokeStaffInvitation: (communityId: string, invitationId: string) =>
    del<unknown>(path(communityId, `/staff/invitations/${invitationId}`)),

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

  loanDetail: (loanId: string) => get<LoanApplicationDetail>(`/ajo-loans/${loanId}`),
  communityAjoGroups: (communityId: string) =>
    get<CommunityGroupRow[]>(path(communityId, '/ajo-groups')),
  ajoJoinRequests: (groupId: string) =>
    get<{ spotsFilled: number; memberLimit: number; requests: AjoJoinRequestRow[] }>(
      `/ajo-groups/${groupId}/join-requests`,
    ),
  reviewAjoJoinRequest: (groupId: string, membershipId: string, approve: boolean) =>
    post<unknown>(`/ajo-groups/${groupId}/join-requests/${membershipId}`, { approve }),

  /** One member's signed agreement, as the PDF both parties hold. */
  ajoAgreementPdf: (groupId: string, membershipId: string) =>
    getBlob(
      `/ajo-groups/${groupId}/agreements/${membershipId}/pdf`,
      'membership-agreement.pdf',
    ),

  opportunities: (communityId: string) =>
    get<Opportunity[]>(path(communityId, '/opportunities'), { all: '1' }),
  upsertOpportunity: (communityId: string, body: Record<string, unknown>) =>
    post<Opportunity>(path(communityId, '/opportunities'), body),

  welfareQueue: (communityId: string, status?: string) =>
    get<WelfareRequestRow[]>(path(communityId, '/welfare'), status ? { status } : undefined),
  welfareRequest: (requestId: string) =>
    get<WelfareRequestDetail>(`/welfare-requests/${requestId}`),
  reviewWelfare: (
    requestId: string,
    // `ledgerAccount` is honoured on APPROVED only: which expense line the
    // grant is charged to belongs to the approval decision, not to whoever
    // marks it paid afterwards.
    body: { status: string; note?: string; ledgerAccount?: CoaChoice },
    // Only the PAID step moves money; the API asks for a code just for that.
    extra: MoneyOutExtra = {},
  ) => patch<unknown>(`/welfare-requests/${requestId}`, { ...body, ...extra }),
  replyWelfare: (requestId: string, body: { text?: string; attachmentUrl?: string }) =>
    post<unknown>(`/welfare-requests/${requestId}/messages`, body),

  listing: (communityId: string) => get<Listing>(path(communityId, '/listing')),
  uploadSignature: (folder: string) =>
    post<{
      cloudName: string;
      apiKey: string;
      timestamp: number;
      signature: string;
      folder: string;
      publicId: string;
      uploadUrl: string;
    }>('/media/upload-signature', { folder }),
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

  /**
   * What an officer may choose from when creating something that posts.
   *
   * Fetched per flow rather than filtering the whole chart in the browser:
   * the rule that a savings control account must be a liability is enforced
   * on the server, and a second copy here would be advice, not a guarantee.
   */
  coaOptions: (communityId: string, selection: CoaSelectionKey) =>
    get<CoaOptions>(path(communityId, '/accounting/coa-options'), { selection }),

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

  reverseJournal: (communityId: string, entryId: string, reason: string, otp?: string) =>
    post<JournalEntry>(path(communityId, `/accounting/journals/${entryId}/reverse`), { reason, otp }),

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

  poll: (communityId: string, pollId: string) =>
    get<PollDetail>(path(communityId, `/governance/polls/${pollId}`)),

  /** The browser downloads it directly; the proxy forwards the bytes. */
  pollResultPdfUrl: (communityId: string, pollId: string) =>
    `/api/proxy${path(communityId, `/governance/polls/${pollId}/result.pdf`)}`,

  createPoll: (communityId: string, body: Record<string, unknown>) =>
    post<Poll>(path(communityId, '/governance/polls'), body),

  vote: (communityId: string, pollId: string, optionId: string) =>
    post<{ recorded: boolean }>(path(communityId, `/governance/polls/${pollId}/vote`), { optionId }),

  certifyPoll: (communityId: string, pollId: string) =>
    post<Poll>(path(communityId, `/governance/polls/${pollId}/certify`)),

  broadcastPollResult: (communityId: string, pollId: string) =>
    post<{ queued: boolean }>(path(communityId, `/governance/polls/${pollId}/broadcast-result`)),

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

  savingsWithdrawalRequests: (communityId: string) =>
    get<SavingsWithdrawalRequestRow[]>(`/communities/${communityId}/portal/savings/withdrawal-requests`),
  decideSavingsWithdrawal: (
    communityId: string,
    requestId: string,
    approve: boolean,
    note?: string,
    // Approving releases community money, so the request carries the owner's
    // approval code. Omitted on the first call — the API answers 428 with a
    // challenge, and useMoneyOutOtp re-sends this with the code.
    extra: MoneyOutExtra = {},
  ) =>
    patch<{ id: string; status: string }>(
      `/communities/${communityId}/portal/savings/withdrawal-requests/${requestId}`,
      { approve, note, ...extra },
    ),

  savingsProducts: (communityId: string) =>
    get<SavingsProduct[]>(path(communityId, '/portal/savings/products')),

  createSavingsProduct: (
    communityId: string,
    body: Record<string, unknown>,
    extra: MoneyOutExtra = {},
  ) => post<SavingsProduct>(path(communityId, '/portal/savings/products'), { ...body, ...extra }),

  savingsAccounts: (communityId: string) =>
    get<SavingsOverview>(path(communityId, '/portal/savings/accounts')),

  openSavingsAccount: (communityId: string, body: { memberId: string; productId: string }) =>
    post<unknown>(path(communityId, '/portal/savings/accounts'), body),

  savingsStatement: (communityId: string, accountId: string) =>
    get<SavingsStatement>(path(communityId, `/portal/savings/accounts/${accountId}`)),

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
  ) => post<unknown>(path(communityId, `/portal/savings/accounts/${accountId}/entries`), body),

  // ───────────────────────────── Lending ─────────────────────────────

  loanProducts: (communityId: string) =>
    get<LoanProduct[]>(path(communityId, '/loan-products')),

  communityLoans: (communityId: string, status?: string) =>
    get<Loan[]>(path(communityId, '/loans'), { status }),

  /** Every repayment recorded against the community's own loans. */
  loanRepayments: (communityId: string) =>
    get<LoanRepaymentRow[]>(path(communityId, '/loans/repayments')),

  /** Guarantors flattened across the community's loans, one row each. */
  loanGuarantors: (communityId: string) =>
    get<LoanGuarantorRow[]>(path(communityId, '/loans/guarantors')),

  createLoanProduct: (
    communityId: string,
    body: Record<string, unknown>,
    extra: MoneyOutExtra = {},
  ) => post<LoanProduct>(path(communityId, '/loan-products'), { ...body, ...extra }),

  updateLoanProduct: (
    communityId: string,
    productId: string,
    body: Record<string, unknown>,
    extra: MoneyOutExtra = {},
  ) => patch<LoanProduct>(path(communityId, `/loan-products/${productId}`), { ...body, ...extra }),

  quoteLoan: (
    communityId: string,
    productId: string,
    body: { principal: string; tenorMonths: number },
  ) => post<LoanQuote>(path(communityId, `/loan-products/${productId}/quote`), body),

  downloadLoanQuote: (
    communityId: string,
    productId: string,
    body: { principal: string; tenorMonths: number },
  ) => postBlob(path(communityId, `/loan-products/${productId}/quote/pdf`), body),

  emailLoanQuote: (
    communityId: string,
    productId: string,
    body: { principal: string; tenorMonths: number; recipientType: 'MEMBER' | 'ALL'; memberId?: string },
  ) => post<{ recipientCount: number; sent: number }>(path(communityId, `/loan-products/${productId}/quote/email`), body),

  // Legacy group-funded loan applications live on the Ajo group.
  groupLoans: (ajoGroupId: string, status?: string) =>
    get<Loan[]>(`/ajo-groups/${ajoGroupId}/loans`, { status }),

  reviewLoan: (loanId: string, approve: boolean, interestRate?: string, notes?: string) =>
    post<Loan>(`/ajo-loans/${loanId}/review`, { approve, interestRate, notes }),

  /** Records an (external) guarantor's answer on their behalf — officer only. */
  reviewGuarantor: (loanId: string, guarantorId: string, confirm: boolean) =>
    post<{ id: string; status: string }>(`/ajo-loans/${loanId}/guarantors/${guarantorId}/review`, {
      confirm,
    }),

  disburseLoan: (loanId: string, extra: MoneyOutExtra = {}) =>
    post<Loan>(`/ajo-loans/${loanId}/disburse`, extra, {
      headers: {
        // The first call intentionally has no OTP and may create a 428
        // approval challenge. The confirmation is a different HTTP request
        // body, so it must use a different idempotency key; otherwise the
        // API correctly rejects the key/body mismatch before checking the
        // OTP. The service row-lock still makes the actual money movement
        // exactly-once when two distinct attempts race.
        'Idempotency-Key': `ajo-loan-disbursement-${loanId}-${crypto.randomUUID()}`,
      },
    }),

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

  payouts: (cycleId: string) => get<AjoPayoutRow[]>(`/ajo-cycles/${cycleId}/payouts`),

  /**
   * Both payout endpoints require an Idempotency-Key. A fresh key per click is
   * right here: the server's own row logic makes a duplicate request return
   * the existing payout, and approvals lock the row.
   */
  requestPayout: (positionId: string) =>
    post<AjoPayoutRow>(`/ajo-payouts/positions/${positionId}/request`, undefined, {
      headers: { 'Idempotency-Key': `ajo-payout-request-${crypto.randomUUID()}` },
    }),

  groupEarnings: (groupId: string) => get<unknown>(`/ajo-groups/${groupId}/earnings`),

  feeSettings: (groupId: string) => get<unknown>(`/ajo-groups/${groupId}/fee-settings`),

  updateFeeSettings: (
    groupId: string,
    body: Record<string, unknown>,
    extra: MoneyOutExtra = {},
  ) => patch<unknown>(`/ajo-groups/${groupId}/fee-settings`, { ...body, ...extra }),

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

  /**
   * `idempotencyKey` is required by the API and must be stable across retries
   * of one confirmation but fresh for each new checkout intent — the server
   * replays the original response for a reused key for 24 hours.
   */
  checkout: (communityId: string, planId: string, idempotencyKey: string) =>
    post<Subscription>(
      '/community-subscriptions/checkout',
      { communityId, planId },
      { headers: { 'Idempotency-Key': idempotencyKey } },
    ),

  cancelSubscription: (subscriptionId: string, reason: string) =>
    post<Subscription>(`/community-subscriptions/${subscriptionId}/cancel`, { reason }),

  // ───────────────────────── Notifications & settings ─────────────────────────

  notifications: () => get<NotificationItem[]>('/notifications'),
  markNotificationRead: (id: string) => patch<unknown>(`/notifications/${id}/read`),
  markAllNotificationsRead: () => patch<unknown>('/notifications/read-all'),

  // ───────────────────────────── Merchant ─────────────────────────────

  merchantOverview: (communityId: string) =>
    get<MerchantOverview>(path(communityId, '/merchant/overview')),

  settlementAccounts: (communityId: string) =>
    get<MerchantSettlementAccount[]>(path(communityId, '/merchant/settlement-accounts')),

  addSettlementAccount: (
    communityId: string,
    body: {
      bankName: string;
      bankCode: string;
      accountNumber: string;
      accountName: string;
      isDefault?: boolean;
    },
  ) =>
    post<MerchantSettlementAccount>(path(communityId, '/merchant/settlement-accounts'), body),

  makeSettlementAccountDefault: (communityId: string, accountId: string) =>
    patch<MerchantSettlementAccount>(
      path(communityId, `/merchant/settlement-accounts/${accountId}/default`),
    ),

  removeSettlementAccount: (communityId: string, accountId: string) =>
    del<unknown>(path(communityId, `/merchant/settlement-accounts/${accountId}`)),

  merchantPaymentLinks: (communityId: string) =>
    get<MerchantPaymentLink[]>(path(communityId, '/merchant/payment-links')),

  createMerchantPaymentLink: (
    communityId: string,
    body: {
      title: string;
      description?: string;
      amount?: string;
      currencyCode: string;
      isFixedAmount?: boolean;
      maxUses?: number;
      coaChoice?: CoaChoice;
    },
  ) => post<MerchantPaymentLink>(path(communityId, '/merchant/payment-links'), body),

  updateMerchantPaymentLink: (
    communityId: string,
    linkId: string,
    body: { title?: string; description?: string; isActive?: boolean; amount?: string },
  ) => patch<unknown>(path(communityId, `/merchant/payment-links/${linkId}`), body),

  deleteMerchantPaymentLink: (communityId: string, linkId: string) =>
    del<unknown>(path(communityId, `/merchant/payment-links/${linkId}`)),

  merchantInvoices: (communityId: string) =>
    get<MerchantInvoice[]>(path(communityId, '/merchant/invoices')),

  createMerchantInvoice: (
    communityId: string,
    body: {
      customerName: string;
      customerEmail: string;
      currencyCode: string;
      issueDate?: string;
      dueDate: string;
      items: Array<{ description: string; quantity: number; unitPrice: string }>;
      coaChoice?: CoaChoice;
    },
  ) => post<MerchantInvoice>(path(communityId, '/merchant/invoices'), body),

  updateMerchantInvoice: (
    communityId: string,
    invoiceId: string,
    body: {
      customerName: string;
      customerEmail: string;
      currencyCode: string;
      issueDate?: string;
      dueDate: string;
      items: Array<{ description: string; quantity: number; unitPrice: string }>;
      coaChoice?: CoaChoice;
    },
  ) => patch<MerchantInvoice>(path(communityId, `/merchant/invoices/${invoiceId}`), body),

  merchantInvoice: (communityId: string, invoiceId: string) =>
    get<MerchantInvoiceDetail>(path(communityId, `/merchant/invoices/${invoiceId}`)),

  issueMerchantInvoice: (communityId: string, invoiceId: string) =>
    post<{ invoiceId: string; status: string; paymentUrl: string }>(
      path(communityId, `/merchant/invoices/${invoiceId}/issue`),
      {},
    ),

  merchantApiKeys: (communityId: string) =>
    get<MerchantApiKey[]>(path(communityId, '/merchant/api-keys')),

  createMerchantApiKey: (communityId: string, body: { name: string; permissions?: string[] }) =>
    post<MerchantApiKeyCreated>(path(communityId, '/merchant/api-keys'), body),

  revokeMerchantApiKey: (communityId: string, keyId: string) =>
    del<unknown>(path(communityId, `/merchant/api-keys/${keyId}`)),

  merchantWebhooks: (communityId: string) =>
    get<MerchantWebhook[]>(path(communityId, '/merchant/webhooks')),

  createMerchantWebhook: (communityId: string, body: { url: string; events: string[] }) =>
    post<MerchantWebhookCreated>(path(communityId, '/merchant/webhooks'), body),

  removeMerchantWebhook: (communityId: string, endpointId: string) =>
    del<unknown>(path(communityId, `/merchant/webhooks/${endpointId}`)),

  updateCommunity: (communityId: string, body: Record<string, unknown>) =>
    patch<unknown>(path(communityId), body),

  policies: (communityId: string) => get<CommunityPolicy[]>(path(communityId, '/service-policies')),

  updatePolicy: (
    communityId: string,
    body: Pick<CommunityPolicy, 'area' | 'content' | 'rules' | 'isPublished'>,
    extra: MoneyOutExtra = {},
  ) => patch<CommunityPolicy>(path(communityId, '/service-policies'), { ...body, ...extra }),

  updateSavingsProduct: (
    communityId: string,
    productId: string,
    body: Record<string, unknown>,
    extra: MoneyOutExtra = {},
  ) =>
    patch<SavingsProduct>(path(communityId, `/portal/savings/products/${productId}`), {
      ...body,
      ...extra,
    }),

  // ───────────────── Migrating in from a previous system ─────────────────

  migrationStatus: (communityId: string) =>
    get<MigrationStatus>(path(communityId, '/migration')),

  /**
   * A dry run. Returns what would happen and writes nothing, so an officer
   * sees the totals and every rejected row before committing.
   */
  previewMigration: (
    communityId: string,
    kind: 'members' | 'savings' | 'loans' | 'plans',
    csv: string,
    fileName?: string,
  ) => post<BatchPreview>(path(communityId, `/migration/${kind}/preview`), { csv, fileName }),

  /**
   * Re-check a waiting import. Omit corrections to simply re-run validation
   * against current state, which is what fixes rows rejected only because a
   * product did not exist yet.
   */
  revalidateMigrationBatch: (
    communityId: string,
    batchId: string,
    corrections: Array<{ line: number; cells: Record<string, string> }> = [],
  ) =>
    post<BatchPreview>(path(communityId, `/migration/batches/${batchId}/revalidate`), {
      corrections,
    }),

  commitMigrationBatch: (
    communityId: string,
    batchId: string,
    extra: MoneyOutExtra = {},
  ) =>
    post<{ committed: number; kind: MigrationRowKind }>(
      path(communityId, `/migration/batches/${batchId}/commit`),
      extra,
    ),

  discardMigrationBatch: (communityId: string, batchId: string) =>
    del<{ discarded: true }>(path(communityId, `/migration/batches/${batchId}`)),

  recordMigrationFunding: (
    communityId: string,
    body: { amount: string; bankReference?: string; note?: string },
  ) =>
    post<{ id: string; amount: string; outstanding: string }>(
      path(communityId, '/migration/funding'),
      body,
    ),

  recordMemberOpening: (
    communityId: string,
    memberId: string,
    body: {
      kind: 'SAVINGS' | 'LOAN';
      productId: string;
      amount: string;
      outstanding?: string;
      openedOn?: string;
      dueOn?: string;
      legacyReference?: string;
      note?: string;
    },
    extra: MoneyOutExtra = {},
  ) =>
    post<{ kind: 'SAVINGS' | 'LOAN'; id: string; reference: string }>(
      path(communityId, `/members/${memberId}/opening-records`),
      { ...body, ...extra },
    ),

  // ───────────────────── Member invitations ─────────────────────

  /**
   * One payload for a single invite, a pasted list and a CSV alike — the API
   * de-duplicates and reports per address, so the client never has to fan out.
   */
  inviteCommunityMembers: (communityId: string, emails: string[]) =>
    post<InviteResult>(path(communityId, '/members/invite'), { identifiers: emails }),

  inviteExistingCommunityMembers: (
    communityId: string,
    existingMembers: ExistingMemberInvite[],
  ) => post<InviteResult>(path(communityId, '/members/invite'), { existingMembers }),

  /** Invitations an officer has sent that nobody has answered yet. */
  pendingInvitations: (communityId: string) =>
    get<PendingInvitation[]>(path(communityId, '/members/invitations')),

  revokeInvitation: (communityId: string, invitationId: string) =>
    del<{ revoked: true }>(path(communityId, `/members/invitations/${invitationId}`)),

  // ───────────────────── Dues & levies ─────────────────────

  duesLevies: (communityId: string) =>
    get<DuesLeviesOverview>(path(communityId, '/dues-levies')),

  duesLeviesCollections: (communityId: string) =>
    get<DuesLeviesCollections>(path(communityId, '/dues-levies/collections')),

  setMonthlyDues: (communityId: string, amount: string | null, extra: MoneyOutExtra = {}) =>
    patch<{ monthlyDues: string | null }>(path(communityId, '/dues-levies/monthly-dues'), {
      amount,
      ...extra,
    }),

  setMemberCodePrefix: (communityId: string, prefix: string, extra: MoneyOutExtra = {}) =>
    patch<{ memberCodePrefix: string }>(path(communityId, '/dues-levies/member-code-prefix'), {
      prefix,
      ...extra,
    }),

  createLevy: (
    communityId: string,
    body: {
      name: string;
      description?: string;
      amount: string;
      frequency: LevyFrequency;
      startsOn: string;
      endsOn?: string;
    },
    extra: MoneyOutExtra = {},
  ) => post<CommunityLevy>(path(communityId, '/dues-levies/levies'), { ...body, ...extra }),

  updateLevy: (
    communityId: string,
    levyId: string,
    body: Record<string, unknown>,
    extra: MoneyOutExtra = {},
  ) =>
    patch<CommunityLevy>(path(communityId, `/dues-levies/levies/${levyId}`), {
      ...body,
      ...extra,
    }),

  /** Everything the configuration page edits, in one read. */
  configuration: (communityId: string) =>
    get<CommunityConfiguration>(path(communityId, '/configuration')),
};
