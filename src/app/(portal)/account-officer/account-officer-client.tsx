'use client';

/**
 * The community's named platform contact — the `dedicated_support` plan
 * feature made tangible. One card saying who answers for this community, and
 * the conversation with them, in the same two-sided thread shape welfare
 * requests use.
 */

import { useRef, useState } from 'react';
import Link from 'next/link';
import { Headset, Paperclip, Send, X } from 'lucide-react';
import { useSession } from '@/components/providers/session-provider';
import { useQuery } from '@/hooks/use-query';
import { useRealtimeEvent } from '@/hooks/use-realtime';
import { portalApi } from '@/services/portal';
import { Avatar, Button, Callout, Card, CardHeader, EmptyState, PageHeader, Skeleton } from '@/components/ui';
import { ChatThread } from '@/components/chat-thread';
import { uploadFile, type UploadedFile } from '@/lib/upload';
import { date, fileSize } from '@/lib/format';
import type { AccountOfficerCard, AccountOfficerMessage } from '@/types';

export function AccountOfficerClient({ initial }: { initial: AccountOfficerCard | null }) {
  const { community } = useSession();
  const communityId = community?.id ?? '';

  const { data: card } = useQuery<AccountOfficerCard | null>(
    () => (communityId ? portalApi.accountOfficer(communityId) : Promise.resolve(null)),
    [communityId],
    { initial, enabled: Boolean(communityId) },
  );

  const enabled = Boolean(card?.enabled);
  const {
    data: thread,
    loading: threadLoading,
    setData: setThread,
    refresh: refreshThread,
  } = useQuery<{ messages: AccountOfficerMessage[] } | null>(
    () => (communityId && enabled ? portalApi.accountOfficerThread(communityId) : Promise.resolve(null)),
    [communityId, enabled],
    { enabled: Boolean(communityId) && enabled },
  );

  /**
   * The officer replied — pull the thread again.
   *
   * Refetched rather than appended from the socket: the event carries no
   * message body on purpose, so what arrives on screen has been through the
   * same authorization as every other read.
   */
  useRealtimeEvent(
    'account-officer.message',
    (payload) => {
      if (!payload.communityId || payload.communityId === communityId) void refreshThread();
    },
    Boolean(communityId) && enabled,
  );

  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  /** Uploaded and waiting to be sent with the next message. */
  const [pending, setPending] = useState<UploadedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const filePicker = useRef<HTMLInputElement>(null);

  async function attach(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    setError('');
    try {
      const uploaded = await Promise.all(
        Array.from(files).slice(0, 5).map((file) => uploadFile(file, 'account-officer')),
      );
      setPending((current) => [...current, ...uploaded].slice(0, 5));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not attach that file');
    } finally {
      setUploading(false);
      if (filePicker.current) filePicker.current.value = '';
    }
  }

  async function send() {
    const text = draft.trim();
    // Files alone are a message: "here is the statement" is the file.
    if ((!text && pending.length === 0) || !communityId) return;
    setSending(true);
    setError('');
    try {
      const message = await portalApi.accountOfficerReply(communityId, text, pending);
      setThread({ messages: [...(thread?.messages ?? []), message] });
      setDraft('');
      setPending([]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not send the message');
    } finally {
      setSending(false);
    }
  }

  if (card && !card.enabled) {
    // The plan answer, said plainly. Not an error state: the page is
    // reachable by URL even when the nav item is hidden.
    return (
      <div>
        <PageHeader title="Account officer" subtitle="A named contact at Rendi, rather than the shared support queue" />
        <Callout tone="info" title="Not part of the current plan">
          Dedicated support — a named account officer who knows this community — comes with plans
          that include the feature. See{' '}
          <Link href="/billing" className="font-semibold text-blue-600 hover:underline">
            Billing &amp; plan
          </Link>{' '}
          for what each plan carries.
        </Callout>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Account officer"
        subtitle="Your named contact at Rendi — questions here go to a person who knows this community"
      />

      <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
        <Card className="self-start">
          <CardHeader title="Your contact" />
          <div className="px-5 py-4">
            {!card ? (
              <Skeleton className="h-16" />
            ) : card.officer ? (
              <div className="flex items-start gap-3">
                <Avatar name={card.officer.name} src={card.officer.avatarUrl ?? undefined} />
                <div className="min-w-0">
                  <p className="font-semibold text-navy-900">{card.officer.name}</p>
                  <p className="truncate text-sm text-slate-600">{card.officer.email}</p>
                  <p className="mt-1 text-xs text-slate-500">Covering this community since {date(card.officer.since)}</p>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-50">
                  <Headset className="h-5 w-5 text-blue-600" />
                </span>
                <p className="text-sm leading-relaxed text-slate-600">
                  An officer is being assigned. You can already write below — your messages reach the
                  Rendi team and your officer inherits the whole thread.
                </p>
              </div>
            )}
          </div>
        </Card>

        <Card className="flex min-h-[460px] flex-col">
          <CardHeader
            title="Conversation"
            subtitle="Everyone with access to this portal sees and can write in this thread"
          />
          {threadLoading && !thread ? (
            <div className="flex-1 px-5 py-4">
              <Skeleton className="h-24" />
            </div>
          ) : (
            <ChatThread
              className="bg-slate-50/60"
              messages={(thread?.messages ?? []).map((message) => ({
                id: message.id,
                text: message.text,
                at: message.at,
                // This community's own officers write on the right; Rendi
                // answers on the left.
                mine: !message.fromOfficer,
                // The API already decides what the community may see: their
                // named officer, or plain "Rendi". Appending the suffix
                // unconditionally produced "Rendi · Rendi".
                author:
                  message.fromOfficer && message.author !== 'Rendi'
                    ? `${message.author} · Rendi`
                    : message.author,
                attachments: message.attachments,
              }))}
              emptyState={
                <EmptyState
                  compact
                  icon={<Headset className="h-6 w-6" />}
                  title="No messages yet"
                  body="Ask anything — onboarding, reconciliation, a feature you can't find. This thread goes to a person, not a queue."
                />
              }
            />
          )}

          {error && <p className="px-5 text-sm text-red-600">{error}</p>}

          <div className="border-t border-slate-100 px-5 py-4">
            {/* Uploaded, shown, and removable before anything is sent — the
                alternative is discovering the wrong file only after it has
                reached the other side. */}
            {pending.length > 0 && (
              <ul className="mb-2.5 flex flex-wrap gap-2">
                {pending.map((file) => (
                  <li
                    key={file.fileUrl}
                    className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-2.5 pr-1.5 text-xs"
                  >
                    <span className="max-w-[180px] truncate font-medium text-navy-900">
                      {file.fileName}
                    </span>
                    <span className="text-slate-400">{fileSize(file.sizeBytes)}</span>
                    <button
                      type="button"
                      onClick={() => setPending((c) => c.filter((f) => f.fileUrl !== file.fileUrl))}
                      aria-label={`Remove ${file.fileName}`}
                      className="rounded p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <form
              onSubmit={(event) => {
                event.preventDefault();
                void send();
              }}
              className="flex items-end gap-2"
            >
              <input
                ref={filePicker}
                type="file"
                multiple
                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt"
                className="hidden"
                onChange={(event) => void attach(event.target.files)}
              />
              <Button
                type="button"
                variant="secondary"
                aria-label="Attach a file"
                loading={uploading}
                disabled={pending.length >= 5}
                onClick={() => filePicker.current?.click()}
              >
                <Paperclip className="h-4 w-4" aria-hidden />
              </Button>
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                rows={2}
                maxLength={2000}
                placeholder="Write to your account officer…"
                className="min-h-[44px] flex-1 resize-none rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
              <Button type="submit" disabled={sending || (!draft.trim() && pending.length === 0)}>
                <Send className="h-4 w-4" aria-hidden />
                Send
              </Button>
            </form>
          </div>
        </Card>
      </div>
    </div>
  );
}
