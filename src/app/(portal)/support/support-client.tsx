'use client';

/**
 * Rendi's help desk, as a community sees it.
 *
 * Every community gets this, on every plan. The account officer is a
 * different thing and deliberately a different screen: a named person some
 * plans buy, versus the queue that always answers. Conflating them would
 * make the paid feature look like the free one, or the free one look absent.
 *
 * A ticket raised here belongs to the community rather than to whoever
 * opened it, so the treasurer can pick up what the secretary reported.
 */

import { useRef, useState } from 'react';
import { LifeBuoy, Paperclip, Plus, Send, X } from 'lucide-react';
import { useSession } from '@/components/providers/session-provider';
import { useQuery } from '@/hooks/use-query';
import { portalApi } from '@/services/portal';
import {
  Badge,
  Button,
  Callout,
  Card,
  EmptyState,
  Field,
  Input,
  Modal,
  PageHeader,
  Segmented,
  Select,
  Skeleton,
  Textarea,
} from '@/components/ui';
import { ChatThread } from '@/components/chat-thread';
import { uploadFile, type UploadedFile } from '@/lib/upload';
import { cn, date, fileSize, relative } from '@/lib/format';
import type {
  SupportCategory,
  SupportTicketDetail,
  SupportTicketStatus,
  SupportTicketSummary,
} from '@/types';

/** What each state means to the person waiting, not to the desk. */
const STATUS_TONE: Record<SupportTicketStatus, 'amber' | 'blue' | 'green' | 'slate'> = {
  SUBMITTED: 'amber',
  UNDER_REVIEW: 'blue',
  WAITING_FOR_INFO: 'amber',
  RESOLVED: 'green',
  CLOSED: 'slate',
};

const STATUS_LABEL: Record<SupportTicketStatus, string> = {
  SUBMITTED: 'Submitted',
  UNDER_REVIEW: 'Rendi is on it',
  WAITING_FOR_INFO: 'Waiting on you',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
};

export function SupportClient() {
  const { community } = useSession();
  const communityId = community?.id ?? '';

  const [scope, setScope] = useState<'open' | 'all'>('open');
  const [openRef, setOpenRef] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);

  const {
    data: tickets,
    loading,
    refresh: refreshList,
  } = useQuery<SupportTicketSummary[] | null>(
    () => (communityId ? portalApi.supportTickets(communityId, scope) : Promise.resolve(null)),
    [communityId, scope],
    { enabled: Boolean(communityId) },
  );

  const {
    data: ticket,
    loading: ticketLoading,
    setData: setTicket,
  } = useQuery<SupportTicketDetail | null>(
    () => (openRef ? portalApi.supportTicket(openRef) : Promise.resolve(null)),
    [openRef],
    { enabled: Boolean(openRef) },
  );

  const rows = tickets ?? [];

  return (
    <div className="flex h-[calc(100dvh-7rem)] min-h-0 flex-col overflow-hidden lg:h-[calc(100dvh-8rem)]">
      <PageHeader
        title="Support"
        subtitle="Rendi's help desk — open to this community on any plan"
        actions={
          <Button onClick={() => setComposing(true)}>
            <Plus className="h-4 w-4" />
            New request
          </Button>
        }
      />

      {/* Below lg there is not room for a list and a conversation at once, and
          stacking them in a fixed-height frame leaves each too short to use.
          One at a time, as a mail client narrows. */}
      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[320px_1fr]">
        <Card
          className={cn(
            'min-h-0 flex-col overflow-hidden p-0',
            openRef ? 'hidden lg:flex' : 'flex',
          )}
        >
          <div className="border-b border-slate-100 p-3">
            <Segmented
              label="Which requests"
              size="sm"
              value={scope}
              onChange={setScope}
              options={[
                { value: 'open', label: 'Open' },
                { value: 'all', label: 'All' },
              ]}
            />
          </div>

          <ul className="min-h-0 flex-1 overflow-y-auto">
            {loading && rows.length === 0 && (
              <li className="space-y-2 p-3">
                <Skeleton className="h-14" />
                <Skeleton className="h-14" />
              </li>
            )}

            {rows.map((row) => (
              <li key={row.reference}>
                <button
                  onClick={() => setOpenRef(row.reference)}
                  className={cn(
                    'w-full border-b border-slate-50 px-3 py-3 text-left transition-colors',
                    openRef === row.reference ? 'bg-brand-50/70' : 'hover:bg-slate-50',
                  )}
                >
                  <span className="flex items-start justify-between gap-2">
                    <span className="truncate text-[13px] font-semibold text-navy-900">
                      {row.subject}
                    </span>
                    <span className="shrink-0 text-[10px] tabular-nums text-slate-400">
                      {relative(row.lastActivityAt)}
                    </span>
                  </span>
                  <span className="mt-1 flex items-center gap-1.5">
                    <Badge tone={STATUS_TONE[row.status]}>{STATUS_LABEL[row.status]}</Badge>
                    <span className="truncate text-[11px] text-slate-500">
                      {row.categoryLabel ?? row.category}
                    </span>
                  </span>
                </button>
              </li>
            ))}

            {!loading && rows.length === 0 && (
              <li className="p-6">
                <EmptyState
                  compact
                  icon={<LifeBuoy className="h-6 w-6" />}
                  title={scope === 'open' ? 'Nothing open' : 'No requests yet'}
                  body="Raise one and Rendi's desk picks it up. Anyone who runs this community can follow the reply."
                />
              </li>
            )}
          </ul>
        </Card>

        <Card
          className={cn(
            'min-h-0 flex-col overflow-hidden bg-slate-50/60 p-0',
            openRef ? 'flex' : 'hidden lg:flex',
          )}
        >
          {!openRef ? (
            <div className="m-auto max-w-sm p-8">
              <EmptyState
                icon={<LifeBuoy className="h-7 w-7" />}
                title="Pick a request to read it"
                body="Replies from Rendi appear here. Every officer of this community sees the same thread."
              />
            </div>
          ) : ticketLoading && !ticket ? (
            <div className="space-y-3 p-5">
              <Skeleton className="h-6 w-2/3" />
              <Skeleton className="h-24" />
            </div>
          ) : ticket ? (
            <TicketThread
              ticket={ticket}
              onBack={() => setOpenRef(null)}
              onChanged={(next) => {
                setTicket(next);
                void refreshList();
              }}
            />
          ) : null}
        </Card>
      </div>

      {composing && (
        <NewRequest
          communityId={communityId}
          onClose={() => setComposing(false)}
          onRaised={(created) => {
            setComposing(false);
            setOpenRef(created.reference);
            void refreshList();
          }}
        />
      )}
    </div>
  );
}

/** One conversation, with the reply box a closed ticket does not get. */
function TicketThread({
  ticket,
  onBack,
  onChanged,
}: {
  ticket: SupportTicketDetail;
  onBack: () => void;
  onChanged: (next: SupportTicketDetail) => void;
}) {
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [pending, setPending] = useState<UploadedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const filePicker = useRef<HTMLInputElement>(null);

  async function attach(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    setError('');
    try {
      const uploaded = await Promise.all(
        Array.from(files).slice(0, 5).map((file) => uploadFile(file, 'support-tickets')),
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
    const body = draft.trim();
    // A file on its own is a message: "here is the statement" is the file.
    if (!body && pending.length === 0) return;
    setSending(true);
    setError('');
    try {
      onChanged(await portalApi.replyToSupportTicket(ticket.reference, body, pending));
      setDraft('');
      setPending([]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not send that reply');
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <header className="flex items-start gap-3 border-b border-slate-100 bg-white px-3 py-2.5 sm:px-4">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to requests"
          className="-ml-1 shrink-0 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 lg:hidden"
        >
          ‹
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-navy-900">{ticket.subject}</p>
          <p className="truncate text-[11px] text-slate-500">
            {ticket.reference} · {ticket.categoryLabel ?? ticket.category} · raised{' '}
            {date(ticket.createdAt)}
            {ticket.assignedAgentName && <> · with {ticket.assignedAgentName}</>}
          </p>
        </div>
        <Badge tone={STATUS_TONE[ticket.status]}>{STATUS_LABEL[ticket.status]}</Badge>
      </header>

      <ChatThread
        messages={ticket.messages.map((message) => ({
          id: message.id,
          text: message.body,
          at: message.createdAt,
          // This community wrote it on the right; Rendi answers on the left.
          mine: message.authorType === 'USER',
          author: message.authorType === 'USER' ? message.authorName : 'Rendi support',
          attachments: message.attachments,
        }))}
        emptyState={
          <p className="text-center text-sm text-slate-500">
            Rendi has not replied yet. You will see the answer here.
          </p>
        }
      />

      {ticket.canReply ? (
        <div className="border-t border-slate-100 bg-white p-2.5">
          {error && (
            <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
          )}

          {pending.length > 0 && (
            <ul className="mb-2 flex flex-wrap gap-2">
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
              <Paperclip className="h-4 w-4" />
            </Button>
            <Textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              rows={2}
              placeholder="Reply to Rendi…"
              className="max-h-32 flex-1 resize-none"
            />
            <Button type="submit" loading={sending} disabled={!draft.trim() && pending.length === 0}>
              <Send className="h-4 w-4" />
              Send
            </Button>
          </form>
        </div>
      ) : (
        <div className="border-t border-slate-100 bg-white px-4 py-3">
          <p className="text-xs text-slate-500">
            This request is closed. Raise a new one if it needs picking up again.
          </p>
        </div>
      )}
    </>
  );
}

/** Raising one. The category list comes from the API so it cannot drift. */
function NewRequest({
  communityId,
  onClose,
  onRaised,
}: {
  communityId: string;
  onClose: () => void;
  onRaised: (ticket: SupportTicketDetail) => void;
}) {
  const { data: categories } = useQuery<SupportCategory[] | null>(
    () => portalApi.supportCategories(),
    [],
  );

  const [category, setCategory] = useState('');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'NORMAL' | 'HIGH' | 'URGENT'>('NORMAL');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const ready = category && subject.trim().length > 2 && description.trim().length > 9;

  async function submit() {
    if (!ready || !communityId) return;
    setBusy(true);
    setError('');
    try {
      onRaised(
        await portalApi.raiseSupportTicket(communityId, {
          category,
          subject: subject.trim(),
          description: description.trim(),
          priority,
        }),
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not raise that request');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="New support request"
      description="Raised for this community, so any of its officers can follow the reply."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} loading={busy} disabled={!ready}>
            Send to Rendi
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && <Callout tone="danger">{error}</Callout>}

        <Field label="What is it about" required>
          <Select value={category} onChange={(event) => setCategory(event.target.value)}>
            <option value="">Choose a subject…</option>
            {(categories ?? []).map((option) => (
              <option key={option.code} value={option.code}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Summary" required hint="One line the desk can triage from">
          <Input
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            placeholder="Ajo payout for cycle 4 has not landed"
            maxLength={120}
          />
        </Field>

        <Field
          label="What happened"
          required
          hint="Dates, amounts and references get it answered faster"
        >
          <Textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={5}
            placeholder="On 14 Nov the payout of ₦250,000 to Adaeze showed as sent, but the member says nothing arrived…"
          />
        </Field>

        <Field label="How urgent" hint="Urgent is for money or access that is stuck right now">
          <Segmented
            label="Priority"
            value={priority}
            onChange={setPriority}
            options={[
              { value: 'NORMAL', label: 'Normal' },
              { value: 'HIGH', label: 'High' },
              { value: 'URGENT', label: 'Urgent' },
            ]}
          />
        </Field>
      </div>
    </Modal>
  );
}
