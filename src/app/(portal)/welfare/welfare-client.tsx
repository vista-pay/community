'use client';

import { MoneyOutOtpDialog, useMoneyOutOtp } from '@/components/money-out-otp';
import { useMemo, useState } from 'react';
import { HeartHandshake } from 'lucide-react';
import {
  Badge,
  Button,
  Callout,
  Card,
  CardHeader,
  ConfirmDialog,
  EmptyState,
  PageHeader,
  Textarea,
} from '@/components/ui';
import { useMutation, useQuery } from '@/hooks/use-query';
import { useCommunityId } from '@/components/providers/session-provider';
import { useToast } from '@/components/providers/toast-provider';
import { portalApi } from '@/services/portal';
import { date as formatDate, money as formatCurrency } from '@/lib/format';
import type { WelfareRequestDetail, WelfareRequestRow, WelfareStatus } from '@/types';

const STATUS_META: Record<WelfareStatus, { label: string; tone: 'green' | 'amber' | 'red' | 'slate' | 'navy' }> = {
  SUBMITTED: { label: 'Submitted', tone: 'navy' },
  UNDER_REVIEW: { label: 'Under review', tone: 'amber' },
  INFO_REQUESTED: { label: 'Info requested', tone: 'amber' },
  APPROVED: { label: 'Approved', tone: 'green' },
  REJECTED: { label: 'Declined', tone: 'red' },
  PAID: { label: 'Paid', tone: 'green' },
};

const TYPE_LABEL = { MEDICAL: 'Medical', BEREAVEMENT: 'Bereavement', EDUCATION: 'Education', OTHER: 'Other' } as const;

/** "Other" alone says nothing — show what the member actually asked for. */
const typeLabel = (r: { type: keyof typeof TYPE_LABEL; customType: string | null }) =>
  r.type === 'OTHER' && r.customType ? r.customType : TYPE_LABEL[r.type];

/**
 * The welfare committee's queue. A request arrives from the member's app,
 * the committee asks for evidence in the thread if it needs any, then
 * decides — and marks the request paid once the money has actually moved.
 */
export function WelfareClient({ initial }: { initial: WelfareRequestRow[] }) {
  const communityId = useCommunityId();
  const { toast } = useToast();
  const [view, setView] = useState<'open' | 'decided'>('open');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [confirming, setConfirming] = useState<'APPROVED' | 'PAID' | null>(null);

  const { data, refresh } = useQuery<WelfareRequestRow[]>(
    () => portalApi.welfareQueue(communityId),
    [communityId],
    { initial },
  );
  const requests = data ?? initial;

  const rows = useMemo(() => {
    const open = ['SUBMITTED', 'UNDER_REVIEW', 'INFO_REQUESTED', 'APPROVED'];
    return requests.filter((r) =>
      view === 'open' ? open.includes(r.status) : !open.includes(r.status),
    );
  }, [requests, view]);

  const activeId = selectedId ?? rows[0]?.id ?? null;

  const detail = useQuery<WelfareRequestDetail | null>(
    () => (activeId ? portalApi.welfareRequest(activeId) : Promise.resolve(null)),
    [activeId],
  );
  const request = detail.data;

  // Recording a decision moves no money; marking a request PAID does. The gate
  // covers both because the server decides which one needs the owner's code,
  // so a screen cannot forget to ask on the step that pays out.
  const act = useMoneyOutOtp<{ status: string; note?: string }>({
    perform: (extra, body) => portalApi.reviewWelfare(activeId!, body, extra),
    onDone: async () => {
      setConfirming(null);
      setNote('');
      await Promise.all([refresh(), detail.refresh()]);
    },
    successMessage: 'Done — the member has been notified in their request thread',
  });

  const reply = useMutation(
    () => portalApi.replyWelfare(activeId!, { text: note.trim() }),
    {
      onSuccess: async () => {
        toast('Reply sent', 'success');
        setNote('');
        await detail.refresh();
      },
      onError: (message) => toast('Could not send', 'error', message),
    },
  );

  const openCount = requests.filter((r) =>
    ['SUBMITTED', 'UNDER_REVIEW', 'INFO_REQUESTED', 'APPROVED'].includes(r.status),
  ).length;

  return (
    <>
      <PageHeader
        title="Welfare"
        subtitle={`${openCount} request${openCount === 1 ? '' : 's'} waiting · medical, bereavement and education support`}
        actions={
          <div className="flex rounded-lg border border-slate-200 bg-white p-0.5">
            {(['open', 'decided'] as const).map((v) => (
              <button
                key={v}
                onClick={() => {
                  setView(v);
                  setSelectedId(null);
                }}
                className={`rounded-md px-3 py-1.5 text-sm font-semibold ${view === v ? 'bg-navy-900 text-white' : 'text-slate-600'}`}
              >
                {v === 'open' ? `Active (${openCount})` : 'Closed'}
              </button>
            ))}
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
        {/* Queue */}
        <Card>
          <CardHeader title="Queue" subtitle="Oldest first" />
          <div className="space-y-2 px-3 py-3">
            {rows.length === 0 && (
              <p className="px-2 py-8 text-center text-sm text-slate-500">
                {view === 'open' ? 'Nothing waiting on the committee.' : 'No decided requests yet.'}
              </p>
            )}
            {rows.map((r) => (
              <button
                key={r.id}
                onClick={() => setSelectedId(r.id)}
                className={`w-full rounded-xl border p-3 text-left ${activeId === r.id ? 'border-blue-500 bg-blue-50/50' : 'border-slate-200 hover:bg-slate-50'}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-semibold text-navy-900">{r.memberName}</p>
                  <Badge tone={STATUS_META[r.status].tone}>{STATUS_META[r.status].label}</Badge>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {r.reference} · {typeLabel(r)} · {formatCurrency(r.amount)}
                </p>
                <p className="mt-0.5 text-xs text-slate-400">{formatDate(r.createdAt)}</p>
              </button>
            ))}
          </div>
        </Card>

        {/* Detail */}
        <div className="space-y-4">
          {!request ? (
            <Card>
              <EmptyState
                icon={<HeartHandshake className="h-5 w-5" />}
                title="Select a request"
                body="Pick a request from the queue to read the member's story and decide."
              />
            </Card>
          ) : (
            <>
              <Card>
                <div className="flex flex-col justify-between gap-2 px-5 py-4 sm:flex-row sm:items-center">
                  <div>
                    <h2 className="text-base font-bold text-navy-900">
                      {typeLabel(request)} support · {formatCurrency(request.amount)}
                    </h2>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {request.reference} · submitted {formatDate(request.createdAt)}
                    </p>
                  </div>
                  <Badge tone={STATUS_META[request.status].tone}>{STATUS_META[request.status].label}</Badge>
                </div>
                <div className="border-t border-slate-100 px-5 py-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    What happened
                  </p>
                  <p className="mt-1.5 text-sm leading-relaxed text-navy-900">{request.story}</p>
                </div>
              </Card>

              <WelfareProgress status={request.status} />

              <Card>
                <CardHeader title="Thread" subtitle="The member sees everything written here" />
                <div className="space-y-3 px-5 py-4">
                  {request.messages.length === 0 && (
                    <p className="text-sm text-slate-500">No messages yet.</p>
                  )}
                  {request.messages.map((m) => (
                    <div
                      key={m.id}
                      className={`rounded-xl border p-3 ${m.fromOfficer ? 'border-blue-100 bg-blue-50/40' : 'border-slate-200 bg-white'}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-navy-900">
                          {m.authorName}
                          {m.authorTitle ? ` · ${m.authorTitle}` : m.fromOfficer ? ' · Officer' : ''}
                        </p>
                        <p className="text-[11px] text-slate-400">{formatDate(m.at)}</p>
                      </div>
                      <p className="mt-1 text-sm text-navy-900">{m.text}</p>
                      {m.attachmentUrl && (
                        <a
                          href={m.attachmentUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-1.5 inline-block text-xs font-semibold text-blue-600 hover:underline"
                        >
                          View attached document
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </Card>

              {request.status === 'SUBMITTED' ? (
                <Card>
                  <CardHeader
                    title="Ready for initial review"
                    subtitle="Starting review does not approve the request or move any money"
                  />
                  <div className="flex flex-col justify-between gap-3 px-5 py-4 sm:flex-row sm:items-center">
                    <p className="max-w-2xl text-sm leading-6 text-slate-600">
                      Check the member’s story and attachments first. Once started, the member will
                      see that the committee is actively reviewing the request.
                    </p>
                    <Button
                      loading={act.pending}
                      onClick={() => void act.run({ status: 'UNDER_REVIEW' })}
                    >
                      Start review
                    </Button>
                  </div>
                </Card>
              ) : request.status === 'UNDER_REVIEW' ? (
                <Card>
                  <CardHeader
                    title="Committee action"
                    subtitle="Review the evidence, then request more information or record a decision"
                  />
                  <div className="space-y-3 px-5 py-4">
                    <Textarea
                      rows={2}
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="e.g. Please upload the hospital invoice or estimate…"
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="secondary"
                        disabled={act.pending || !note.trim()}
                        onClick={() => void reply.run()}
                      >
                        Reply only
                      </Button>
                      <Button
                        variant="secondary"
                        disabled={act.pending || !note.trim()}
                        onClick={() => void act.run({ status: 'INFO_REQUESTED', note: note.trim() })}
                      >
                        Request info
                      </Button>
                      <Button
                        variant="danger"
                        disabled={act.pending || !note.trim()}
                        onClick={() => void act.run({ status: 'REJECTED', note: note.trim() })}
                      >
                        Decline
                      </Button>
                      <Button
                        disabled={act.pending}
                        loading={act.pending}
                        onClick={() => setConfirming('APPROVED')}
                      >
                        Review & approve
                      </Button>
                    </div>
                  </div>
                </Card>
              ) : request.status === 'INFO_REQUESTED' ? (
                <Callout tone="warning">
                  Waiting for the member to provide the requested information. Their reply will
                  return this request to Under review; no money has been moved.
                </Callout>
              ) : request.status === 'APPROVED' ? (
                <Card>
                  <CardHeader
                    title="Approved — awaiting disbursement"
                    subtitle="Approval is recorded, but the community wallet has not been debited"
                  />
                  <div className="flex flex-col justify-between gap-3 px-5 py-4 sm:flex-row sm:items-center">
                    <div>
                      <p className="text-sm font-semibold text-navy-900">
                        Disbursement amount: {formatCurrency(request.amount)}
                      </p>
                      <p className="mt-1 text-[13px] leading-5 text-slate-600">
                        Confirm only when the payment is ready. This will transfer funds from the
                        community wallet to the member’s wallet and close the request.
                      </p>
                    </div>
                    <Button loading={act.pending} onClick={() => setConfirming('PAID')}>
                      Review disbursement
                    </Button>
                  </div>
                </Card>
              ) : (
                <Callout tone={request.status === 'PAID' ? 'success' : 'danger'}>
                  {request.status === 'PAID'
                    ? `Paid ${request.paidAt ? formatDate(request.paidAt) : ''}. This request is closed.`
                    : 'This request was declined and is closed.'}
                </Callout>
              )}
            </>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirming === 'APPROVED'}
        onClose={() => setConfirming(null)}
        title="Approve welfare request?"
        confirmLabel="Approve request"
        loading={act.pending}
        body={
          <div className="space-y-2">
            <p>
              You are approving <strong>{request ? formatCurrency(request.amount) : ''}</strong> for
              this request.
            </p>
            <p className="font-medium text-navy-900">
              Approval will not debit the community wallet. Disbursement remains a separate action.
            </p>
          </div>
        }
        onConfirm={() =>
          void act.run({ status: 'APPROVED', note: note.trim() || undefined })
        }
      />

      <ConfirmDialog
        open={confirming === 'PAID'}
        onClose={() => setConfirming(null)}
        title="Confirm welfare disbursement"
        confirmLabel="Disburse funds"
        loading={act.pending}
        body={
          <div className="space-y-2">
            <p>
              Transfer <strong>{request ? formatCurrency(request.amount) : ''}</strong> from the
              community wallet to the member’s wallet?
            </p>
            <p className="font-medium text-red-700">
              This is the step that moves money. It cannot be treated as a review-only action.
            </p>
          </div>
        }
        onConfirm={() => void act.run({ status: 'PAID' })}
      />
      {/* Opens only when the server asks for the owner's code. */}
      <MoneyOutOtpDialog gate={act} />
    </>
  );
}

function WelfareProgress({ status }: { status: WelfareStatus }) {
  const stage: Record<WelfareStatus, number> = {
    SUBMITTED: 0,
    UNDER_REVIEW: 1,
    INFO_REQUESTED: 1,
    APPROVED: 2,
    REJECTED: 2,
    PAID: 3,
  };
  const current = stage[status];
  const steps = ['Submitted', 'Review', 'Decision', 'Disbursement'];

  return (
    <Card>
      <div className="grid grid-cols-4 px-4 py-4 sm:px-6">
        {steps.map((label, index) => {
          const complete = index < current || status === 'PAID';
          const active = index === current && status !== 'PAID';
          return (
            <div key={label} className="relative flex flex-col items-center text-center">
              {index > 0 && (
                <span
                  className={`absolute right-1/2 top-3 h-0.5 w-full ${index <= current ? 'bg-brand-500' : 'bg-slate-200'}`}
                  aria-hidden
                />
              )}
              <span
                className={`relative z-10 flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ${
                  complete
                    ? 'bg-brand-600 text-white'
                    : active
                      ? 'border-2 border-brand-600 bg-white text-brand-700'
                      : 'border border-slate-300 bg-white text-slate-400'
                }`}
              >
                {complete ? '✓' : index + 1}
              </span>
              <span
                className={`mt-2 text-[11px] font-semibold sm:text-xs ${active || complete ? 'text-navy-900' : 'text-slate-400'}`}
              >
                {label}
              </span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
