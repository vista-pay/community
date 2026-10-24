'use client';

import { useState } from 'react';
import {
  CalendarDays,
  CheckCircle2,
  FileText,
  Gavel,
  Plus,
  Scale,
  Vote,
} from 'lucide-react';
import {
  AmountInput,
  Badge,
  Button,
  Callout,
  Card,
  CardHeader,
  ConfirmDialog,
  DataTable,
  EmptyState,
  Field,
  Input,
  Modal,
  PageHeader,
  ProgressBar,
  Segmented,
  Select,
  StatusBadge,
  Tabs,
  Textarea,
} from '@/components/ui';
import { useMutation, useQuery } from '@/hooks/use-query';
import { useCommunityId } from '@/components/providers/session-provider';
import { useToast } from '@/components/providers/toast-provider';
import { portalApi } from '@/services/portal';
import { date, fileSize, humanise, money, relative } from '@/lib/format';
import { MEETING_KINDS } from '@/data/catalog';
import type {
  AttendanceState,
  CommunityDocument,
  Fine,
  Meeting,
  MemberRow,
  Poll,
} from '@/types';

type Tab = 'meetings' | 'votes' | 'documents' | 'fines';

interface Initial {
  meetings: Meeting[];
  polls: Poll[];
  documents: CommunityDocument[];
  fines: Fine[];
  members: MemberRow[];
}

export function GovernanceClient({ initial }: { initial: Initial }) {
  const communityId = useCommunityId();
  const [tab, setTab] = useState<Tab>('meetings');

  const meetings = useQuery(() => portalApi.meetings(communityId), [communityId], {
    initial: initial.meetings,
  });
  const polls = useQuery(() => portalApi.polls(communityId), [communityId], {
    initial: initial.polls,
  });
  const documents = useQuery(() => portalApi.documents(communityId), [communityId], {
    initial: initial.documents,
  });
  const fines = useQuery(() => portalApi.fines(communityId), [communityId], {
    initial: initial.fines,
  });

  const [meetingOpen, setMeetingOpen] = useState(false);
  const [pollOpen, setPollOpen] = useState(false);
  const [fineOpen, setFineOpen] = useState(false);

  const unpaidFines = (fines.data ?? []).filter((f) => f.status === 'UNPAID').length;
  const openBallots = (polls.data ?? []).filter((p) => p.status === 'OPEN').length;

  return (
    <>
      <PageHeader
        title="Governance"
        subtitle="Meetings, ballots, the document shelf and member conduct"
        actions={
          tab === 'meetings' ? (
            <Button icon={<Plus className="h-4 w-4" />} onClick={() => setMeetingOpen(true)}>
              Schedule meeting
            </Button>
          ) : tab === 'votes' ? (
            <Button icon={<Plus className="h-4 w-4" />} onClick={() => setPollOpen(true)}>
              Open a ballot
            </Button>
          ) : tab === 'fines' ? (
            <Button icon={<Plus className="h-4 w-4" />} onClick={() => setFineOpen(true)}>
              Issue a fine
            </Button>
          ) : null
        }
      />

      <Tabs
        value={tab}
        onChange={setTab}
        className="mb-4"
        tabs={[
          { value: 'meetings', label: 'Meetings', count: (meetings.data ?? []).length },
          { value: 'votes', label: 'Votes', count: openBallots || undefined },
          { value: 'documents', label: 'Documents', count: (documents.data ?? []).length },
          { value: 'fines', label: 'Fines', count: unpaidFines || undefined },
        ]}
      />

      {tab === 'meetings' && (
        <MeetingsTab
          meetings={meetings.data ?? []}
          members={initial.members}
          communityId={communityId}
          onChanged={meetings.refresh}
        />
      )}

      {tab === 'votes' && (
        <VotesTab polls={polls.data ?? []} communityId={communityId} onChanged={polls.refresh} />
      )}

      {tab === 'documents' && (
        <DocumentsTab
          documents={documents.data ?? []}
          communityId={communityId}
          onChanged={documents.refresh}
        />
      )}

      {tab === 'fines' && (
        <FinesTab fines={fines.data ?? []} communityId={communityId} onChanged={fines.refresh} />
      )}

      <MeetingModal
        open={meetingOpen}
        onClose={() => setMeetingOpen(false)}
        communityId={communityId}
        onCreated={meetings.refresh}
      />
      <PollModal
        open={pollOpen}
        onClose={() => setPollOpen(false)}
        communityId={communityId}
        onCreated={polls.refresh}
      />
      <FineModal
        open={fineOpen}
        onClose={() => setFineOpen(false)}
        communityId={communityId}
        members={initial.members}
        onCreated={fines.refresh}
      />
    </>
  );
}

// ───────────────────────────── Meetings ─────────────────────────────

function MeetingsTab({
  meetings,
  members,
  communityId,
  onChanged,
}: {
  meetings: Meeting[];
  members: MemberRow[];
  communityId: string;
  onChanged: () => Promise<void>;
}) {
  const [attendanceFor, setAttendanceFor] = useState<Meeting | null>(null);
  const [minutesFor, setMinutesFor] = useState<Meeting | null>(null);

  if (meetings.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={<CalendarDays className="h-5 w-5" />}
          title="No meetings scheduled"
          body="Schedule your AGM, a general meeting or an executive session."
        />
      </Card>
    );
  }

  return (
    <>
      <div className="grid gap-4 lg:grid-cols-2">
        {meetings.map((m) => (
          <Card key={m.id}>
            <CardHeader
              title={m.title}
              subtitle={`${date(m.scheduledFor, 'datetime')} · ${m.venue}`}
              action={<StatusBadge status={m.status.toLowerCase()} />}
            />

            <div className="px-5 py-4">
              <div className="flex items-center justify-between text-[13px]">
                <span className="text-slate-600">
                  Quorum: {m.quorum.present} of {m.quorum.required} required
                  {m.quorum.apologies > 0 ? ` · ${m.quorum.apologies} apologies` : ''}
                </span>
                {m.quorum.met === null ? (
                  <Badge tone="slate">{humanise(m.kind)}</Badge>
                ) : (
                  <Badge tone={m.quorum.met ? 'green' : 'red'}>
                    {m.quorum.met ? 'Quorate' : 'Not quorate'}
                  </Badge>
                )}
              </div>
              <ProgressBar
                className="mt-2"
                value={m.quorum.required ? (m.quorum.present / m.quorum.required) * 100 : 0}
                tone={m.quorum.met === false ? 'red' : 'brand'}
              />

              {m.agenda.length > 0 && (
                <ol className="mt-4 list-decimal space-y-1 pl-5 text-[13px] text-slate-600">
                  {m.agenda.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ol>
              )}

              {m.resolutions.length > 0 && (
                <div className="mt-4 rounded-lg bg-slate-50 p-3">
                  <p className="eyebrow mb-1">Resolutions</p>
                  <ul className="space-y-1 text-[13px] text-navy-800">
                    {m.resolutions.map((r, i) => (
                      <li key={i} className="flex gap-2">
                        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-600" />
                        {r}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 px-5 py-3">
              <Badge tone={m.minutesStatus === 'APPROVED' ? 'green' : 'slate'}>
                Minutes {m.minutesStatus.toLowerCase()}
              </Badge>
              <div className="flex-1" />
              <Button size="sm" variant="secondary" onClick={() => setAttendanceFor(m)}>
                Attendance
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setMinutesFor(m)}>
                Minutes
              </Button>
            </div>
          </Card>
        ))}
      </div>

      <AttendanceModal
        meeting={attendanceFor}
        members={members}
        communityId={communityId}
        onClose={() => setAttendanceFor(null)}
        onSaved={async () => {
          setAttendanceFor(null);
          await onChanged();
        }}
      />

      <MinutesModal
        meeting={minutesFor}
        communityId={communityId}
        onClose={() => setMinutesFor(null)}
        onSaved={async () => {
          setMinutesFor(null);
          await onChanged();
        }}
      />
    </>
  );
}

function MeetingModal({
  open,
  onClose,
  communityId,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  communityId: string;
  onCreated: () => Promise<void>;
}) {
  const { toast } = useToast();
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState('GENERAL');
  const [scheduledFor, setScheduledFor] = useState('');
  const [venue, setVenue] = useState('');
  const [agenda, setAgenda] = useState('');
  const [quorumPercent, setQuorumPercent] = useState('50');

  const create = useMutation(
    () =>
      portalApi.createMeeting(communityId, {
        title: title.trim(),
        kind,
        scheduledFor: new Date(scheduledFor).toISOString(),
        venue: venue.trim(),
        agenda: agenda
          .split('\n')
          .map((l) => l.trim())
          .filter(Boolean),
        quorumPercent: Number(quorumPercent),
      }),
    {
      onSuccess: async () => {
        toast('Meeting scheduled', 'success');
        setTitle('');
        setScheduledFor('');
        setVenue('');
        setAgenda('');
        onClose();
        await onCreated();
      },
      onError: (message) => toast('Could not schedule', 'error', message),
    },
  );

  const valid = title.trim().length > 2 && scheduledFor && venue.trim().length > 1;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Schedule a meeting"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!valid} loading={create.pending} onClick={() => void create.run()}>
            Schedule
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {create.error && <Callout tone="danger">{create.error}</Callout>}

        <Field label="Title" htmlFor="mt-title" required>
          <Input
            id="mt-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="2026 Annual General Meeting"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Type" htmlFor="mt-kind" required>
            <Select id="mt-kind" value={kind} onChange={(e) => setKind(e.target.value)}>
              {MEETING_KINDS.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="Quorum"
            htmlFor="mt-quorum"
            required
            hint="Percentage of active members needed"
          >
            <Input
              id="mt-quorum"
              type="number"
              min={1}
              max={100}
              value={quorumPercent}
              onChange={(e) => setQuorumPercent(e.target.value)}
              suffix="%"
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Date and time" htmlFor="mt-when" required>
            <Input
              id="mt-when"
              type="datetime-local"
              value={scheduledFor}
              onChange={(e) => setScheduledFor(e.target.value)}
            />
          </Field>
          <Field label="Venue" htmlFor="mt-venue" required>
            <Input
              id="mt-venue"
              value={venue}
              onChange={(e) => setVenue(e.target.value)}
              placeholder="Community Hall, Ojodu"
            />
          </Field>
        </div>

        <Field label="Agenda" htmlFor="mt-agenda" optional hint="One item per line">
          <Textarea
            id="mt-agenda"
            rows={4}
            value={agenda}
            onChange={(e) => setAgenda(e.target.value)}
            placeholder={'Opening prayer\nMinutes of the last meeting\nTreasurer’s report'}
          />
        </Field>
      </div>
    </Modal>
  );
}

function AttendanceModal({
  meeting,
  members,
  communityId,
  onClose,
  onSaved,
}: {
  meeting: Meeting | null;
  members: MemberRow[];
  communityId: string;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const { toast } = useToast();
  const [states, setStates] = useState<Record<string, AttendanceState>>({});

  const current = (memberId: string): AttendanceState =>
    states[memberId] ??
    meeting?.attendance.find((a) => a.memberId === memberId)?.state ??
    'ABSENT';

  const save = useMutation(
    () =>
      portalApi.recordAttendance(
        communityId,
        meeting!.id,
        members.map((m) => ({ memberId: m.id, state: current(m.id) })),
      ),
    {
      onSuccess: async () => {
        toast('Attendance recorded', 'success');
        setStates({});
        await onSaved();
      },
      onError: (message) => toast('Could not save attendance', 'error', message),
    },
  );

  if (!meeting) return null;

  const present = members.filter((m) => current(m.id) === 'PRESENT').length;

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={`Attendance — ${meeting.title}`}
      description={`${present} present · ${meeting.quorum.required} needed for quorum`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={save.pending} onClick={() => void save.run()}>
            Save attendance
          </Button>
        </>
      }
    >
      <ul className="divide-y divide-slate-100">
        {members
          .filter((m) => m.status === 'ACTIVE')
          .map((m) => (
            <li key={m.id} className="flex items-center gap-3 py-2.5">
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-medium text-navy-900">{m.name}</span>
                <span className="block text-xs text-slate-500">{m.memberNumber}</span>
              </span>
              <Segmented
                label={`Attendance for ${m.name}`}
                size="sm"
                value={current(m.id)}
                onChange={(state) => setStates((s) => ({ ...s, [m.id]: state }))}
                options={[
                  { value: 'PRESENT', label: 'Present' },
                  { value: 'APOLOGY', label: 'Apology' },
                  { value: 'ABSENT', label: 'Absent' },
                ]}
              />
            </li>
          ))}
      </ul>
    </Modal>
  );
}

function MinutesModal({
  meeting,
  communityId,
  onClose,
  onSaved,
}: {
  meeting: Meeting | null;
  communityId: string;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const { toast } = useToast();
  const [minutes, setMinutes] = useState(meeting?.minutes ?? '');
  const [resolutions, setResolutions] = useState((meeting?.resolutions ?? []).join('\n'));

  const approved = meeting?.minutesStatus === 'APPROVED';

  const save = useMutation(
    (approve: boolean) =>
      portalApi.updateMeeting(communityId, meeting!.id, {
        minutes,
        minutesStatus: approve ? 'APPROVED' : 'DRAFT',
        resolutions: resolutions
          .split('\n')
          .map((l) => l.trim())
          .filter(Boolean),
        ...(approve ? { status: 'HELD' } : {}),
      }),
    {
      onSuccess: async () => {
        toast('Minutes saved', 'success');
        await onSaved();
      },
      onError: (message) => toast('Could not save the minutes', 'error', message),
    },
  );

  if (!meeting) return null;

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={`Minutes — ${meeting.title}`}
      footer={
        approved ? (
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        ) : (
          <>
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="secondary"
              loading={save.pending}
              onClick={() => void save.run(false)}
            >
              Save draft
            </Button>
            <Button loading={save.pending} onClick={() => void save.run(true)}>
              Approve minutes
            </Button>
          </>
        )
      }
    >
      <div className="space-y-4">
        {approved && (
          <Callout tone="info" title="These minutes are approved">
            Approved minutes are the community&apos;s record of what was decided and cannot be
            edited. Record any correction as a resolution at the next meeting.
          </Callout>
        )}

        <Field label="Minutes" htmlFor="mn-body">
          <Textarea
            id="mn-body"
            rows={10}
            value={minutes}
            disabled={approved}
            onChange={(e) => setMinutes(e.target.value)}
            placeholder="What was discussed and decided…"
          />
        </Field>

        <Field label="Resolutions" htmlFor="mn-res" optional hint="One per line">
          <Textarea
            id="mn-res"
            rows={4}
            value={resolutions}
            disabled={approved}
            onChange={(e) => setResolutions(e.target.value)}
          />
        </Field>
      </div>
    </Modal>
  );
}

// ───────────────────────────── Votes ─────────────────────────────

function VotesTab({
  polls,
  communityId,
  onChanged,
}: {
  polls: Poll[];
  communityId: string;
  onChanged: () => Promise<void>;
}) {
  const { toast } = useToast();

  const vote = useMutation(
    (pollId: string, optionId: string) => portalApi.vote(communityId, pollId, optionId),
    {
      onSuccess: async () => {
        toast('Your vote is recorded', 'success');
        await onChanged();
      },
      onError: (message) => toast('Could not record your vote', 'error', message),
    },
  );

  const certify = useMutation((pollId: string) => portalApi.certifyPoll(communityId, pollId), {
    onSuccess: async () => {
      toast('Result certified', 'success');
      await onChanged();
    },
    onError: (message) => toast('Could not certify', 'error', message),
  });

  if (polls.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={<Vote className="h-5 w-5" />}
          title="No ballots yet"
          body="Open a poll, an election or a resolution for members to vote on."
        />
      </Card>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {polls.map((p) => {
        const tallyVisible = p.options.some((o) => o.votes !== null);
        return (
          <Card key={p.id}>
            <CardHeader
              title={p.title}
              subtitle={humanise(p.kind)}
              action={<StatusBadge status={p.status.toLowerCase()} />}
            />
            <div className="px-5 py-4">
              <p className="text-[13px] text-slate-700">{p.question}</p>

              <ul className="mt-4 space-y-2">
                {p.options.map((o) => {
                  const share =
                    o.votes !== null && p.totalVotes > 0 ? (o.votes / p.totalVotes) * 100 : 0;
                  return (
                    <li key={o.id}>
                      <div className="flex items-center justify-between text-[13px]">
                        <span className="text-navy-900">
                          {o.label}
                          {p.myVote === o.id && (
                            <span className="ml-2 text-xs text-brand-700">your vote</span>
                          )}
                        </span>
                        <span className="tnum text-slate-600">
                          {o.votes === null ? '—' : `${o.votes} (${Math.round(share)}%)`}
                        </span>
                      </div>
                      {tallyVisible && <ProgressBar className="mt-1" value={share} />}
                      {p.status === 'OPEN' && !p.myVote && (
                        <Button
                          size="xs"
                          variant="secondary"
                          className="mt-1.5"
                          disabled={vote.pending}
                          onClick={() => void vote.run(p.id, o.id)}
                        >
                          Vote for this
                        </Button>
                      )}
                    </li>
                  );
                })}
              </ul>

              {!tallyVisible && p.status === 'OPEN' && (
                <p className="mt-3 text-xs italic text-slate-500">
                  The tally stays hidden until voting closes, so a running count cannot sway the
                  undecided.
                </p>
              )}

              <p className="mt-4 text-xs text-slate-500">
                {p.totalVotes} of {p.eligibleCount} eligible voted ({p.turnout}% turnout) ·{' '}
                {p.status === 'SCHEDULED'
                  ? `opens ${date(p.opensAt, 'datetime')}`
                  : `closes ${date(p.closesAt, 'datetime')}`}
              </p>
            </div>

            {p.status === 'CLOSED' && (
              <div className="border-t border-slate-100 px-5 py-3">
                <Button
                  size="sm"
                  variant="secondary"
                  loading={certify.pending}
                  icon={<Gavel className="h-3.5 w-3.5" />}
                  onClick={() => void certify.run(p.id)}
                >
                  Certify the result
                </Button>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}

function PollModal({
  open,
  onClose,
  communityId,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  communityId: string;
  onCreated: () => Promise<void>;
}) {
  const { toast } = useToast();
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState('POLL');
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState('Yes\nNo\nAbstain');
  const [opensAt, setOpensAt] = useState('');
  const [closesAt, setClosesAt] = useState('');

  const create = useMutation(
    () =>
      portalApi.createPoll(communityId, {
        title: title.trim(),
        kind,
        question: question.trim(),
        eligibility: 'ALL_ACTIVE',
        options: options
          .split('\n')
          .map((l) => l.trim())
          .filter(Boolean),
        opensAt: new Date(opensAt).toISOString(),
        closesAt: new Date(closesAt).toISOString(),
      }),
    {
      onSuccess: async () => {
        toast('Ballot created', 'success');
        onClose();
        await onCreated();
      },
      onError: (message) => toast('Could not create the ballot', 'error', message),
    },
  );

  const optionCount = options.split('\n').filter((l) => l.trim()).length;
  const valid =
    title.trim().length > 2 && question.trim().length > 4 && optionCount >= 2 && opensAt && closesAt;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Open a ballot"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!valid} loading={create.pending} onClick={() => void create.run()}>
            Open ballot
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {create.error && <Callout tone="danger">{create.error}</Callout>}

        <Field label="Title" htmlFor="pl-title" required>
          <Input
            id="pl-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Adoption of the 2026 accounts"
          />
        </Field>

        <Field label="Type" htmlFor="pl-kind" required>
          <Select id="pl-kind" value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="POLL">Poll</option>
            <option value="ELECTION">Election</option>
            <option value="RESOLUTION">Resolution</option>
          </Select>
        </Field>

        <Field label="Question" htmlFor="pl-q" required>
          <Textarea
            id="pl-q"
            rows={2}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Do you adopt the audited accounts as presented?"
          />
        </Field>

        <Field label="Options" htmlFor="pl-opts" required hint="One per line, at least two">
          <Textarea id="pl-opts" rows={4} value={options} onChange={(e) => setOptions(e.target.value)} />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Opens" htmlFor="pl-open" required>
            <Input
              id="pl-open"
              type="datetime-local"
              value={opensAt}
              onChange={(e) => setOpensAt(e.target.value)}
            />
          </Field>
          <Field label="Closes" htmlFor="pl-close" required>
            <Input
              id="pl-close"
              type="datetime-local"
              value={closesAt}
              onChange={(e) => setClosesAt(e.target.value)}
            />
          </Field>
        </div>
      </div>
    </Modal>
  );
}

// ───────────────────────────── Documents ─────────────────────────────

function DocumentsTab({
  documents,
  communityId,
  onChanged,
}: {
  documents: CommunityDocument[];
  communityId: string;
  onChanged: () => Promise<void>;
}) {
  const { toast } = useToast();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('GOVERNANCE');
  const [visibility, setVisibility] = useState('MEMBERS');
  const [fileUrl, setFileUrl] = useState('');

  const add = useMutation(
    () =>
      portalApi.addDocument(communityId, {
        name: name.trim(),
        category,
        visibility,
        fileUrl: fileUrl.trim(),
        // Size is unknown for a linked file; the shelf records it as 1 byte
        // rather than inventing a figure.
        sizeBytes: 1,
      }),
    {
      onSuccess: async () => {
        toast('Document added', 'success');
        setAdding(false);
        setName('');
        setFileUrl('');
        await onChanged();
      },
      onError: (message) => toast('Could not add the document', 'error', message),
    },
  );

  const remove = useMutation(
    (documentId: string) => portalApi.removeDocument(communityId, documentId),
    {
      onSuccess: async () => {
        toast('Document removed', 'info');
        await onChanged();
      },
      onError: (message) => toast('Could not remove it', 'error', message),
    },
  );

  return (
    <>
      <Card>
        <CardHeader
          title="Document shelf"
          subtitle="Bye-laws, minutes, policies and forms"
          action={
            <Button size="sm" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => setAdding(true)}>
              Add
            </Button>
          }
        />
        <DataTable
          rows={documents}
          rowKey={(d) => d.id}
          columns={[
            {
              key: 'name',
              header: 'Document',
              cell: (d) => (
                <a
                  href={d.fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 font-medium text-navy-900 hover:underline"
                >
                  <FileText className="h-4 w-4 text-slate-400" />
                  {d.name}
                  <span className="text-xs text-slate-400">v{d.version}</span>
                </a>
              ),
            },
            { key: 'category', header: 'Category', cell: (d) => <Badge tone="slate">{humanise(d.category)}</Badge> },
            {
              key: 'visibility',
              header: 'Visible to',
              hideOnMobile: true,
              cell: (d) => humanise(d.visibility),
            },
            {
              key: 'size',
              header: 'Size',
              align: 'right',
              hideOnMobile: true,
              cell: (d) => (d.sizeBytes > 1 ? fileSize(d.sizeBytes) : '—'),
            },
            {
              key: 'uploaded',
              header: 'Added',
              hideOnMobile: true,
              cell: (d) => <span className="text-slate-500">{relative(d.createdAt)}</span>,
            },
            {
              key: 'actions',
              header: '',
              align: 'right',
              cell: (d) => (
                <Button size="xs" variant="ghost" onClick={() => void remove.run(d.id)}>
                  Remove
                </Button>
              ),
            },
          ]}
          empty={
            <EmptyState
              icon={<FileText className="h-5 w-5" />}
              title="No documents yet"
              body="Put your bye-laws and approved minutes where members can find them."
            />
          }
        />
      </Card>

      <Modal
        open={adding}
        onClose={() => setAdding(false)}
        title="Add a document"
        footer={
          <>
            <Button variant="secondary" onClick={() => setAdding(false)}>
              Cancel
            </Button>
            <Button
              disabled={name.trim().length < 2 || !fileUrl.trim()}
              loading={add.pending}
              onClick={() => void add.run()}
            >
              Add
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {add.error && <Callout tone="danger">{add.error}</Callout>}
          <Field label="Name" htmlFor="doc-name" required>
            <Input
              id="doc-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Bye-laws (2026 revision)"
            />
          </Field>
          <Field
            label="Link"
            htmlFor="doc-url"
            required
            hint="A link to the file in your storage. Uploading from here is not wired up yet."
          >
            <Input
              id="doc-url"
              value={fileUrl}
              onChange={(e) => setFileUrl(e.target.value)}
              placeholder="https://…"
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Category" htmlFor="doc-cat" required>
              <Select id="doc-cat" value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="GOVERNANCE">Governance</option>
                <option value="MINUTES">Minutes</option>
                <option value="FINANCIAL">Financial</option>
                <option value="FORMS">Forms</option>
                <option value="POLICIES">Policies</option>
              </Select>
            </Field>
            <Field label="Visible to" htmlFor="doc-vis" required>
              <Select id="doc-vis" value={visibility} onChange={(e) => setVisibility(e.target.value)}>
                <option value="MEMBERS">All members</option>
                <option value="OFFICERS">Officers only</option>
              </Select>
            </Field>
          </div>
        </div>
      </Modal>
    </>
  );
}

// ───────────────────────────── Fines ─────────────────────────────

function FinesTab({
  fines,
  communityId,
  onChanged,
}: {
  fines: Fine[];
  communityId: string;
  onChanged: () => Promise<void>;
}) {
  const { toast } = useToast();
  const [waiving, setWaiving] = useState<Fine | null>(null);

  const waive = useMutation(
    (fineId: string, reason: string) => portalApi.waiveFine(communityId, fineId, reason),
    {
      onSuccess: async () => {
        toast('Fine waived', 'info', 'Your name and reason are on the record.');
        setWaiving(null);
        await onChanged();
      },
      onError: (message) => toast('Could not waive', 'error', message),
    },
  );

  const pay = useMutation((fineId: string) => portalApi.payFine(communityId, fineId), {
    onSuccess: async () => {
      toast('Marked paid', 'success');
      await onChanged();
    },
    onError: (message) => toast('Could not mark it paid', 'error', message),
  });

  return (
    <>
      <Card>
        <DataTable
          rows={fines}
          rowKey={(f) => f.id}
          columns={[
            { key: 'member', header: 'Member', cell: (f) => f.memberName },
            { key: 'reason', header: 'Reason', cell: (f) => f.reason },
            { key: 'amount', header: 'Amount', align: 'right', cell: (f) => money(f.amount) },
            { key: 'status', header: 'Status', cell: (f) => <StatusBadge status={f.status.toLowerCase()} /> },
            {
              key: 'issued',
              header: 'Issued',
              hideOnMobile: true,
              cell: (f) => <span className="text-slate-500">{date(f.issuedAt)}</span>,
            },
            {
              key: 'actions',
              header: '',
              align: 'right',
              cell: (f) =>
                f.status === 'UNPAID' ? (
                  <span className="flex justify-end gap-1.5">
                    <Button size="xs" variant="ghost" onClick={() => setWaiving(f)}>
                      Waive
                    </Button>
                    <Button size="xs" variant="secondary" onClick={() => void pay.run(f.id)}>
                      Mark paid
                    </Button>
                  </span>
                ) : f.status === 'WAIVED' && f.waiverReason ? (
                  <span className="text-xs italic text-slate-500">{f.waiverReason}</span>
                ) : null,
            },
          ]}
          empty={
            <EmptyState
              icon={<Scale className="h-5 w-5" />}
              title="No fines"
              body="Fines for absence or late payment appear here once issued."
            />
          }
        />
      </Card>

      <ConfirmDialog
        open={Boolean(waiving)}
        onClose={() => setWaiving(null)}
        title="Waive this fine?"
        confirmLabel="Waive"
        requireReason
        reasonLabel="Why is it being waived?"
        loading={waive.pending}
        onConfirm={(reason) => waiving && void waive.run(waiving.id, reason)}
        body={
          <>
            {waiving?.memberName} will no longer owe {money(waiving?.amount ?? '0')}. Waivers are
            recorded against your name in the audit log.
          </>
        }
      />
    </>
  );
}

function FineModal({
  open,
  onClose,
  communityId,
  members,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  communityId: string;
  members: MemberRow[];
  onCreated: () => Promise<void>;
}) {
  const { toast } = useToast();
  const [memberId, setMemberId] = useState('');
  const [reason, setReason] = useState('');
  const [amount, setAmount] = useState('');

  const create = useMutation(
    () => portalApi.issueFine(communityId, { memberId, reason: reason.trim(), amount }),
    {
      onSuccess: async () => {
        toast('Fine issued', 'success');
        setMemberId('');
        setReason('');
        setAmount('');
        onClose();
        await onCreated();
      },
      onError: (message) => toast('Could not issue the fine', 'error', message),
    },
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Issue a fine"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!memberId || reason.trim().length < 4 || Number(amount) <= 0}
            loading={create.pending}
            onClick={() => void create.run()}
          >
            Issue
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {create.error && <Callout tone="danger">{create.error}</Callout>}

        <Field label="Member" htmlFor="fn-member" required>
          <Select id="fn-member" value={memberId} onChange={(e) => setMemberId(e.target.value)}>
            <option value="">Choose a member…</option>
            {members
              .filter((m) => m.status === 'ACTIVE')
              .map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} — {m.memberNumber}
                </option>
              ))}
          </Select>
        </Field>

        <Field label="Reason" htmlFor="fn-reason" required>
          <Textarea
            id="fn-reason"
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Absent from the September general meeting without apology"
          />
        </Field>

        <Field label="Amount" htmlFor="fn-amount" required>
          <AmountInput id="fn-amount" value={amount} onChange={setAmount} />
        </Field>
      </div>
    </Modal>
  );
}
