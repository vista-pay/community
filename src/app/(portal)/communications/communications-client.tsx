'use client';

import { useState } from 'react';
import { Mail, Megaphone, MessageSquare, Pin, Send, Smartphone } from 'lucide-react';
import {
  Badge,
  Button,
  Callout,
  Card,
  CardHeader,
  Checkbox,
  DataTable,
  EmptyState,
  Field,
  Input,
  Modal,
  PageHeader,
  Segmented,
  StatusBadge,
  Tabs,
  Textarea,
} from '@/components/ui';
import { useMutation, useQuery } from '@/hooks/use-query';
import { useCommunityId } from '@/components/providers/session-provider';
import { useToast } from '@/components/providers/toast-provider';
import { portalApi } from '@/services/portal';
import { date, humanise, relative } from '@/lib/format';
import type { Announcement, Broadcast } from '@/types';

type Tab = 'announcements' | 'broadcasts';

export function CommunicationsClient({
  broadcasts: initialBroadcasts,
  announcements: initialAnnouncements,
}: {
  broadcasts: Broadcast[];
  announcements: Announcement[];
}) {
  const communityId = useCommunityId();
  const [tab, setTab] = useState<Tab>('announcements');
  const [composing, setComposing] = useState(false);

  const announcements = useQuery(() => portalApi.announcements(communityId), [communityId], {
    initial: initialAnnouncements,
  });
  const broadcasts = useQuery(() => portalApi.broadcasts(communityId), [communityId], {
    initial: initialBroadcasts,
  });

  return (
    <>
      <PageHeader
        title="Communications"
        subtitle="Notices on the board, and messages that leave the platform"
        actions={
          <Button icon={<Send className="h-4 w-4" />} onClick={() => setComposing(true)}>
            {tab === 'announcements' ? 'Post a notice' : 'Send a broadcast'}
          </Button>
        }
      />

      <Tabs
        value={tab}
        onChange={setTab}
        className="mb-4"
        tabs={[
          { value: 'announcements', label: 'Notice board', count: (announcements.data ?? []).length },
          { value: 'broadcasts', label: 'SMS & email', count: (broadcasts.data ?? []).length },
        ]}
      />

      {tab === 'announcements' ? (
        <div className="space-y-3">
          {(announcements.data ?? []).length === 0 ? (
            <Card>
              <EmptyState
                icon={<Megaphone className="h-5 w-5" />}
                title="No notices posted"
                body="Members see notices in the Vista app, on the community's page."
              />
            </Card>
          ) : (
            (announcements.data ?? []).map((a) => (
              <Card key={a.id}>
                <div className="px-5 py-4">
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      {a.title && (
                        <p className="text-[15px] font-semibold text-navy-900">{a.title}</p>
                      )}
                      <p className="mt-1 whitespace-pre-wrap text-[13px] text-slate-700">{a.body}</p>
                    </div>
                    {a.isPinned && (
                      <Badge tone="gold">
                        <Pin className="h-3 w-3" /> Pinned
                      </Badge>
                    )}
                  </div>
                  <p className="mt-3 text-xs text-slate-400">
                    {a.author ? `${a.author} · ` : ''}
                    {relative(a.createdAt)}
                  </p>
                </div>
              </Card>
            ))
          )}
        </div>
      ) : (
        <Card>
          <CardHeader
            title="Broadcast history"
            subtitle="Delivery counts come from the provider, not from us"
          />
          <DataTable
            rows={broadcasts.data ?? []}
            rowKey={(b) => b.id}
            loading={broadcasts.loading}
            columns={[
              {
                key: 'title',
                header: 'Message',
                cell: (b) => (
                  <span>
                    <span className="block font-medium text-navy-900">{b.title}</span>
                    <span className="block max-w-sm truncate text-xs text-slate-500">{b.body}</span>
                  </span>
                ),
              },
              {
                key: 'channel',
                header: 'Channel',
                cell: (b) => (
                  <span className="flex items-center gap-1.5 text-[13px]">
                    {b.channel === 'SMS' ? (
                      <MessageSquare className="h-3.5 w-3.5 text-slate-400" />
                    ) : b.channel === 'EMAIL' ? (
                      <Mail className="h-3.5 w-3.5 text-slate-400" />
                    ) : (
                      <Smartphone className="h-3.5 w-3.5 text-slate-400" />
                    )}
                    {humanise(b.channel)}
                  </span>
                ),
              },
              {
                key: 'recipients',
                header: 'Delivered',
                align: 'right',
                cell: (b) => (
                  <span className="tnum">
                    {b.deliveredCount} / {b.recipientCount}
                  </span>
                ),
              },
              { key: 'status', header: 'Status', cell: (b) => <StatusBadge status={b.status.toLowerCase()} /> },
              {
                key: 'sent',
                header: 'Sent',
                hideOnMobile: true,
                cell: (b) => (
                  <span className="text-slate-500">
                    {b.sentAt
                      ? date(b.sentAt, 'datetime')
                      : b.scheduledFor
                        ? `scheduled ${date(b.scheduledFor, 'datetime')}`
                        : '—'}
                  </span>
                ),
              },
            ]}
            empty={
              <EmptyState
                icon={<Send className="h-5 w-5" />}
                title="Nothing sent yet"
                body="SMS and email reach members who are not opening the app."
              />
            }
          />
        </Card>
      )}

      <ComposeModal
        open={composing}
        mode={tab}
        communityId={communityId}
        onClose={() => setComposing(false)}
        onSent={async () => {
          setComposing(false);
          await (tab === 'announcements' ? announcements.refresh() : broadcasts.refresh());
        }}
      />
    </>
  );
}

function ComposeModal({
  open,
  mode,
  communityId,
  onClose,
  onSent,
}: {
  open: boolean;
  mode: Tab;
  communityId: string;
  onClose: () => void;
  onSent: () => Promise<void>;
}) {
  const { toast } = useToast();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [pin, setPin] = useState(false);
  const [notify, setNotify] = useState(true);
  const [channel, setChannel] = useState<'APP' | 'SMS' | 'EMAIL'>('EMAIL');

  const send = useMutation(
    async (): Promise<void> => {
      if (mode === 'announcements') {
        await portalApi.postAnnouncement({
          communityId,
          title: title.trim() || undefined,
          body: body.trim(),
          pin,
          notify,
        });
        return;
      }
      await portalApi.createBroadcast(communityId, {
        title: title.trim(),
        body: body.trim(),
        channel,
      });
    },
    {
      onSuccess: async () => {
        toast(mode === 'announcements' ? 'Notice posted' : 'Broadcast queued', 'success');
        setTitle('');
        setBody('');
        await onSent();
      },
      onError: (message) => toast('Could not send', 'error', message),
    },
  );

  const smsSegments = Math.ceil(body.length / 160) || 1;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={mode === 'announcements' ? 'Post a notice' : 'Send a broadcast'}
      description={
        mode === 'announcements'
          ? 'Appears on the community board in the Vista app.'
          : 'Leaves the platform by SMS or email.'
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={body.trim().length < 3 || (mode === 'broadcasts' && title.trim().length < 3)}
            loading={send.pending}
            onClick={() => void send.run()}
          >
            {mode === 'announcements' ? 'Post' : 'Send'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {send.error && <Callout tone="danger">{send.error}</Callout>}

        <Field
          label="Title"
          htmlFor="cm-title"
          required={mode === 'broadcasts'}
          optional={mode === 'announcements'}
        >
          <Input id="cm-title" value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>

        <Field label="Message" htmlFor="cm-body" required>
          <Textarea id="cm-body" rows={5} value={body} onChange={(e) => setBody(e.target.value)} />
        </Field>

        {mode === 'broadcasts' ? (
          <>
            <Field label="Channel" htmlFor="cm-channel" required>
              <Segmented
                label="Channel"
                value={channel}
                onChange={setChannel}
                options={[
                  { value: 'SMS', label: 'SMS (coming soon)', disabled: true },
                  { value: 'EMAIL', label: 'Email' },
                  { value: 'APP', label: 'In-app' },
                ]}
              />
            </Field>
            {channel === 'SMS' && (
              <Callout tone="info">
                {body.length} characters — {smsSegments} SMS segment{smsSegments === 1 ? '' : 's'}{' '}
                per recipient. Your provider charges per segment.
              </Callout>
            )}
          </>
        ) : (
          <>
            <Checkbox
              checked={pin}
              onChange={setPin}
              label="Pin to the top"
              description="Replaces whatever is currently pinned"
            />
            <Checkbox
              checked={notify}
              onChange={setNotify}
              label="Send a push notification"
              description="Everyone in the community receives it"
            />
          </>
        )}
      </div>
    </Modal>
  );
}
