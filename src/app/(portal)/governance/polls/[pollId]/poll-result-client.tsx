'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import {
  ArrowLeft,
  Download,
  Gavel,
  Mail,
  Minus,
  Trophy,
  Users,
} from 'lucide-react';
import {
  Badge,
  Button,
  Callout,
  Card,
  CardHeader,
  ConfirmDialog,
  KV,
  PageHeader,
  ProgressBar,
  Stat,
  StatusBadge,
} from '@/components/ui';
import { useMutation, useQuery } from '@/hooks/use-query';
import { useCommunityId } from '@/components/providers/session-provider';
import { useToast } from '@/components/providers/toast-provider';
import { portalApi } from '@/services/portal';
import { date, humanise } from '@/lib/format';
import type { PollDetail } from '@/types';

/**
 * One ballot, read as a result rather than a card in a grid.
 *
 * A vote is a thing a community acts on, so the page leads with what was
 * decided and follows with the evidence: the full count including the
 * options that got nothing, who was eligible, and how many of them turned
 * up. The summary on the governance tab could never carry that.
 */
export function PollResultClient({ initial }: { initial: PollDetail }) {
  const communityId = useCommunityId();
  const { toast } = useToast();
  const [confirming, setConfirming] = useState<'certify' | 'broadcast' | null>(null);

  const { data, refresh } = useQuery<PollDetail>(
    () => portalApi.poll(communityId, initial.id),
    [communityId, initial.id],
    { initial },
  );
  const poll = data ?? initial;
  const open = poll.status === 'OPEN' || poll.status === 'SCHEDULED';
  const noun =
    poll.kind === 'ELECTION' ? 'election' : poll.kind === 'POLL' ? 'poll' : 'ballot';

  const certify = useMutation(() => portalApi.certifyPoll(communityId, poll.id), {
    onSuccess: async () => {
      toast('Result certified', 'success', 'It can now be filed and sent to members.');
      setConfirming(null);
      await refresh();
    },
    onError: (message) => toast('Could not certify', 'error', message),
  });

  const broadcast = useMutation(() => portalApi.broadcastPollResult(communityId, poll.id), {
    onSuccess: async () => {
      toast('Result sent', 'success', 'Every active member has been emailed and notified.');
      setConfirming(null);
      await refresh();
    },
    onError: (message) => toast('Could not send the result', 'error', message),
  });

  return (
    <>
      <PageHeader
        title={poll.title}
        subtitle={poll.question}
        breadcrumb={
          <Link
            href={'/governance' as Route}
            className="inline-flex items-center gap-1 hover:text-navy-900"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Governance
          </Link>
        }
        actions={
          <span className="flex flex-wrap items-center gap-2">
            <StatusBadge status={poll.status.toLowerCase()} />
            {poll.certifiedAt ? <Badge tone="green">Certified</Badge> : null}
          </span>
        }
      />

      {/* What was decided, before the evidence for it. */}
      <Outcome poll={poll} />

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Stat
          label="Votes cast"
          value={poll.totalVotes}
          hint={`of ${poll.eligibleCount} eligible`}
          icon={<Users className="h-4 w-4" />}
        />
        <Stat label="Turnout" value={`${poll.turnout}%`} />
        <Stat
          label={open ? 'Closes' : 'Closed'}
          value={date(poll.closesAt)}
          hint={open ? `opened ${date(poll.opensAt)}` : undefined}
        />
      </div>

      <Card className="mt-6">
        <CardHeader
          title="Full count"
          subtitle={
            open
              ? 'Live — this moves as members vote'
              : poll.isAnonymous
                ? 'Anonymous ballot: individual votes stay hidden'
                : 'Final'
          }
        />
        <div className="space-y-4 p-5">
          {poll.options.map((option) => {
            const share = poll.totalVotes > 0 ? (option.votes / poll.totalVotes) * 100 : 0;
            const leads = !open && poll.outcome.kind === 'WON' && poll.outcome.label === option.label;
            return (
              <div key={option.id}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="flex items-center gap-1.5 text-[13.5px] text-navy-900">
                    {leads ? <Trophy className="h-3.5 w-3.5 text-green-600" /> : null}
                    <span className={leads ? 'font-semibold' : undefined}>{option.label}</span>
                  </span>
                  <span className="tnum shrink-0 text-[13px] text-slate-600">
                    {option.votes} {option.votes === 1 ? 'vote' : 'votes'} ({Math.round(share)}%)
                  </span>
                </div>
                <ProgressBar className="mt-1.5" value={share} tone={leads ? 'brand' : 'navy'} />
                {/* Named voters, where the ballot is not anonymous. A
                    cooperative that votes openly is entitled to its record. */}
                {option.voters && option.voters.length > 0 ? (
                  <p className="mt-1.5 text-[12px] leading-5 text-slate-500">
                    {option.voters.join(', ')}
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>

        <dl className="grid grid-cols-2 gap-4 border-t border-slate-100 p-5 sm:grid-cols-4">
          <KV label="Type">{humanise(poll.kind)}</KV>
          <KV label="Who could vote">{humanise(poll.eligibility)}</KV>
          <KV label="Ballot">{poll.isAnonymous ? 'Anonymous' : 'Open'}</KV>
          <KV label="Certified">
            {!poll.isBinding ? 'Advisory' : poll.certifiedAt ? date(poll.certifiedAt) : 'Not yet'}
          </KV>
        </dl>
      </Card>

      <Card className="mt-6">
        <CardHeader
          title="Put it on record"
          subtitle="File the result, and tell the members what they decided"
        />
        <div className="flex flex-wrap items-center gap-3 p-5">
          {/* A plain link, not a fetch: the browser downloads the bytes the
              proxy forwards, so nothing has to be held in memory here. */}
          <Button
            variant="secondary"
            icon={<Download className="h-4 w-4" />}
            onClick={() => window.open(portalApi.pollResultPdfUrl(communityId, poll.id), '_blank')}
          >
            Download PDF
          </Button>

          {/* A poll binds nobody, so there is nothing to certify. */}
          {poll.isBinding && poll.status === 'CLOSED' && !poll.certifiedAt ? (
            <Button
              variant="secondary"
              icon={<Gavel className="h-4 w-4" />}
              onClick={() => setConfirming('certify')}
            >
              Certify the result
            </Button>
          ) : null}

          <Button
            icon={<Mail className="h-4 w-4" />}
            disabled={open}
            onClick={() => setConfirming('broadcast')}
          >
            Email every member
          </Button>

          <p className="text-[12.5px] text-slate-500">
            {open
              ? 'Sending while voting is open would let members see the score before taking their turn.'
              : !poll.isBinding
                ? 'A poll is advisory, so the document says so rather than claiming a decision.'
                : poll.certifiedAt
                  ? 'The PDF carries the certification.'
                  : 'The PDF is marked as an uncertified tally until you certify it.'}
          </p>
        </div>
      </Card>

      <ConfirmDialog
        open={confirming === 'certify'}
        onClose={() => setConfirming(null)}
        onConfirm={() => certify.run()}
        loading={certify.pending}
        title="Certify this result?"
        confirmLabel="Certify"
        body="Certification makes this the community's official record of the vote. The count is already final; this is the statement that it was checked."
      />

      <ConfirmDialog
        open={confirming === 'broadcast'}
        onClose={() => setConfirming(null)}
        onConfirm={() => broadcast.run()}
        loading={broadcast.pending}
        title={`Email the ${noun} result to all ${poll.eligibleCount} members?`}
        confirmLabel="Send it"
        body={
          poll.certifiedAt
            ? 'Every active member gets the result by email, with the full document attached, and in the app.'
            : 'This result has not been certified yet. Members will be told what the count was, but not that it has been checked — you may want to certify first.'
        }
      />
    </>
  );
}

/** The decision, said once and plainly. */
function Outcome({ poll }: { poll: PollDetail }) {
  const { outcome } = poll;

  if (outcome.kind === 'NO_VOTES') {
    return (
      <Callout tone="warning" title="No votes were cast">
        {poll.status === 'OPEN'
          ? 'Nobody has voted yet.'
          : 'The ballot closed without a single vote. Nothing was decided.'}
      </Callout>
    );
  }

  // A tie is the case that gets got wrong. It is not a result, and the page
  // has to say so rather than show the first of them as leading.
  if (outcome.kind === 'TIE') {
    return (
      <Callout tone="warning" title={`Tied — ${outcome.label}`}>
        <span className="flex items-center gap-1.5">
          <Minus className="h-3.5 w-3.5" />
          {outcome.votes} votes each ({outcome.share}%). Nothing carried. Your constitution will
          say how a tie is broken — usually a casting vote or a re-run.
        </span>
      </Callout>
    );
  }

  return (
    <Callout
      tone={outcome.kind === 'WON' && poll.isBinding ? 'success' : 'info'}
      // The verb comes from the API so the page and the PDF cannot describe
      // the same result differently.
      title={`${outcome.label} ${outcome.verb}`}
    >
      {outcome.votes} of {poll.totalVotes} votes ({outcome.share}%)
      {outcome.kind === 'LEADING'
        ? ' — voting is still open, so this is not final.'
        : !poll.isBinding
          ? ' — a poll is advisory and binds nobody.'
          : poll.certifiedAt
            ? ' — certified.'
            : ' — not yet certified.'}
    </Callout>
  );
}
