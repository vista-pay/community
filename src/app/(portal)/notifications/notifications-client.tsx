'use client';

import { Bell, CheckCheck } from 'lucide-react';
import { Button, Card, EmptyState, PageHeader } from '@/components/ui';
import { useMutation, useQuery } from '@/hooks/use-query';
import { portalApi } from '@/services/portal';
import { cn, date, humanise } from '@/lib/format';
import type { NotificationItem } from '@/types';

export function NotificationsClient({ initial }: { initial: NotificationItem[] }) {
  const { data, refresh } = useQuery<NotificationItem[]>(() => portalApi.notifications(), [], {
    initial,
  });

  const items = data ?? [];
  const unread = items.filter((n) => !n.isRead).length;

  const markAll = useMutation(() => portalApi.markAllNotificationsRead(), {
    onSuccess: () => void refresh(),
  });

  const markOne = useMutation((id: string) => portalApi.markNotificationRead(id), {
    onSuccess: () => void refresh(),
  });

  return (
    <>
      <PageHeader
        title="Notifications"
        subtitle={unread ? `${unread} unread` : 'All caught up'}
        actions={
          <Button
            variant="secondary"
            disabled={!unread}
            loading={markAll.pending}
            icon={<CheckCheck className="h-4 w-4" />}
            onClick={() => void markAll.run()}
          >
            Mark all read
          </Button>
        }
      />

      <Card>
        {items.length === 0 ? (
          <EmptyState
            icon={<Bell className="h-5 w-5" />}
            title="Nothing here"
            body="Payments, applications and system notices arrive here."
          />
        ) : (
          <ul className="divide-y divide-slate-100">
            {items.map((n) => (
              <li key={n.id}>
                <button
                  onClick={() => !n.isRead && void markOne.run(n.id)}
                  className="flex w-full gap-3 px-5 py-4 text-left transition hover:bg-slate-50"
                >
                  <span
                    className={cn(
                      'mt-1.5 h-2 w-2 shrink-0 rounded-full',
                      n.isRead ? 'bg-transparent' : 'bg-brand-500',
                    )}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-navy-900">{n.title}</span>
                    <span className="mt-0.5 block text-[13px] leading-relaxed text-slate-600">
                      {n.message}
                    </span>
                    <span className="mt-1 block text-xs text-slate-400">
                      {humanise(n.type)} · {date(n.createdAt, 'datetime')}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
