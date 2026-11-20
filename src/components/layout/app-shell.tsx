'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { Route } from 'next';
import {
  Activity,
  BarChart3,
  BookOpen,
  Building2,
  CalendarDays,
  Check,
  ChevronsLeft,
  ChevronsRight,
  CreditCard,
  FileText,
  Globe,
  Link2,
  HandCoins,
  HeartHandshake,
  LayoutDashboard,
  LogOut,
  Menu,
  MessagesSquare,
  PiggyBank,
  RefreshCw,
  ChevronDown,
  Coins,
  Landmark,
  FileSpreadsheet,
  ListTree,
  NotebookPen,
  ReceiptText,
  Rows3,
  Scale,
  Send,
  Settings,
  TrendingUp,
  SlidersHorizontal,
  ShieldAlert,
  Sparkles,
  Store,
  UserCog,
  UserPlus,
  Users,
  Wallet as WalletIcon,
  X,
  UserRoundCheck,
  Package,
  Inbox,
  CheckCircle2,
  Banknote,
  Undo2,
  ShieldCheck,
  Import,
  Headset,
  KeyRound,
  Network,
  Webhook,
  LifeBuoy,
} from 'lucide-react';
import { cn } from '@/lib/format';
import { Avatar, Button, MenuItem, Popover } from '@/components/ui';
import { useSession } from '@/components/providers/session-provider';
import { useQuery } from '@/hooks/use-query';
import { portalApi } from '@/services/portal';
import type { BranchAccess, CommunitySummary, DashboardData, EntitlementsSummary } from '@/types';
import { Logo, LogoMark } from './Logo';
import { NotificationsMenu } from './notifications-menu';
import { RendiAiPanel } from '@/components/rendi-ai/rendi-ai-panel';
import { RendiAiTrigger } from '@/components/rendi-ai/rendi-ai-trigger';
import { SupportMenu } from '@/components/layout/support-menu';
import { VerificationProfileModal } from '@/components/onboarding/verification-profile-modal';

type NavigationCounts = NonNullable<DashboardData['navigationCounts']>;
type NavCountKey = keyof NavigationCounts;
type NavItem = {
  /**
   * Sub-pages shown under a collapsible parent. The parent is a real page in
   * its own right — a hub listing the same sections — so it stays a link
   * rather than becoming a bare toggle an officer cannot navigate to.
   */
  children?: Array<Omit<NavItem, 'children'>>;
  href: Route;
  label: string;
  icon: typeof Users;
  exact?: boolean;
  /** Omitted for items nothing can be waiting on — Support is a door, not a queue. */
  countKey?: NavCountKey;
};

const NAV: Array<{ group: string; items: NavItem[] }> = [
  {
    group: 'Overview',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, countKey: 'dashboard' },
      // Reachable from the dashboard's "View all", but it is also the page an
      // officer goes looking for by name when something changed and nobody
      // remembers who changed it.
      { href: '/activity' as Route, label: 'Activity', icon: Activity, countKey: 'dashboard' },
    ],
  },
  {
    group: 'Community',
    items: [
      {
        href: '/members',
        label: 'Members',
        icon: Users,
        exact: true,
        countKey: 'members',
        children: [
          { href: '/members/add', label: 'Add new member', icon: UserPlus, countKey: 'members' },
          { href: '/members/requests', label: 'Pending members', icon: UserRoundCheck, countKey: 'joinRequests' },
        ],
      },
      {
        href: '/contributions',
        label: 'Contributions & Ajo',
        icon: RefreshCw,
        exact: true,
        countKey: 'contributions',
        children: [
          // Its own page because the pools are their own money: each group
          // banks separately, so none of this is in the merchant history.
          { href: '/contributions/transactions', label: 'Transactions', icon: ReceiptText, countKey: 'contributions' },
        ],
      },
      { href: '/savings', label: 'Savings', icon: PiggyBank, countKey: 'savings' },
      {
        href: '/loans',
        label: 'Loans',
        icon: HandCoins,
        exact: true,
        countKey: 'loans',
        children: [
          { href: '/loans/offers', label: 'Loan offers', icon: Package, countKey: 'loans' },
          { href: '/loans/requested', label: 'Requested', icon: Inbox, countKey: 'loans' },
          { href: '/loans/approved', label: 'Approved', icon: CheckCircle2, countKey: 'loans' },
          { href: '/loans/disbursed', label: 'Disbursed', icon: Banknote, countKey: 'loans' },
          { href: '/loans/repayments', label: 'Repayments', icon: Undo2, countKey: 'loans' },
          { href: '/loans/guarantors', label: 'Guarantors', icon: ShieldCheck, countKey: 'loans' },
        ],
      },
      // Plan-gated on the `branches` feature (see planGates in the Sidebar):
      // chapters that group the member roster.
      { href: '/branches' as Route, label: 'Branches', icon: Network, countKey: 'members' },
      // { href: '/services', label: 'Services', icon: Sparkles },
      { href: '/welfare', label: 'Welfare', icon: HeartHandshake, countKey: 'welfare' },
      { href: '/opportunities', label: 'Opportunities', icon: Sparkles, countKey: 'opportunities' },
    ],
  },
  {
    group: 'Finance',
    items: [
      // Wallet lived here as its own entry. It was the same account as the
      // merchant one, described from a different angle, and two pages for one
      // balance is what made Accounting and Wallet read as if they disagreed.
      // It now opens inside Merchant, below.
      {
        href: '/accounting',
        label: 'Accounting',
        icon: BookOpen,
        exact: true,
        countKey: 'accounting',
        children: [
          { href: '/accounting/chart-of-accounts', label: 'Chart of accounts', icon: ListTree, countKey: 'accounting' },
          { href: '/accounting/ledger', label: 'Ledger entries', icon: Rows3, countKey: 'accounting' },
          { href: '/accounting/journals', label: 'Journals', icon: NotebookPen, countKey: 'accounting' },
          { href: '/accounting/books', label: 'Books', icon: BookOpen, countKey: 'accounting' },
          { href: '/trial-balance', label: 'Trial balance', icon: Scale, countKey: 'trialBalance' },
          { href: '/accounting/revenue', label: 'Revenue', icon: TrendingUp, countKey: 'accounting' },
          { href: '/accounting/statements', label: 'Statements', icon: FileSpreadsheet, countKey: 'accounting' },
        ],
      },
      { href: '/expenses', label: 'Expenses', icon: ReceiptText, countKey: 'accounting' },
      // Its own section, not a corner of Accounting. Accounting is where an
      // officer reads the books; this is where they decide what members are
      // charged — a different job, done by different people, and one they
      // should not have to go through the ledger to reach.
      { href: '/dues-levies', label: 'Dues & levies', icon: Coins, countKey: 'accounting' },
      { href: '/reports', label: 'Reports', icon: BarChart3, countKey: 'reports' },
    ],
  },
  {
    // A community is a merchant account: it collects in its own name, holds
    // its own settlement accounts, and is registered as a merchant entity at
    // the payment provider. Its own group rather than a corner of Finance —
    // Finance is the community's internal books, this is its outward face.
    //
    // The wallet is this account, so it is this group: the balance, the
    // collection account, the flow charts and the history are one screen and
    // its pages, not a separate section that happens to show the same money.
    group: 'Merchant',
    items: [
      { href: '/merchant', label: 'Merchant account', icon: Store, exact: true, countKey: 'merchant' },
      { href: '/merchant/transactions', label: 'Transactions', icon: WalletIcon, countKey: 'wallet' },
      { href: '/merchant/payouts', label: 'Payouts & payees', icon: Send, countKey: 'merchant' },
      { href: '/merchant/settlement', label: 'Settlement', icon: Landmark, countKey: 'merchant' },
      { href: '/merchant/payment-links', label: 'Payment links', icon: Link2, countKey: 'merchantPaymentLinks' },
      { href: '/merchant/invoices', label: 'Invoices', icon: FileText, countKey: 'merchantInvoices' },
      // Plan-gated (see planGates in the Sidebar): API keys behind the
      // `api_access` feature, webhooks behind `integrations`. The honest
      // caveat still applies platform-wide — no request authenticates with a
      // key yet and nothing dispatches to a webhook — but issuing and
      // managing the credentials is now a real plan capability, and both
      // pages say so themselves.
      { href: '/merchant/api-keys', label: 'API keys', icon: KeyRound, countKey: 'merchantApiKeys' },
      { href: '/merchant/webhooks', label: 'Webhooks', icon: Webhook, countKey: 'merchantWebhooks' },
    ],
  },
  {
    group: 'Governance',
    items: [
      // First in the group, and above the rest of Governance: when something
      // is waiting on an officer it is the reason they opened the portal.
      { href: '/approvals' as Route, label: 'Approvals', icon: ShieldCheck, countKey: 'approvals' },
      { href: '/governance', label: 'Meetings & votes', icon: CalendarDays, countKey: 'governance' },
      { href: '/communications', label: 'Communications', icon: MessagesSquare, countKey: 'communications' },
      { href: '/listing', label: 'Public listing', icon: Globe, countKey: 'listing' },
    ],
  },
  {
    group: 'Manage',
    items: [
      { href: '/staff', label: 'Staff & roles', icon: UserCog, countKey: 'staff' },
      // Only communities whose plan carries `dedicated_support` see this —
      // the Sidebar drops it when the probe says the feature is off, the same
      // way the Rendi AI dock is probed rather than flagged.
      { href: '/account-officer' as Route, label: 'Account officer', icon: Headset, countKey: 'accountOfficer' },
      // Ungated: every community has the desk, whatever it pays.
      { href: '/support' as Route, label: 'Support', icon: LifeBuoy },
      // Below Staff rather than inside Members: a migration is a one-time
      // project with its own lifecycle, not a way of adding a member.
      { href: '/migrate', label: 'Migrate', icon: Import, countKey: 'staff' },
      { href: '/billing', label: 'Billing & plan', icon: CreditCard, countKey: 'billing' },
      // One screen for everything that decides what members are charged or
      // who qualifies. Every save on it is owner-approved, which is why it is
      // separate from Settings rather than another tab inside it.
      { href: '/configuration', label: 'Configuration', icon: SlidersHorizontal, countKey: 'configuration' },
      { href: '/settings', label: 'Settings', icon: Settings, countKey: 'settings' },
    ],
  },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { community } = useSession();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { data: navigationCounts, refresh: refreshNavigation } = useQuery<NavigationCounts | null>(
    () => (community ? portalApi.navigationBadges(community.id) : Promise.resolve(null)),
    [community?.id],
    { enabled: Boolean(community) },
  );

  useEffect(() => {
    if (!community) return;
    const timer = window.setInterval(() => void refreshNavigation(), 60_000);
    return () => window.clearInterval(timer);
  }, [community, refreshNavigation]);

  // Asked once rather than read from a NEXT_PUBLIC_ flag, so the dock cannot
  // appear in an environment where no model is configured and every question
  // would fail.
  const { data: rendiAi } = useQuery<{ enabled: boolean } | null>(
    () => (community ? portalApi.rendiAiAvailability(community.id) : Promise.resolve(null)),
    [community?.id],
    { enabled: Boolean(community) },
  );
  const rendiAiEnabled = Boolean(rendiAi?.enabled);

  // One probe decides every plan-gated nav item: the community's current
  // entitlements. Items whose feature the plan lacks are dropped, not
  // disabled — a plan limit is not something an officer can act on from a
  // greyed-out row. The API stays the authority on every actual call.
  const { data: entitlements } = useQuery<EntitlementsSummary | null>(
    () => (community ? portalApi.entitlements(community.id) : Promise.resolve(null)),
    [community?.id],
    { enabled: Boolean(community) },
  );
  /**
   * What this person may actually do here.
   *
   * A branch manager's community role is plain membership — all their
   * authority sits on their seats — so the shell cannot work out what to show
   * them from the role alone. Probed like entitlements rather than flagged,
   * and failing to a plain member's view if the call does not come back.
   */
  const { data: access } = useQuery<BranchAccess | null>(
    () => (community ? portalApi.branchAccess(community.id) : Promise.resolve(null)),
    [community?.id],
    { enabled: Boolean(community) },
  );

  const features = entitlements?.features ?? [];
  const planGates: Record<string, boolean> = {
    '/account-officer': features.includes('dedicated_support'),
    '/branches': features.includes('branches'),
    '/merchant/api-keys': features.includes('api_access') || Boolean(entitlements?.allowsApiAccess),
    '/merchant/webhooks': features.includes('integrations'),
  };

  /**
   * Opening Rendi AI collapses the left sidebar: two sidebars plus content is
   * more chrome than width allows, and the nav is the one an officer needs
   * least while asking a question. Their own collapse preference is
   * remembered and restored on close, so the panel borrows the space rather
   * than permanently rearranging their workspace.
   */
  const [aiOpen, setAiOpen] = useState(false);
  const collapsedBeforeAi = useRef(false);

  const toggleAi = () => {
    setAiOpen((wasOpen) => {
      if (!wasOpen) {
        collapsedBeforeAi.current = collapsed;
        setCollapsed(true);
      } else {
        setCollapsed(collapsedBeforeAi.current);
      }
      return !wasOpen;
    });
  };

  const closeAi = () => {
    if (!aiOpen) return;
    setCollapsed(collapsedBeforeAi.current);
    setAiOpen(false);
  };

  /**
   * The nav rail and Rendi AI compete for the same width, so expanding one
   * dismisses the other. An officer who reaches for the nav while the panel
   * is open has told us which of the two they want; leaving both open would
   * squeeze the page they are actually reading down to nothing.
   *
   * Collapsing the nav is not treated the same way: that frees space rather
   * than taking it, so the panel is left alone.
   */
  const toggleSidebar = () => {
    setCollapsed((wasCollapsed) => {
      const next = !wasCollapsed;
      // Their deliberate choice becomes the state Rendi AI restores to.
      collapsedBeforeAi.current = next;
      if (!next && aiOpen) setAiOpen(false);
      return next;
    });
  };

  useEffect(() => {
    if (!community) return;
    const item = NAV.flatMap((group) => group.items)
      .sort((a, b) => b.href.length - a.href.length)
      .find((candidate) =>
        candidate.exact
          ? pathname === candidate.href
          : pathname === candidate.href || pathname.startsWith(`${candidate.href}/`),
      );
    // Nothing to mark read on an item that never carried a count.
    if (!item?.countKey) return;
    void portalApi
      .markNavigationRead(community.id, item.countKey)
      .then(() => refreshNavigation())
      .catch(() => undefined);
  }, [community, pathname, refreshNavigation]);

  // Rendi has stopped this community. Everything inside it will refuse, so
  // this is the one thing on screen that has to be right.
  const halt = community?.halt ?? null;
  // This officer's own powers are paused, in a community that is otherwise
  // running. Shown instead of letting the portal look broken.
  const adminAccess = community?.adminAccess ?? null;

  // Suppressed while halted: "verification pending" is both wrong and
  // misleading for a suspended community, and two banners contradicting each
  // other is worse than either alone.
  const unverified = community?.status !== 'VERIFIED' && !halt;

  // Verification mandates the public listing. Rather than yanking the officer
  // off whatever page they opened, a blocking modal explains the one thing
  // left to do and offers the only way forward. No close affordance: the
  // mandate is the point.
  const mustSetUpListing =
    Boolean(community?.listingSetupRequired) && !pathname.startsWith('/listing');

  // Registration is not finished until the verification profile is in, and
  // this one has nowhere to send the owner — the form *is* the destination,
  // so it renders inline rather than offering a link. It takes precedence
  // over the listing mandate, which only applies once verified anyway.
  const mustCompleteProfile = Boolean(community?.verificationProfileRequired);

  return (
    <div className="min-h-dvh bg-[#F5F7FB]">
      {mustCompleteProfile && community && (
        <VerificationProfileModal communityId={community.id} communityName={community.name} />
      )}
      {mustSetUpListing && !mustCompleteProfile && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-navy-900/60 p-4 backdrop-blur-sm"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="listing-mandate-title"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50">
              <Globe className="h-5 w-5 text-blue-600" />
            </div>
            <h2 id="listing-mandate-title" className="mt-4 text-lg font-bold text-navy-900">
              Set up your listing page first
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              {community?.name} is now verified. Before you can use the rest of the portal, complete
              your public listing — logo, tagline, category and joining terms — and submit it for
              review. This is what members see when they find you in the Rendi app.
            </p>
            <button
              type="button"
              onClick={() => router.push('/listing')}
              className="mt-5 inline-flex h-11 w-full items-center justify-center rounded-xl bg-navy-900 text-sm font-semibold text-white transition hover:bg-navy-800"
            >
              Set up listing page
            </button>
          </div>
        </div>
      )}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-30 hidden bg-navy-900 transition-[width] duration-200 md:block',
          collapsed ? 'w-[72px]' : 'w-64',
        )}
      >
        <Sidebar
          collapsed={collapsed}
          counts={navigationCounts ?? undefined}
          planGates={planGates}
          access={access ?? null}
        />
        <button
          onClick={toggleSidebar}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="absolute bottom-4 right-3 flex h-8 w-8 items-center justify-center rounded-lg text-navy-300 hover:bg-white/10 hover:text-white focus-ring"
        >
          {collapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
        </button>
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            className="absolute inset-0 bg-navy-950/50"
            aria-label="Close menu"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw] animate-fade-in bg-navy-900">
            <Sidebar
              collapsed={false}
              counts={navigationCounts ?? undefined}
              planGates={planGates}
              access={access ?? null}
              onNavigate={() => setMobileOpen(false)}
            />
            <button
              onClick={() => setMobileOpen(false)}
              aria-label="Close menu"
              className="absolute right-3 top-4 rounded-lg p-1.5 text-navy-200 hover:bg-white/10"
            >
              <X className="h-5 w-5" />
            </button>
          </aside>
        </div>
      )}

      <div
        className={cn(
          'transition-[padding] duration-200',
          collapsed ? 'md:pl-[72px]' : 'md:pl-64',
          // Only from xl: narrower than that and reflowing would leave the
          // page unreadably squeezed, so the panel overlays instead.
          aiOpen && 'xl:pr-[380px]',
        )}
      >
        <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/90 backdrop-blur">
          <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
            <button
              onClick={() => {
                setMobileOpen(true);
                closeAi();
              }}
              aria-label="Open menu"
              className="-ml-1 rounded-lg p-2 text-slate-600 hover:bg-slate-100 md:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="md:hidden">
              <LogoMark className="h-7 w-7" />
            </div>
            <CommunitySwitcher />
            <div className="flex-1" />
            {rendiAiEnabled && <RendiAiTrigger open={aiOpen} onToggle={toggleAi} />}
            {/* Beside Rendi AI because they answer adjacent questions — one
                explains the screen, the other reaches a person. */}
            <SupportMenu hasAccountOfficer={features.includes('dedicated_support')} />
            <NotificationsMenu />
            <ProfileMenu />
          </div>
        </header>

        {halt && <HaltBanner halt={halt} />}
        {!halt && adminAccess && <AdminAccessBanner suspension={adminAccess} />}
        {unverified && <VerificationBanner />}

        <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:py-8">{children}</main>

        {/* Rendi AI rides along on every portal page: it is only useful while
            an officer is mid-task, and it needs the current route to answer
            "what is this number". Mounted whenever configured and kept
            off-screen while closed, so a conversation survives being
            dismissed to look at the page. */}
        {rendiAiEnabled && (
          <RendiAiPanel communityId={community?.id} open={aiOpen} onClose={closeAi} />
        )}
      </div>
    </div>
  );
}

function Sidebar({
  collapsed,
  counts,
  planGates,
  access,
  onNavigate,
}: {
  collapsed: boolean;
  counts?: NavigationCounts;
  /** href → whether the plan grants it; hrefs not listed are always shown. */
  planGates?: Record<string, boolean>;
  /** What the viewer may do — see the branch workspace card below. */
  access?: BranchAccess | null;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const { community } = useSession();

  const isActive = (item: NavItem) =>
    item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);

  // Plan-gated items are dropped, not disabled: a plan limit is not
  // something an officer can act on from a greyed-out row.
  const nav = NAV.map((group) => ({
    ...group,
    items: group.items.filter((item) => planGates?.[item.href] ?? true),
  }));

  return (
    <div className="flex h-full flex-col">
      <div
        className={cn(
          'flex h-16 items-center border-b border-white/5',
          collapsed ? 'justify-center px-2' : 'px-5',
        )}
      >
        {collapsed ? <LogoMark /> : <Logo dark />}
      </div>

      {community && !collapsed && (
        <div className="mx-3 mt-4 rounded-xl bg-white/[0.04] px-3 py-2.5 ring-1 ring-white/5">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-navy-700 text-navy-100">
              <Building2 className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-[13px] font-medium text-white">{community.name}</p>
              <p className="text-[11px] text-navy-300">
                {community.status === 'VERIFIED' ? 'Verified workspace' : 'Verification pending'}
              </p>
            </div>
          </div>

          {/*
            A branch officer signs in with the same account as everybody else —
            one person, one login, which is the platform's rule and not worth
            breaking for a second password to forget. What changes is where
            they land: the seats they hold are named here, so signing in puts
            them in their branch rather than in front of a cooperative they
            cannot act on.
          */}
          {access?.seats.length ? (
            <div className="mt-2.5 space-y-1 border-t border-white/5 pt-2.5">
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-navy-400">
                {access.isBranchOnly ? 'Your branch' : 'You also run'}
              </p>
              {access.seats.map((seat) => (
                <Link
                  key={seat.id}
                  href={`/branches/${seat.branch.id}`}
                  onClick={onNavigate}
                  className="focus-ring flex items-center gap-2 rounded-lg px-1.5 py-1 transition hover:bg-white/[0.06]"
                >
                  <Network className="h-3.5 w-3.5 shrink-0 text-brand-400" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12.5px] text-white">{seat.branch.name}</span>
                    <span className="block truncate text-[11px] text-navy-300">{seat.title}</span>
                  </span>
                </Link>
              ))}
              {access.powersPausedAt && (
                <p className="rounded-lg bg-red-500/10 px-1.5 py-1 text-[11px] leading-relaxed text-red-300">
                  Your officer powers are paused, so branch actions will be refused. Your own
                  records are unaffected.
                </p>
              )}
            </div>
          ) : null}
        </div>
      )}

      <nav className="mt-3 flex-1 overflow-y-auto px-3 pb-20" aria-label="Main">
        {nav.map((group) => (
          <div key={group.group} className="mt-4 first:mt-2">
            {!collapsed && (
              <p className="px-3 pb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-navy-400">
                {group.group}
              </p>
            )}
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const count = (item.countKey ? counts?.[item.countKey] : 0) ?? 0;

                if (item.children?.length) {
                  return (
                    <NavDisclosure
                      key={item.href}
                      item={item}
                      count={count}
                      counts={counts}
                      collapsed={collapsed}
                      pathname={pathname}
                      onNavigate={onNavigate}
                    />
                  );
                }

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      title={collapsed ? item.label : undefined}
                      aria-current={isActive(item) ? 'page' : undefined}
                      className={cn(
                        'group relative flex items-center gap-3 rounded-lg px-3 py-2 text-[13.5px] font-medium transition focus-ring',
                        collapsed && 'justify-center px-0',
                        isActive(item)
                          ? 'bg-white/10 text-white shadow-[inset_2px_0_0_#10B981]'
                          : 'text-navy-200 hover:bg-white/5 hover:text-white',
                      )}
                    >
                      <item.icon className="h-[18px] w-[18px] shrink-0" aria-hidden />
                      {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
                      {count > 0 && (
                        <span
                          className={cn(
                            'tnum flex min-w-5 items-center justify-center rounded-full bg-brand-500 px-1.5 py-0.5 text-[10px] font-bold leading-4 text-white',
                            collapsed && 'absolute -right-1 -top-1 h-4 min-w-4 px-1 text-[9px]',
                          )}
                          aria-label={`${count} update${count === 1 ? '' : 's'}`}
                        >
                          {count > 99 ? '99+' : count}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </div>
  );
}

/** Officers of more than one community get a switcher; everyone else a label. */
function CommunitySwitcher() {
  const { community, communities, switchCommunity, switching } = useSession();
  if (!community) return null;

  if (communities.length < 2) {
    return (
      <span className="hidden truncate text-sm font-medium text-navy-900 sm:block">
        {community.name}
      </span>
    );
  }

  return (
    <Popover
      align="left"
      width="w-72"
      trigger={({ toggle }) => (
        <button
          onClick={toggle}
          disabled={switching}
          className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium text-navy-900 hover:bg-slate-100 focus-ring disabled:opacity-60"
        >
          <Building2 className="h-4 w-4 text-slate-500" />
          <span className="max-w-[12rem] truncate">{community.name}</span>
        </button>
      )}
    >
      {(close) => (
        <>
          <p className="border-b border-slate-100 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Your communities
          </p>
          {communities.map((c) => (
            <MenuItem
              key={c.id}
              icon={c.id === community.id ? <Check /> : <Building2 />}
              onClick={() => {
                void switchCommunity(c.id);
                close();
              }}
            >
              <span className="flex flex-col">
                <span>{c.name}</span>
                <span className="text-[11px] text-slate-500">
                  {c.title ?? c.role.replace('COMMUNITY_', '').toLowerCase()}
                </span>
              </span>
            </MenuItem>
          ))}
        </>
      )}
    </Popover>
  );
}

function ProfileMenu() {
  const { user, community, signOut } = useSession();
  const router = useRouter();

  return (
    <Popover
      trigger={({ toggle }) => (
        <button
          onClick={toggle}
          className="flex items-center gap-2.5 rounded-lg py-1 pl-1 pr-2 hover:bg-slate-100 focus-ring"
          aria-label="Profile menu"
        >
          <Avatar name={user.name} size="sm" />
          <span className="hidden text-left lg:block">
            <span className="block text-[13px] font-medium leading-tight text-navy-900">
              {user.name}
            </span>
            <span className="block text-[11px] text-slate-500">
              {community?.title ?? community?.role.replace('COMMUNITY_', '').toLowerCase()}
            </span>
          </span>
        </button>
      )}
    >
      {(close) => (
        <>
          <div className="border-b border-slate-100 px-3 py-2.5">
            <p className="text-sm font-medium text-navy-900">{user.name}</p>
            <p className="truncate text-xs text-slate-500">{user.email}</p>
          </div>
          <MenuItem
            icon={<Settings />}
            onClick={() => {
              router.push('/settings' as Route);
              close();
            }}
          >
            Settings
          </MenuItem>
          <div className="my-1 border-t border-slate-100" />
          <MenuItem danger icon={<LogOut />} onClick={() => void signOut()}>
            Sign out
          </MenuItem>
        </>
      )}
    </Popover>
  );
}

/**
 * The community has been stopped by Rendi.
 *
 * Renders the API's own `message` rather than composing its own sentence: an
 * officer who ignores this and clicks something will get that exact wording
 * back as an error, and the banner saying something different would read as
 * two unrelated problems.
 *
 * Red for a suspension, slate for an inactive community. The difference is
 * the point — one is a sanction, the other is a community that has simply
 * wound down, and colouring them the same would accuse a dormant cooperative
 * of something.
 */
function HaltBanner({ halt }: { halt: NonNullable<CommunitySummary['halt']> }) {
  const sanctioned = halt.status !== 'INACTIVE';
  return (
    <div
      role="alert"
      className={cn(
        'border-b',
        sanctioned ? 'border-red-200 bg-red-50' : 'border-slate-300 bg-slate-100',
      )}
    >
      <div
        className={cn(
          'flex flex-wrap items-start gap-x-3 gap-y-1 px-4 py-2.5 text-[13px] sm:px-6',
          sanctioned ? 'text-red-900' : 'text-slate-800',
        )}
      >
        <ShieldAlert
          className={cn(
            'mt-0.5 h-4 w-4 shrink-0',
            sanctioned ? 'text-red-600' : 'text-slate-500',
          )}
        />
        <span className="flex-1">
          <strong className="font-semibold">
            {halt.status === 'SUSPENDED'
              ? 'Community suspended.'
              : halt.status === 'INACTIVE'
                ? 'Community inactive.'
                : 'Registration not approved.'}
          </strong>{' '}
          {halt.message}
        </span>
      </div>
    </div>
  );
}

/**
 * This officer's powers are paused, but the community is running.
 *
 * Worth its own banner because the failure mode without it is the worst kind:
 * every button still there, every one of them refusing, and no explanation
 * anywhere on the page.
 */
function AdminAccessBanner({
  suspension,
}: {
  suspension: NonNullable<CommunitySummary['adminAccess']>;
}) {
  return (
    <div role="alert" className="border-b border-amber-300 bg-amber-100">
      <div className="flex flex-wrap items-start gap-x-3 gap-y-1 px-4 py-2.5 text-[13px] text-amber-900 sm:px-6">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
        <span className="flex-1">
          <strong className="font-semibold">Administrator access suspended.</strong>{' '}
          {suspension.message}
        </span>
      </div>
    </div>
  );
}

function VerificationBanner() {
  const router = useRouter();
  return (
    <div className="border-b border-amber-200 bg-amber-50">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-[13px] text-amber-900 sm:px-6">
        <ShieldAlert className="h-4 w-4 shrink-0 text-amber-600" />
        <span className="flex-1">
          <strong className="font-semibold">Verification pending.</strong> Collections, payouts,
          disbursements and your public listing stay restricted until Rendi verifies this community.
        </span>
        <Button size="xs" variant="secondary" onClick={() => router.push('/settings' as Route)}>
          View status
        </Button>
      </div>
    </div>
  );
}

/**
 * A nav item that owns sub-pages.
 *
 * Open state is seeded from the route and then controlled, so landing on
 * /accounting/journals shows the section already expanded — an officer who
 * followed a link should not have to re-open the group to see where they
 * are. Toggling afterwards is remembered for the session.
 *
 * The parent stays a link, not a bare toggle: /accounting is a real hub page
 * listing the same sections, and turning it into a chevron-only row would
 * make it unreachable.
 */
function NavDisclosure({
  item,
  count,
  counts,
  collapsed,
  pathname,
  onNavigate,
}: {
  item: NavItem;
  count: number;
  counts?: Partial<Record<NavCountKey, number>>;
  collapsed: boolean;
  pathname: string;
  onNavigate?: () => void;
}) {
  const within = pathname === item.href || pathname.startsWith(`${item.href}/`);
  // A child may live outside the parent's path — trial balance is its own
  // route — so section membership is decided by the children themselves.
  const onChild = (item.children ?? []).some(
    (c) => pathname === c.href || pathname.startsWith(`${c.href}/`),
  );
  // Derived, not synced. The route decides whether the section is open; the
  // override only exists once an officer has deliberately toggled it, and
  // then it wins. Mirroring the route into state and correcting it from an
  // effect costs a second render and makes the two disagree in between.
  const [override, setOverride] = useState<boolean | null>(null);
  const open = override ?? (within || onChild);

  const parentActive = item.exact ? pathname === item.href : within;

  if (collapsed) {
    // No room for a tree. The parent alone keeps the section reachable.
    return (
      <li>
        <Link
          href={item.href}
          onClick={onNavigate}
          title={item.label}
          aria-current={parentActive || onChild ? 'page' : undefined}
          className={cn(
            'group relative flex items-center justify-center rounded-lg py-2 text-[13.5px] font-medium transition focus-ring',
            parentActive || onChild
              ? 'bg-white/10 text-white shadow-[inset_2px_0_0_#10B981]'
              : 'text-navy-200 hover:bg-white/5 hover:text-white',
          )}
        >
          <item.icon className="h-[18px] w-[18px] shrink-0" aria-hidden />
        </Link>
      </li>
    );
  }

  return (
    <li>
      <div
        className={cn(
          'group flex items-center rounded-lg pr-1 transition',
          parentActive
            ? 'bg-white/10 text-white shadow-[inset_2px_0_0_#10B981]'
            : 'text-navy-200 hover:bg-white/5 hover:text-white',
        )}
      >
        <Link
          href={item.href}
          onClick={onNavigate}
          aria-current={parentActive ? 'page' : undefined}
          className="flex flex-1 items-center gap-3 rounded-lg px-3 py-2 text-[13.5px] font-medium focus-ring"
        >
          <item.icon className="h-[18px] w-[18px] shrink-0" aria-hidden />
          <span className="flex-1 truncate">{item.label}</span>
          {count > 0 && (
            <span className="tnum flex min-w-5 items-center justify-center rounded-full bg-brand-500 px-1.5 py-0.5 text-[10px] font-bold leading-4 text-white">
              {count > 99 ? '99+' : count}
            </span>
          )}
        </Link>
        <button
          type="button"
          onClick={() => setOverride(!open)}
          aria-expanded={open}
          aria-label={`${open ? 'Collapse' : 'Expand'} ${item.label}`}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-navy-300 transition hover:bg-white/10 hover:text-white focus-ring"
        >
          <ChevronDown
            className={cn('h-4 w-4 transition-transform', open && 'rotate-180')}
            aria-hidden
          />
        </button>
      </div>

      {open && (
        <ul className="mt-0.5 space-y-0.5 border-l border-white/10 pl-3 ml-5">
          {(item.children ?? []).map((child) => {
            const childActive =
              pathname === child.href || pathname.startsWith(`${child.href}/`);
            const childCount = (child.countKey ? counts?.[child.countKey] : 0) ?? 0;
            return (
              <li key={child.href}>
                <Link
                  href={child.href}
                  onClick={onNavigate}
                  aria-current={childActive ? 'page' : undefined}
                  className={cn(
                    'flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[12.5px] font-medium transition focus-ring',
                    childActive
                      ? 'bg-white/10 text-white'
                      : 'text-navy-300 hover:bg-white/5 hover:text-white',
                  )}
                >
                  <child.icon className="h-[15px] w-[15px] shrink-0" aria-hidden />
                  <span className="flex-1 truncate">{child.label}</span>
                  {childCount > 0 && (
                    <span className="tnum flex min-w-4 items-center justify-center rounded-full bg-brand-500 px-1 py-0.5 text-[9px] font-bold leading-4 text-white">
                      {childCount > 99 ? '99+' : childCount}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </li>
  );
}
