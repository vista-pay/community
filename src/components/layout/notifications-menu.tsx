'use client';

import { useRouter } from 'next/navigation';
import type { Route } from 'next';
import { Bell, CheckCheck } from 'lucide-react';
import { cn, relative } from '@/lib/format';
import { Popover } from '@/components/ui';
import { useQuery } from '@/hooks/use-query';
import { portalApi } from '@/services/portal';
import type { NotificationItem } from '@/types';

export function NotificationsMenu() {
  const router = useRouter();
  const { data, refresh } = useQuery<NotificationItem[]>(() => portalApi.notifications(), []);
  const items = data ?? [];
  const unread = items.filter((n) => !n.isRead).length;

  async function markAll() {
    await portalApi.markAllNotificationsRead();
    await refresh();
  }

  async function open(item: NotificationItem) {
    if (!item.isRead) {
      await portalApi.markNotificationRead(item.id);
      await refresh();
    }
  }

  return (
    <Popover
      width="w-[min(22rem,calc(100vw-2rem))]"
      trigger={({ toggle }) => (
        <button
          onClick={toggle}
          aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}
          className="relative flex h-10 w-10 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 focus-ring"
        >
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span className="tnum absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold text-white">
              {unread}
            </span>
          )}
        </button>
      )}
    >
      {(close) => (
        <div>
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
            <p className="text-sm font-semibold text-navy-900">Notifications</p>
            <button
              disabled={!unread}
              onClick={() => void markAll()}
              className="flex items-center gap-1 text-xs font-medium text-brand-700 disabled:text-slate-400"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Mark all read
            </button>
          </div>

          {items.length === 0 ? (
            <p className="px-4 py-8 text-center text-[13px] text-slate-500">You&apos;re all caught up.</p>
          ) : (
            <ul className="max-h-96 divide-y divide-slate-100 overflow-y-auto">
              {items.slice(0, 6).map((n) => (
                <li key={n.id}>
                  <button
                    onClick={() => void open(n)}
                    className="flex w-full gap-3 px-4 py-3 text-left hover:bg-slate-50"
                  >
                    <span
                      className={cn(
                        'mt-1.5 h-2 w-2 shrink-0 rounded-full',
                        n.isRead ? 'bg-transparent' : 'bg-brand-500',
                      )}
                    />
                    <span className="min-w-0">
                      <span className="block text-[13px] font-medium text-navy-900">{n.title}</span>
                      <span className="mt-0.5 block text-xs leading-relaxed text-slate-500">
                        {n.message}
                      </span>
                      <span className="mt-1 block text-[11px] text-slate-400">
                        {relative(n.createdAt)}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <button
            onClick={() => {
              router.push('/notifications' as Route);
              close();
            }}
            className="block w-full border-t border-slate-100 px-4 py-2.5 text-center text-[13px] font-medium text-brand-700 hover:bg-slate-50"
          >
            View all notifications
          </button>
        </div>
      )}
    </Popover>
  );
}
