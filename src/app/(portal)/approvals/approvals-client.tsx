'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import type { Route } from 'next';
import {
  Check,
  CheckCircle2,
  CornerUpLeft,
  MessageSquare,
  PlayCircle,
  ShieldCheck,
  X,
} from 'lucide-react';
import {
  Badge,
  Button,
  Callout,
  Card,
  DataTable,
  Drawer,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Spinner,
  Tabs,
  Textarea,
} from '@/components/ui';
import { useMutation, useQuery } from '@/hooks/use-query';
import { useCommunityId } from '@/components/providers/session-provider';
import { useToast } from '@/components/providers/toast-provider';
import { portalApi } from '@/services/portal';
import { date as formatDate, money as formatMoney } from '@/lib/format';
import type {
  ApprovalBucket,
  ApprovalDecisionKind,
  ApprovalRow,
  ApprovalStage,
} from '@/types';

const BUCKETS: { value: ApprovalBucket; label: string; countKey?: 'awaitingMe' | 'awaitingOthers' | 'readyToExecute' | 'returned' }[] = [
  { value: 'AWAITING_ME', label: 'Awaiting my decision', countKey: 'awaitingMe' },
  { value: 'AWAITING_OTHERS', label: 'With other officers', countKey: 'awaitingOthers' },
  { value: 'READY_TO_EXECUTE', label: 'Ready to carry out', countKey: 'readyToExecute' },
  { value: 'RETURNED', label: 'Returned to me', countKey: 'returned' },
  { value: 'DECLINED', label: 'Declined' },
  { value: 'HISTORY', label: 'History' },
];

const STATUS_TONE: Record<string, 'green' | 'amber' | 'red' | 'slate' | 'blue'> = {
  PENDING: 'amber',
  APPROVED: 'blue',
  EXECUTED: 'green',
  EXECUTION_FAILED: 'red',
  DECLINED: 'red',
  RETURNED: 'amber',
  CANCELLED: 'slate',
  EXPIRED: 'slate',
};

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'In progress',
  APPROVED: 'Approved — not yet carried out',
  EXECUTED: 'Done',
  EXECUTION_FAILED: 'Could not be carried out',
  DECLINED: 'Declined',
  RETURNED: 'Returned for correction',
  CANCELLED: 'Withdrawn',
  EXPIRED: 'Expired',
};

/**
 * One officer's approval desk.
 *
 * Every sensitive operation in the platform arrives here, whichever module
 * raised it — a loan, a withdrawal, a change to the settlement account. The
 * officer works one list rather than hunting through six screens for things
 * waiting on them.
 */
export function ApprovalsClient() {
  const communityId = useCommunityId();
  const params = useSearchParams();
  const { toast } = useToast();

  const [bucket, setBucket] = useState<ApprovalBucket>('AWAITING_ME');
  /**
   * Which request is open. The URL is the source of truth so a notification
   * can deep-link straight to one; `override` is what the officer has done
   * since — opening another row, or closing the drawer — and it wins until
   * the URL itself changes.
   */
  const [override, setOverride] = useState<{ for: string | null; id: string | null } | null>(null);
  const linked = params.get('requestId');
  const openId = override && override.for === linked ? override.id : linked;
  const setOpenId = (id: string | null) => setOverride({ for: linked, id });

  const counts = useQuery(() => portalApi.approvalCounts(communityId), [communityId]);
  const queue = useQuery(() => portalApi.approvals(communityId, bucket), [communityId, bucket]);

  const refreshAll = async () => {
    await Promise.all([queue.refresh(), counts.refresh()]);
  };

  const rows = queue.data ?? [];

  return (
    <>
      <PageHeader
        title="Approvals"
        subtitle="Decisions your community has put in more than one officer's hands. Nothing here goes through until every stage it needs has approved it."
        actions={
          <Link href={'/approvals/settings' as Route}>
            <Button variant="secondary" icon={<ShieldCheck className="h-4 w-4" />}>
              Approval settings
            </Button>
          </Link>
        }
      />

      {counts.data && counts.data.readyToExecute > 0 && bucket !== 'READY_TO_EXECUTE' && (
        <Callout tone="info" className="mb-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>
              {counts.data.readyToExecute} fully approved{' '}
              {counts.data.readyToExecute === 1 ? 'decision is' : 'decisions are'} waiting to be
              carried out.
            </span>
            <Button size="sm" variant="secondary" onClick={() => setBucket('READY_TO_EXECUTE')}>
              Show them
            </Button>
          </div>
        </Callout>
      )}

      <Tabs
        value={bucket}
        onChange={setBucket}
        tabs={BUCKETS.map((b) => ({
          value: b.value,
          label: b.label,
          count: b.countKey ? counts.data?.[b.countKey] : undefined,
        }))}
        className="mb-5"
      />

      <Card>
        <DataTable
          rows={rows}
          loading={queue.loading}
          rowKey={(r) => r.id}
          onRowClick={(r) => setOpenId(r.id)}
          columns={[
            {
              key: 'what',
              header: 'Decision',
              cell: (r: ApprovalRow) => (
                <div className="min-w-0">
                  <p className="truncate font-semibold text-navy-900">{r.title}</p>
                  <p className="truncate text-xs text-slate-500">
                    {r.operationLabel} · {r.reference}
                    {r.member ? ` · ${r.member}` : ''}
                  </p>
                </div>
              ),
            },
            {
              key: 'amount',
              header: 'Amount',
              cell: (r: ApprovalRow) =>
                r.amount ? (
                  <span className="font-semibold text-navy-900">
                    {formatMoney(r.amount, r.currencyCode ?? 'NGN')}
                  </span>
                ) : (
                  <span className="text-slate-400">—</span>
                ),
            },
            {
              key: 'stage',
              header: 'Progress',
              hideOnMobile: true,
              cell: (r: ApprovalRow) => <StageTrack row={r} />,
            },
            {
              key: 'raised',
              header: 'Raised',
              hideOnMobile: true,
              cell: (r: ApprovalRow) => (
                <div className="text-xs text-slate-500">
                  <div>{formatDate(r.requestedAt)}</div>
                  <div className="truncate">by {r.requestedBy}</div>
                </div>
              ),
            },
            {
              key: 'status',
              header: 'Status',
              cell: (r: ApprovalRow) => (
                <div className="flex flex-col items-start gap-1">
                  <Badge tone={STATUS_TONE[r.status] ?? 'slate'}>
                    {STATUS_LABEL[r.status] ?? r.status}
                  </Badge>
                  {r.awaitingMe && <Badge tone="amber">Your decision</Badge>}
                </div>
              ),
            },
          ]}
          empty={
            <EmptyState
              icon={<CheckCircle2 className="h-5 w-5" />}
              title={
                bucket === 'AWAITING_ME'
                  ? 'Nothing is waiting on you'
                  : 'Nothing here yet'
              }
              body={
                bucket === 'AWAITING_ME'
                  ? 'When a decision reaches your stage of the workflow, it appears here and you are notified.'
                  : 'Decisions appear here as your officers work through them.'
              }
            />
          }
        />
      </Card>

      {openId && (
        <ApprovalDrawer
          communityId={communityId}
          requestId={openId}
          onClose={() => setOpenId(null)}
          onChanged={refreshAll}
          toast={toast}
        />
      )}
    </>
  );
}

/** A compact read of how far through the stages a request is. */
function StageTrack({ row }: { row: ApprovalRow }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-1">
        {Array.from({ length: row.stageCount }).map((_, index) => (
          <span
            key={index}
            className={`h-1.5 w-6 rounded-full ${
              index < row.approvalCount ? 'bg-emerald-500' : 'bg-slate-200'
            }`}
          />
        ))}
      </div>
      <span className="text-xs text-slate-500">
        {row.currentStage?.role
          ? `with ${row.currentStage.role}`
          : `${row.approvalCount}/${row.requiredApprovals}`}
      </span>
    </div>
  );
}

/**
 * One request in full: what is being decided, every verdict so far, and the
 * actions open to this officer.
 */
function ApprovalDrawer({
  communityId,
  requestId,
  onClose,
  onChanged,
  toast,
}: {
  communityId: string;
  requestId: string;
  onClose: () => void;
  onChanged: () => Promise<void>;
  toast: ReturnType<typeof useToast>['toast'];
}) {
  const detail = useQuery(() => portalApi.approval(communityId, requestId), [communityId, requestId]);
  const [comment, setComment] = useState('');
  const [pin, setPin] = useState('');
  const [intent, setIntent] = useState<ApprovalDecisionKind | null>(null);

  const decide = useMutation(
    (decision: ApprovalDecisionKind) =>
      portalApi.decideApproval(communityId, requestId, {
        decision,
        comment: comment.trim() || undefined,
        pin: pin || undefined,
      }),
    {
      onSuccess: async () => {
        toast('Decision recorded', 'success');
        setComment('');
        setPin('');
        setIntent(null);
        await Promise.all([detail.refresh(), onChanged()]);
      },
      onError: (message) => toast('Could not record that decision', 'error', message),
    },
  );

  const execute = useMutation(() => portalApi.executeApproval(communityId, requestId, pin), {
    onSuccess: async () => {
      toast('Carried out', 'success');
      setPin('');
      await Promise.all([detail.refresh(), onChanged()]);
    },
    onError: (message) => toast('Could not carry it out', 'error', message),
  });

  const cancel = useMutation(
    () => portalApi.cancelApproval(communityId, requestId, comment.trim() || 'Withdrawn'),
    {
      onSuccess: async () => {
        toast('Withdrawn', 'success');
        await Promise.all([detail.refresh(), onChanged()]);
      },
      onError: (message) => toast('Could not withdraw it', 'error', message),
    },
  );

  const request = detail.data;
  const busy = decide.pending || execute.pending || cancel.pending;
  // Declining and returning both have to say why — the requester acts on it.
  const needsComment = intent === 'DECLINED' || intent === 'RETURNED' || intent === 'INFO_REQUESTED';

  return (
    <Drawer
      open
      onClose={onClose}
      width="max-w-3xl"
      title={request ? request.title : 'Loading…'}
      subtitle={
        request
          ? `${request.operationLabel} · ${request.reference} · raised by ${request.requestedBy}`
          : undefined
      }
      footer={
        request?.myActions.canDecide ? (
          <div className="flex w-full flex-wrap gap-2">
            <Button
              variant="secondary"
              icon={<MessageSquare className="h-4 w-4" />}
              disabled={busy}
              onClick={() => setIntent('INFO_REQUESTED')}
            >
              Ask for more
            </Button>
            <Button
              variant="secondary"
              icon={<CornerUpLeft className="h-4 w-4" />}
              disabled={busy}
              onClick={() => setIntent('RETURNED')}
            >
              Return
            </Button>
            <Button
              variant="danger"
              icon={<X className="h-4 w-4" />}
              disabled={busy}
              onClick={() => setIntent('DECLINED')}
            >
              Decline
            </Button>
            <Button
              className="ml-auto"
              icon={<Check className="h-4 w-4" />}
              disabled={busy}
              onClick={() => setIntent('APPROVED')}
            >
              {request.myActions.isFinalAuthority ? 'Give final approval' : 'Approve'}
            </Button>
          </div>
        ) : (
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        )
      }
    >
      {detail.loading && !request ? (
        <div className="py-10 text-center">
          <Spinner />
        </div>
      ) : !request ? (
        <Callout tone="danger">{detail.error ?? 'That request could not be loaded.'}</Callout>
      ) : (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={STATUS_TONE[request.status] ?? 'slate'}>
              {STATUS_LABEL[request.status] ?? request.status}
            </Badge>
            {request.movesMoney && <Badge tone="amber">Moves money</Badge>}
            {request.mode === 'PARALLEL' && <Badge tone="slate">All stages at once</Badge>}
            <span className="text-xs text-slate-500">
              {request.approvalCount} of {request.requiredApprovals} approvals
            </span>
          </div>

          {request.amount && (
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-[11px] font-semibold tracking-wide text-slate-500">AMOUNT</p>
              <p className="text-2xl font-bold text-navy-900">
                {formatMoney(request.amount, request.currencyCode ?? 'NGN')}
              </p>
            </div>
          )}

          <section>
            <h3 className="mb-1 text-sm font-semibold text-navy-900">What is being decided</h3>
            <p className="text-sm leading-relaxed text-slate-600">{request.summary}</p>
          </section>

          {Object.keys(request.payload ?? {}).length > 0 && (
            <section>
              <h3 className="mb-2 text-sm font-semibold text-navy-900">Details</h3>
              <dl className="overflow-hidden rounded-xl border border-slate-200">
                {Object.entries(request.payload).map(([key, value], index) => (
                  <div
                    key={key}
                    className={`flex justify-between gap-4 px-3 py-2 text-sm ${
                      index % 2 ? '' : 'bg-slate-50'
                    }`}
                  >
                    <dt className="text-slate-500">{humaniseKey(key)}</dt>
                    <dd className="text-right font-medium text-navy-900">
                      {value === null || value === undefined ? '—' : String(value)}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          {request.executionError && (
            <Callout tone="danger" title="This could not be carried out">
              {request.executionError}
            </Callout>
          )}

          {request.myActions.blockedBySelfApproval && (
            <Callout tone="warning" title="You raised this">
              Your community&apos;s policy does not let an officer approve their own request, so
              this one needs a colleague.
            </Callout>
          )}

          <section>
            <h3 className="mb-2 text-sm font-semibold text-navy-900">Approval trail</h3>
            <ol className="space-y-3">
              {request.stages.map((stage) => (
                <StageRow key={stage.id} stage={stage} />
              ))}
            </ol>
          </section>

          {request.messages.length > 0 && (
            <section>
              <h3 className="mb-2 text-sm font-semibold text-navy-900">Comments</h3>
              <div className="space-y-2">
                {request.messages.map((m) => (
                  <div key={m.id} className="rounded-xl border border-slate-200 p-3">
                    <p className="text-sm text-slate-700">{m.text}</p>
                    <p className="mt-1 text-xs text-slate-400">
                      {m.by} · {formatDate(m.at, 'datetime')}
                      {m.internal ? ' · internal note' : ''}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ── Acting on it ──────────────────────────────────────────── */}
          {intent && (
            <section className="rounded-xl border border-blue-200 bg-blue-50/50 p-4">
              <h3 className="mb-3 text-sm font-semibold text-navy-900">
                {intent === 'APPROVED'
                  ? request.myActions.isFinalAuthority
                    ? 'Give the final authorisation'
                    : 'Approve this stage'
                  : intent === 'DECLINED'
                    ? 'Decline this request'
                    : intent === 'RETURNED'
                      ? 'Return it for correction'
                      : 'Ask the requester for more'}
              </h3>
              <Field
                label={needsComment ? 'Reason' : 'Comment'}
                htmlFor="ap-comment"
                required={needsComment}
                hint={
                  needsComment
                    ? 'The requester sees this and acts on it.'
                    : 'Optional — recorded on the trail either way.'
                }
              >
                <Textarea
                  id="ap-comment"
                  rows={3}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                />
              </Field>
              {intent !== 'INFO_REQUESTED' && (
                <Field
                  label="Your transaction PIN"
                  htmlFor="ap-pin"
                  required
                  hint="A decision has to be your own act, so it is confirmed with your PIN."
                  className="mt-3"
                >
                  <Input
                    id="ap-pin"
                    type="password"
                    inputMode="numeric"
                    autoComplete="off"
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                  />
                </Field>
              )}
              <div className="mt-4 flex gap-2">
                <Button variant="secondary" onClick={() => setIntent(null)} disabled={busy}>
                  Cancel
                </Button>
                <Button
                  loading={decide.pending}
                  disabled={
                    busy ||
                    (needsComment && !comment.trim()) ||
                    (intent !== 'INFO_REQUESTED' && !pin)
                  }
                  onClick={() => void decide.run(intent)}
                >
                  Confirm
                </Button>
              </div>
            </section>
          )}

          {(request.status === 'APPROVED' || request.status === 'EXECUTION_FAILED') && (
            <section className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
              <h3 className="text-sm font-semibold text-navy-900">
                Approved — ready to be carried out
              </h3>
              <p className="mt-1 text-sm text-slate-600">
                Every stage has approved this. Operations the platform can complete itself are
                done here; a payout still needs the owner&apos;s code, so open the module and
                finish it there — it will go through now.
              </p>
              <div className="mt-3 flex flex-wrap items-end gap-2">
                <Field label="Your transaction PIN" htmlFor="ap-exec-pin" className="w-48">
                  <Input
                    id="ap-exec-pin"
                    type="password"
                    inputMode="numeric"
                    autoComplete="off"
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                  />
                </Field>
                <Button
                  icon={<PlayCircle className="h-4 w-4" />}
                  loading={execute.pending}
                  disabled={busy || !pin}
                  onClick={() => void execute.run()}
                >
                  {request.status === 'EXECUTION_FAILED' ? 'Try again' : 'Carry it out'}
                </Button>
              </div>
            </section>
          )}

          {request.myActions.canCancel && !intent && (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3">
              <p className="text-sm text-slate-600">
                Withdraw this request if it was raised in error.
              </p>
              <Button
                variant="secondary"
                size="sm"
                loading={cancel.pending}
                disabled={busy}
                onClick={() => void cancel.run()}
              >
                Withdraw
              </Button>
            </div>
          )}
        </div>
      )}
    </Drawer>
  );
}

function StageRow({ stage }: { stage: ApprovalStage }) {
  const tone =
    stage.status === 'APPROVED'
      ? 'border-emerald-200 bg-emerald-50/50'
      : stage.status === 'DECLINED'
        ? 'border-red-200 bg-red-50/50'
        : stage.status === 'PENDING'
          ? 'border-amber-200 bg-amber-50/50'
          : 'border-slate-200';

  return (
    <li className={`rounded-xl border p-3 ${tone}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-xs font-bold text-navy-900 ring-1 ring-slate-200">
            {stage.position}
          </span>
          <span className="text-sm font-semibold text-navy-900">
            {stage.role ?? 'Named officer'}
          </span>
          {stage.isFinalAuthority && <Badge tone="blue">Final authorisation</Badge>}
          {stage.isOptional && <Badge tone="slate">Optional</Badge>}
        </div>
        <span className="text-xs text-slate-500">
          {stage.status === 'PENDING'
            ? `Waiting${stage.requiredApprovals > 1 ? ` (${stage.approvalCount}/${stage.requiredApprovals})` : ''}`
            : stage.status === 'WAITING'
              ? 'Not yet reached'
              : stage.status.charAt(0) + stage.status.slice(1).toLowerCase()}
        </span>
      </div>
      {stage.instruction && (
        <p className="mt-2 text-xs italic text-slate-500">{stage.instruction}</p>
      )}
      {stage.decisions.map((d) => (
        <div key={d.id} className="mt-2 rounded-lg bg-white/70 p-2 text-sm">
          <p className="font-medium text-navy-900">
            {d.decision === 'APPROVED' ? 'Approved' : d.decision === 'DECLINED' ? 'Declined' : 'Returned'}{' '}
            by {d.by}
            {d.role ? ` (${d.role})` : ''}
          </p>
          {d.comment && <p className="mt-0.5 text-slate-600">{d.comment}</p>}
          <p className="mt-0.5 text-xs text-slate-400">
            {formatDate(d.at, 'datetime')}
            {d.selfAuthenticated === false ? ' · recorded from their own submission' : ''}
          </p>
        </div>
      ))}
    </li>
  );
}

/** `interestRate` → `Interest rate`. */
function humaniseKey(key: string) {
  const spaced = key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
}
