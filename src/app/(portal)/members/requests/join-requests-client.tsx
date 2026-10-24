'use client';

import { useMemo, useState } from 'react';
import {
  BadgeCheck,
  CheckCircle2,
  Clock,
  MessageSquare,
  ShieldQuestion,
  UserCheck,
  UserPlus,
  XCircle,
} from 'lucide-react';
import {
  Avatar,
  Badge,
  Button,
  Callout,
  Card,
  ConfirmDialog,
  EmptyState,
  Modal,
  PageHeader,
  Tabs,
  Textarea,
} from '@/components/ui';
import { useQuery, useMutation } from '@/hooks/use-query';
import { useCommunityId } from '@/components/providers/session-provider';
import { useToast } from '@/components/providers/toast-provider';
import { portalApi } from '@/services/portal';
import { date, humanise, relative } from '@/lib/format';
import type { JoinRequest, JoinReviewStage } from '@/types';

/** Stable empty result: `?? []` inline defeats the memos below. */
const NONE: never[] = [];

type Filter = 'open' | JoinReviewStage;

const OPEN_STAGES: JoinReviewStage[] = ['NEW', 'IN_REVIEW', 'INFO_REQUESTED', 'AWAITING_REFEREE'];

export function JoinRequestsClient({ initial }: { initial: JoinRequest[] }) {
  const communityId = useCommunityId();
  const { toast } = useToast();
  const [filter, setFilter] = useState<Filter>('open');
  const [selected, setSelected] = useState<JoinRequest | null>(null);
  const [declining, setDeclining] = useState<JoinRequest | null>(null);

  const { data, refresh } = useQuery<JoinRequest[]>(
    () => portalApi.joinQueue(communityId),
    [communityId],
    { initial },
  );
  const requests = data ?? NONE;

  const admit = useMutation(
    (membershipId: string) =>
      portalApi.advanceJoinReview(communityId, membershipId, { stage: 'APPROVED', admit: true }),
    {
      onSuccess: () => {
        toast('Application approved', 'success', 'They are now an active member.');
        setSelected(null);
        void refresh();
      },
      onError: (message) => toast('Could not approve', 'error', message),
    },
  );

  const decline = useMutation(
    (membershipId: string, reason: string) =>
      portalApi.advanceJoinReview(communityId, membershipId, {
        stage: 'DECLINED',
        declineReason: reason,
      }),
    {
      onSuccess: () => {
        toast('Application declined', 'info');
        setDeclining(null);
        setSelected(null);
        void refresh();
      },
      onError: (message) => toast('Could not decline', 'error', message),
    },
  );

  const moveStage = useMutation(
    (membershipId: string, stage: JoinReviewStage) =>
      portalApi.advanceJoinReview(communityId, membershipId, { stage }),
    {
      onSuccess: () => void refresh(),
      onError: (message) => toast('Could not update', 'error', message),
    },
  );

  const rows = useMemo(
    () =>
      filter === 'open'
        ? requests.filter((r) => OPEN_STAGES.includes(r.review.stage))
        : requests.filter((r) => r.review.stage === filter),
    [requests, filter],
  );

  return (
    <>
      <PageHeader
        title="Join requests"
        subtitle="Applications from the Vista app and your public listing"
      />

      <Tabs
        value={filter}
        onChange={setFilter}
        className="mb-4"
        tabs={[
          {
            value: 'open',
            label: 'Open',
            count: requests.filter((r) => OPEN_STAGES.includes(r.review.stage)).length,
          },
          { value: 'NEW', label: 'New', count: requests.filter((r) => r.review.stage === 'NEW').length },
          {
            value: 'AWAITING_REFEREE',
            label: 'Awaiting referee',
            count: requests.filter((r) => r.review.stage === 'AWAITING_REFEREE').length,
          },
          {
            value: 'INFO_REQUESTED',
            label: 'Info requested',
            count: requests.filter((r) => r.review.stage === 'INFO_REQUESTED').length,
          },
        ]}
      />

      {rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={<UserPlus className="h-5 w-5" />}
            title="Nothing waiting"
            body="Applications appear here as soon as someone asks to join from the app or your listing."
          />
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {rows.map((r) => (
            <RequestCard
              key={r.membershipId}
              request={r}
              onOpen={() => setSelected(r)}
              onApprove={() => void admit.run(r.membershipId)}
              onDecline={() => setDeclining(r)}
              busy={admit.pending || decline.pending}
            />
          ))}
        </div>
      )}

      {/* Detail */}
      <Modal
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected?.name ?? ''}
        size="lg"
      >
        {selected && (
          <RequestDetail
            request={selected}
            communityId={communityId}
            onApprove={() => void admit.run(selected.membershipId)}
            onDecline={() => setDeclining(selected)}
            onStage={(stage) => void moveStage.run(selected.membershipId, stage)}
            onNoted={refresh}
            busy={admit.pending || moveStage.pending}
          />
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(declining)}
        onClose={() => setDeclining(null)}
        title="Decline this application?"
        confirmLabel="Decline"
        tone="danger"
        requireReason
        reasonLabel="Reason"
        loading={decline.pending}
        onConfirm={(reason) => declining && void decline.run(declining.membershipId, reason)}
        body={
          <>
            {declining?.name} will be told their application was not successful. The reason is
            recorded in the audit log against your name.
          </>
        }
      />

    </>
  );
}

function RequestCard({
  request,
  onOpen,
  onApprove,
  onDecline,
  busy,
}: {
  request: JoinRequest;
  onOpen: () => void;
  onApprove: () => void;
  onDecline: () => void;
  busy: boolean;
}) {
  const checks = checkList(request);
  const blocking = checks.filter((c) => c.state === 'fail');

  return (
    <Card className="flex flex-col">
      <div className="flex items-start gap-3 px-5 py-4">
        <Avatar name={request.name} />
        <div className="min-w-0 flex-1">
          <button onClick={onOpen} className="text-left hover:underline">
            <p className="truncate text-[15px] font-semibold text-navy-900">{request.name}</p>
          </button>
          <p className="truncate text-[13px] text-slate-500">
            {request.phone} · {request.email}
          </p>
          <p className="mt-0.5 text-xs text-slate-400">
            {request.reference} · applied {relative(request.appliedAt)}
          </p>
        </div>
        <Badge tone={request.review.stage === 'NEW' ? 'blue' : 'slate'}>
          {humanise(request.review.stage)}
        </Badge>
      </div>

      <div className="flex flex-wrap gap-2 border-t border-slate-100 px-5 py-3">
        {checks.map((c) => (
          <span
            key={c.label}
            className={
              c.state === 'pass'
                ? 'inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700'
                : c.state === 'fail'
                  ? 'inline-flex items-center gap-1 rounded-md bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-700'
                  : 'inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600'
            }
          >
            {c.state === 'pass' ? (
              <CheckCircle2 className="h-3 w-3" />
            ) : c.state === 'fail' ? (
              <XCircle className="h-3 w-3" />
            ) : (
              <Clock className="h-3 w-3" />
            )}
            {c.label}
          </span>
        ))}
      </div>

      {request.applicationNote && (
        <p className="border-t border-slate-100 px-5 py-3 text-[13px] italic text-slate-600">
          “{request.applicationNote}”
        </p>
      )}

      <div className="mt-auto flex items-center gap-2 border-t border-slate-100 px-5 py-3">
        <Button size="sm" variant="secondary" onClick={onOpen}>
          Review
        </Button>
        <div className="flex-1" />
        <Button size="sm" variant="ghost" onClick={onDecline} disabled={busy}>
          Decline
        </Button>
        <Button
          size="sm"
          onClick={onApprove}
          loading={busy}
          icon={<UserCheck className="h-4 w-4" />}
          title={blocking.length ? 'A check has failed — review before approving' : undefined}
        >
          Approve
        </Button>
      </div>
    </Card>
  );
}

/** The checks an officer is supposed to weigh before admitting someone. */
function checkList(request: JoinRequest) {
  const r = request.review;
  return [
    {
      label: 'Phone verified',
      state: r.phoneVerified ? ('pass' as const) : ('pending' as const),
    },
    {
      label: `KYC ${humanise(request.kycStatus).toLowerCase()}`,
      state:
        request.kycStatus === 'APPROVED' || request.kycStatus === 'VERIFIED'
          ? ('pass' as const)
          : request.kycStatus === 'REJECTED'
            ? ('fail' as const)
            : ('pending' as const),
    },
    ...(r.refereeState && r.refereeState !== 'NOT_REQUIRED'
      ? [
          {
            label: `Referee ${r.refereeState.toLowerCase()}`,
            state:
              r.refereeState === 'CONFIRMED'
                ? ('pass' as const)
                : r.refereeState === 'DECLINED'
                  ? ('fail' as const)
                  : ('pending' as const),
          },
        ]
      : []),
    ...(r.idCheck && r.idCheck !== 'NOT_REQUIRED'
      ? [
          {
            label: `ID ${r.idCheck.toLowerCase()}`,
            state:
              r.idCheck === 'PASSED'
                ? ('pass' as const)
                : r.idCheck === 'FAILED'
                  ? ('fail' as const)
                  : ('pending' as const),
          },
        ]
      : []),
    ...(r.entryFee && r.entryFee !== 'NOT_REQUIRED'
      ? [
          {
            label: `Entry fee ${r.entryFee.toLowerCase()}`,
            state: r.entryFee === 'PAID' ? ('pass' as const) : ('pending' as const),
          },
        ]
      : []),
  ];
}

function RequestDetail({
  request,
  communityId,
  onApprove,
  onDecline,
  onStage,
  onNoted,
  busy,
}: {
  request: JoinRequest;
  communityId: string;
  onApprove: () => void;
  onDecline: () => void;
  onStage: (stage: JoinReviewStage) => void;
  onNoted: () => Promise<void>;
  busy: boolean;
}) {
  const { toast } = useToast();
  const [note, setNote] = useState('');
  const [toApplicant, setToApplicant] = useState(false);

  const addNote = useMutation(
    () =>
      portalApi.addJoinNote(communityId, request.membershipId, {
        text: note.trim(),
        toApplicant,
      }),
    {
      onSuccess: async () => {
        setNote('');
        toast('Note added', 'success');
        await onNoted();
      },
      onError: (message) => toast('Could not add the note', 'error', message),
    },
  );

  const answers = request.review.answers ?? null;

  return (
    <div className="space-y-5">
      <dl className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <dt className="text-xs text-slate-500">Phone</dt>
          <dd className="font-medium text-navy-900">{request.phone}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Email</dt>
          <dd className="truncate font-medium text-navy-900">{request.email}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Location</dt>
          <dd className="font-medium text-navy-900">{request.location ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Applied</dt>
          <dd className="font-medium text-navy-900">{date(request.appliedAt, 'long')}</dd>
        </div>
      </dl>

      {request.kycStatus !== 'APPROVED' && request.kycStatus !== 'VERIFIED' && (
        <Callout tone="warning" title="Identity not verified by Vista">
          This applicant&apos;s KYC is {humanise(request.kycStatus).toLowerCase()}. You can still
          admit them, but Vista has not confirmed who they are.
        </Callout>
      )}

      {answers && Object.keys(answers).length > 0 && (
        <div>
          <p className="eyebrow mb-2">Application answers</p>
          <dl className="space-y-2 rounded-lg bg-slate-50 p-3">
            {Object.entries(answers).map(([q, a]) => (
              <div key={q}>
                <dt className="text-xs text-slate-500">{q}</dt>
                <dd className="text-[13px] text-navy-900">{a}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      <div>
        <p className="eyebrow mb-2">Move to</p>
        <div className="flex flex-wrap gap-2">
          {(['IN_REVIEW', 'INFO_REQUESTED', 'AWAITING_REFEREE', 'WAITLISTED'] as JoinReviewStage[]).map(
            (stage) => (
              <Button
                key={stage}
                size="xs"
                variant={request.review.stage === stage ? 'soft' : 'secondary'}
                disabled={busy}
                onClick={() => onStage(stage)}
                icon={
                  stage === 'AWAITING_REFEREE' ? (
                    <ShieldQuestion className="h-3.5 w-3.5" />
                  ) : stage === 'INFO_REQUESTED' ? (
                    <MessageSquare className="h-3.5 w-3.5" />
                  ) : (
                    <BadgeCheck className="h-3.5 w-3.5" />
                  )
                }
              >
                {humanise(stage)}
              </Button>
            ),
          )}
        </div>
      </div>

      <div>
        <p className="eyebrow mb-2">Notes</p>
        {request.review.notes.length > 0 && (
          <ul className="mb-3 space-y-2">
            {request.review.notes.map((n) => (
              <li key={n.id} className="rounded-lg bg-slate-50 px-3 py-2">
                <p className="text-[13px] text-navy-800">{n.text}</p>
                <p className="mt-0.5 text-[11px] text-slate-400">
                  {relative(n.at)}
                  {n.toApplicant ? ' · shared with applicant' : ' · internal'}
                </p>
              </li>
            ))}
          </ul>
        )}
        <Textarea
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Add a note for the committee…"
          aria-label="New note"
        />
        <div className="mt-2 flex items-center gap-3">
          <label className="flex items-center gap-2 text-[13px] text-slate-600">
            <input
              type="checkbox"
              checked={toApplicant}
              onChange={(e) => setToApplicant(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            />
            Share with the applicant
          </label>
          <div className="flex-1" />
          <Button
            size="sm"
            variant="secondary"
            disabled={note.trim().length < 2}
            loading={addNote.pending}
            onClick={() => void addNote.run()}
          >
            Add note
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2 border-t border-slate-100 pt-4">
        <Button variant="ghost" onClick={onDecline}>
          Decline
        </Button>
        <div className="flex-1" />
        <Button onClick={onApprove} loading={busy} icon={<UserCheck className="h-4 w-4" />}>
          Approve and admit
        </Button>
      </div>
    </div>
  );
}
