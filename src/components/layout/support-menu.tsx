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

export function SupportMenu({ hasAccountOfficer }: { hasAccountOfficer: boolean }) {
  const pathname = usePathname();
  const active = pathname.startsWith('/support') || pathname.startsWith('/account-officer');
  const { data, refresh } = useQuery<NotificationItem[]>(() => portalApi.notifications(), []);
  const supportAlerts = (data ?? []).filter((item) => item.type === 'SUPPORT' && !item.isRead);

  useRealtimeEvent('support.updated', () => void refresh());

  async function openSupport(close: () => void) {
    close();
    await Promise.all(supportAlerts.map((item) => portalApi.markNotificationRead(item.id)));
    if (supportAlerts.length) await refresh();
  }

  return (
    <Popover
      align="right"
      width="w-72"
      trigger={({ open, toggle }) => (
        <button
          type="button"
          onClick={toggle}
          aria-label="Help and support"
          aria-expanded={open}
          className={cn(
            'flex h-10 items-center gap-2 rounded-lg px-2.5 focus-ring transition',
            open || active
              ? 'bg-navy-50 text-navy-700'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
          )}
        >
          <span className="relative shrink-0">
            <LifeBuoy className="h-5 w-5" />
            {supportAlerts.length > 0 && (
              <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-white bg-red-600" />
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
              onNavigate={close}
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
  onNavigate,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  body: string;
  onNavigate: () => void;
}) {
  return (
    <Link
      href={href as never}
      onClick={onNavigate}
      className="flex gap-2.5 px-3 py-2.5 transition-colors hover:bg-slate-50"
    >
      <span className="mt-0.5 shrink-0 text-slate-500">{icon}</span>
      <span className="min-w-0">
        <span className="block text-[13px] font-semibold text-navy-900">{title}</span>
        <span className="block text-[11px] leading-4 text-slate-500">{body}</span>
      </span>
    </Link>
  );
}
