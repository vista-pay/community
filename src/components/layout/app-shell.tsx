'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { Route } from 'next';
import {
  BarChart3,
  BookOpen,
  Building2,
  CalendarDays,
  Check,
  ChevronsLeft,
  ChevronsRight,
  CreditCard,
  Globe,
  HandCoins,
  LayoutDashboard,
  LogOut,
  Menu,
  MessagesSquare,
  PiggyBank,
  RefreshCw,
  Settings,
  ShieldAlert,
  Sparkles,
  UserCog,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { cn } from '@/lib/format';
import { Avatar, Button, MenuItem, Popover } from '@/components/ui';
import { useSession } from '@/components/providers/session-provider';
import { Logo, LogoMark } from './Logo';
import { NotificationsMenu } from './notifications-menu';

type NavItem = { href: Route; label: string; icon: typeof Users; exact?: boolean };

const NAV: Array<{ group: string; items: NavItem[] }> = [
  { group: 'Overview', items: [{ href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard }] },
  {
    group: 'Community',
    items: [
      { href: '/members', label: 'Members', icon: Users, exact: true },
      { href: '/members/requests', label: 'Join requests', icon: UserPlus },
      { href: '/contributions', label: 'Contributions & Ajo', icon: RefreshCw },
      { href: '/savings', label: 'Savings', icon: PiggyBank },
      { href: '/loans', label: 'Loans', icon: HandCoins },
      { href: '/services', label: 'Services', icon: Sparkles },
    ],
  },
  {
    group: 'Finance',
    items: [
      { href: '/accounting', label: 'Accounting', icon: BookOpen },
      { href: '/reports', label: 'Reports', icon: BarChart3 },
    ],
  },
  {
    group: 'Governance',
    items: [
      { href: '/governance', label: 'Meetings & votes', icon: CalendarDays },
      { href: '/communications', label: 'Communications', icon: MessagesSquare },
      { href: '/listing', label: 'Public listing', icon: Globe },
    ],
  },
  {
    group: 'Manage',
    items: [
      { href: '/staff', label: 'Staff & roles', icon: UserCog },
      { href: '/billing', label: 'Billing & plan', icon: CreditCard },
      { href: '/settings', label: 'Settings', icon: Settings },
    ],
  },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { community } = useSession();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const unverified = community?.status !== 'VERIFIED';

  return (
    <div className="min-h-dvh bg-[#F5F7FB]">
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-30 hidden bg-navy-900 transition-[width] duration-200 md:block',
          collapsed ? 'w-[72px]' : 'w-64',
        )}
      >
        <Sidebar collapsed={collapsed} />
        <button
          onClick={() => setCollapsed((c) => !c)}
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
            <Sidebar collapsed={false} onNavigate={() => setMobileOpen(false)} />
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

      <div className={cn('transition-[padding] duration-200', collapsed ? 'md:pl-[72px]' : 'md:pl-64')}>
        <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/90 backdrop-blur">
          <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
            <button
              onClick={() => setMobileOpen(true)}
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
            <NotificationsMenu />
            <ProfileMenu />
          </div>
        </header>

        {unverified && <VerificationBanner />}

        <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:py-8">{children}</main>
      </div>
    </div>
  );
}

function Sidebar({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  const { community } = useSession();

  const isActive = (item: NavItem) =>
    item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);

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
        <div className="mx-3 mt-4 flex items-center gap-3 rounded-xl bg-white/[0.04] px-3 py-2.5 ring-1 ring-white/5">
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
      )}

      <nav className="mt-3 flex-1 overflow-y-auto px-3 pb-20" aria-label="Main">
        {NAV.map((group) => (
          <div key={group.group} className="mt-4 first:mt-2">
            {!collapsed && (
              <p className="px-3 pb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-navy-400">
                {group.group}
              </p>
            )}
            <ul className="space-y-0.5">
              {group.items.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    title={collapsed ? item.label : undefined}
                    aria-current={isActive(item) ? 'page' : undefined}
                    className={cn(
                      'group flex items-center gap-3 rounded-lg px-3 py-2 text-[13.5px] font-medium transition focus-ring',
                      collapsed && 'justify-center px-0',
                      isActive(item)
                        ? 'bg-white/10 text-white shadow-[inset_2px_0_0_#10B981]'
                        : 'text-navy-200 hover:bg-white/5 hover:text-white',
                    )}
                  >
                    <item.icon className="h-[18px] w-[18px] shrink-0" aria-hidden />
                    {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
                  </Link>
                </li>
              ))}
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

function VerificationBanner() {
  const router = useRouter();
  return (
    <div className="border-b border-amber-200 bg-amber-50">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-[13px] text-amber-900 sm:px-6">
        <ShieldAlert className="h-4 w-4 shrink-0 text-amber-600" />
        <span className="flex-1">
          <strong className="font-semibold">Verification pending.</strong> Collections, payouts,
          disbursements and your public listing stay restricted until Vista verifies this community.
        </span>
        <Button size="xs" variant="secondary" onClick={() => router.push('/settings' as Route)}>
          View status
        </Button>
      </div>
    </div>
  );
}
