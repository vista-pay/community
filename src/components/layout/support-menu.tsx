'use client';

/**
 * The two ways a community can reach Rendi, behind one glyph.
 *
 * They are genuinely different things, which is why this is a menu rather
 * than a link. Support is the desk every community has on every plan; the
 * account officer is a named person some plans buy. Putting them behind one
 * button and labelling each is how an officer learns the difference — and
 * how a community on a cheaper plan discovers the paid one exists without
 * being shown a dead end.
 *
 * A life ring rather than a question mark: "?" in a header has come to mean
 * product documentation, and this is a route to a human.
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Headset, LifeBuoy } from 'lucide-react';
import { Popover } from '@/components/ui';
import { cn } from '@/lib/format';
import { useQuery } from '@/hooks/use-query';
import { useRealtimeEvent } from '@/hooks/use-realtime';
import { portalApi } from '@/services/portal';
import type { NotificationItem } from '@/types';
import type { AccountOfficerCard } from '@/types';
import { useSession } from '@/components/providers/session-provider';

export function SupportMenu({ hasAccountOfficer }: { hasAccountOfficer: boolean }) {
  const pathname = usePathname();
  const { community } = useSession();
  const communityId = community?.id ?? '';
  const active = pathname.startsWith('/support') || pathname.startsWith('/account-officer');
  const { data, refresh } = useQuery<NotificationItem[]>(() => portalApi.notifications(), []);
  const { data: officerCard, refresh: refreshOfficer } = useQuery<AccountOfficerCard | null>(
    () =>
      communityId && hasAccountOfficer
        ? portalApi.accountOfficer(communityId)
        : Promise.resolve(null),
    [communityId, hasAccountOfficer, pathname],
    { enabled: Boolean(communityId && hasAccountOfficer) },
  );
  const supportAlerts = (data ?? []).filter((item) => item.type === 'SUPPORT' && !item.isRead);
  const officerAlerts = officerCard?.unread ?? 0;
  const unreadHelp = supportAlerts.length + officerAlerts;
  const helpActive = unreadHelp > 0;

  useRealtimeEvent('support.updated', () => void refresh());
  useRealtimeEvent(
    'account-officer.message',
    () => void refreshOfficer(),
    Boolean(communityId && hasAccountOfficer),
  );

  async function openSupport(close: () => void) {
    close();
    await Promise.all(supportAlerts.map((item) => portalApi.markNotificationRead(item.id)));
    if (supportAlerts.length) await refresh();
  }

  async function openAccountOfficer(close: () => void) {
    close();
    if (!communityId || !officerAlerts) return;
    // Reading the thread is the server-side read receipt. Doing it here makes
    // the shared Help indicator clear immediately as navigation begins.
    await portalApi.accountOfficerThread(communityId);
    await refreshOfficer();
  }

  return (
    <Popover
      align="right"
      width="w-72"
      trigger={({ open, toggle }) => (
        <button
          type="button"
          onClick={toggle}
          aria-label={`Help and support${unreadHelp ? `, ${unreadHelp} new update${unreadHelp === 1 ? '' : 's'}` : ''}`}
          aria-expanded={open}
          className={cn(
            'relative flex h-10 items-center gap-2 rounded-lg px-2.5 focus-ring transition',
            helpActive
              ? 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-200 shadow-sm'
              : open || active
              ? 'bg-navy-50 text-navy-700'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
          )}
        >
          <span className="relative shrink-0">
            <LifeBuoy className="h-5 w-5" />
            {helpActive && (
              <span className="absolute -right-2.5 -top-2.5 flex h-5 min-w-5 animate-pulse items-center justify-center rounded-full border-2 border-white bg-red-600 px-1 text-[10px] font-bold leading-none text-white shadow-sm">
                {unreadHelp > 9 ? '9+' : unreadHelp}
              </span>
            )}
          </span>
          <span className="hidden text-[13px] font-semibold sm:inline">Help</span>
        </button>
      )}
    >
      {(close) => (
        <div className="py-1.5">
          <p className="px-3 pb-1.5 pt-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Get help
          </p>

          <MenuLink
            href="/support"
            icon={<LifeBuoy className="h-4 w-4" />}
            title="Support"
            body="Rendi's help desk. Raise a request and track the reply."
            unread={supportAlerts.length}
            onNavigate={() => void openSupport(close)}
          />

          {/* Shown only when the plan carries it. A disabled row would be an
              advert in a menu, and an officer cannot act on it from here —
              Billing is where the upgrade conversation belongs. */}
          {hasAccountOfficer && (
            <MenuLink
              href="/account-officer"
              icon={<Headset className="h-4 w-4" />}
              title="Account officer"
              body="Your named contact, who knows this community."
              unread={officerAlerts}
              onNavigate={() => void openAccountOfficer(close)}
            />
          )}
        </div>
      )}
    </Popover>
  );
}

function MenuLink({
  href,
  icon,
  title,
  body,
  unread = 0,
  onNavigate,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  body: string;
  unread?: number;
  onNavigate: () => void;
}) {
  return (
    <Link
      href={href as never}
      onClick={onNavigate}
      className={cn(
        'mx-1.5 flex gap-2.5 rounded-lg px-3 py-2.5 transition-colors',
        unread ? 'bg-red-50 ring-1 ring-inset ring-red-100 hover:bg-red-100' : 'hover:bg-slate-50',
      )}
    >
      <span className={cn('relative mt-0.5 shrink-0', unread ? 'text-red-600' : 'text-slate-500')}>
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2 text-[13px] font-semibold text-navy-900">
          {title}
          {unread > 0 && (
            <span className="shrink-0 rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold text-white">
              {unread > 99 ? '99+' : unread} new
            </span>
          )}
        </span>
        <span className="block text-[11px] leading-4 text-slate-500">{body}</span>
      </span>
    </Link>
  );
}
