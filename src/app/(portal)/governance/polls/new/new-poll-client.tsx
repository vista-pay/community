'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Route } from 'next';
import { ArrowLeft, Plus, Vote, X } from 'lucide-react';
import {
  Button,
  Callout,
  Card,
  CardHeader,
  Checkbox,
  Field,
  Input,
  PageHeader,
  RadioCard,
  Select,
  Textarea,
} from '@/components/ui';
import { useMutation } from '@/hooks/use-query';
import { useCommunityId } from '@/components/providers/session-provider';
import { useToast } from '@/components/providers/toast-provider';
import { portalApi } from '@/services/portal';

type Kind = 'POLL' | 'ELECTION' | 'RESOLUTION';

const KINDS: Array<{ value: Kind; label: string; blurb: string }> = [
  {
    value: 'RESOLUTION',
    label: 'Resolution',
    blurb: 'A motion the community adopts or rejects. Usually Yes / No / Abstain.',
  },
  {
    value: 'ELECTION',
    label: 'Election',
    blurb: 'Members choose between candidates for a post.',
  },
  {
    value: 'POLL',
    label: 'Poll',
    blurb: 'A question to gauge opinion, with no binding outcome.',
  },
];

/** What each kind usually asks, so the form starts somewhere sensible. */
const DEFAULT_OPTIONS: Record<Kind, string[]> = {
  RESOLUTION: ['Yes', 'No', 'Abstain'],
  ELECTION: ['', ''],
  POLL: ['', ''],
};

/** An ISO-local value for a datetime-local input, `days` from now. */
function inDays(days: number): string {
  const at = new Date();
  at.setDate(at.getDate() + days);
  at.setMinutes(0, 0, 0);
  return new Date(at.getTime() - at.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

/**
 * Opening a ballot.
 *
 * A page rather than a dialog: what is asked, who may answer and when it
 * closes are all decisions that cannot be changed once a vote is cast, and
 * they deserve the room to be read before being made.
 */
export function NewPollClient() {
  const communityId = useCommunityId();
  const router = useRouter();
  const { toast } = useToast();

  const [kind, setKind] = useState<Kind>('RESOLUTION');
  const [title, setTitle] = useState('');
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState<string[]>(DEFAULT_OPTIONS.RESOLUTION);
  const [eligibility, setEligibility] = useState('ALL_ACTIVE');
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [opensAt, setOpensAt] = useState(inDays(0));
  const [closesAt, setClosesAt] = useState(inDays(7));

  const cleanOptions = useMemo(
    () => options.map((o) => o.trim()).filter(Boolean),
    [options],
  );
  const duplicated = useMemo(
    () => new Set(cleanOptions.map((o) => o.toLowerCase())).size !== cleanOptions.length,
    [cleanOptions],
  );
  const closesBeforeOpening = Boolean(opensAt && closesAt && closesAt <= opensAt);

  const create = useMutation(
    () =>
      portalApi.createPoll(communityId, {
        title: title.trim(),
        kind,
        question: question.trim(),
        options: cleanOptions,
        eligibility,
        isAnonymous,
        opensAt: new Date(opensAt).toISOString(),
        closesAt: new Date(closesAt).toISOString(),
      }),
    {
      onSuccess: () => {
        toast('Ballot opened', 'success', 'Members can vote from the date you set.');
        router.push('/governance' as Route);
        router.refresh();
      },
      onError: (message) => toast('Could not open the ballot', 'error', message),
    },
  );

  const valid =
    title.trim().length > 2 &&
    question.trim().length > 4 &&
    cleanOptions.length >= 2 &&
    !duplicated &&
    !closesBeforeOpening;

  return (
    <>
      <PageHeader
        title="Open a ballot"
        subtitle="What is asked, who may answer, and when it closes"
        breadcrumb={
          <Link
            href={'/governance' as Route}
            className="inline-flex items-center gap-1 hover:text-navy-900"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Governance
          </Link>
        }
      />

      <Callout tone="info" title="None of this can change once someone votes">
        A ballot is a record. The question, the options and who may answer are fixed the moment
        the first vote lands, because changing them afterwards would mean votes cast against a
        different question.
      </Callout>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-6">
          <Card>
            <CardHeader title="What kind of ballot?" />
            <div className="grid gap-3 p-5 sm:grid-cols-3" role="radiogroup" aria-label="Ballot kind">
              {KINDS.map((option) => (
                <RadioCard
                  key={option.value}
                  selected={kind === option.value}
                  onSelect={() => {
                    setKind(option.value);
                    // Only replace options the officer has not touched, so
                    // switching kind by accident cannot discard their work.
                    const untouched =
                      options.join('|') === DEFAULT_OPTIONS[kind].join('|') ||
                      cleanOptions.length === 0;
                    if (untouched) setOptions(DEFAULT_OPTIONS[option.value]);
                  }}
                  title={option.label}
                  description={option.blurb}
                />
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader title="The question" />
            <div className="space-y-4 p-5">
              <Field label="Title" htmlFor="poll-title" required hint="How it appears in the list">
                <Input
                  id="poll-title"
                  value={title}
                  placeholder="e.g. Adoption of the 2026 accounts"
                  onChange={(event) => setTitle(event.target.value)}
                />
              </Field>

              <Field
                label="What are members being asked?"
                htmlFor="poll-question"
                required
                hint="Write it so the answer is unambiguous a year from now."
              >
                <Textarea
                  id="poll-question"
                  rows={2}
                  value={question}
                  placeholder="Do you adopt the audited accounts as presented?"
                  onChange={(event) => setQuestion(event.target.value)}
                />
              </Field>

              <Field
                label="Options"
                required
                hint="At least two. Members pick exactly one."
                error={duplicated ? 'Two options are the same' : undefined}
              >
                <div className="space-y-2">
                  {options.map((option, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Input
                        value={option}
                        placeholder={index === 0 ? 'Yes' : index === 1 ? 'No' : 'Another option'}
                        aria-label={`Option ${index + 1}`}
                        onChange={(event) =>
                          setOptions((current) =>
                            current.map((o, i) => (i === index ? event.target.value : o)),
                          )
                        }
                      />
                      {options.length > 2 ? (
                        <button
                          type="button"
                          aria-label={`Remove option ${index + 1}`}
                          className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus-ring"
                          onClick={() =>
                            setOptions((current) => current.filter((_, i) => i !== index))
                          }
                        >
                          <X className="h-4 w-4" />
                        </button>
                      ) : null}
                    </div>
                  ))}
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={<Plus className="h-3.5 w-3.5" />}
                    onClick={() => setOptions((current) => [...current, ''])}
                  >
                    Add an option
                  </Button>
                </div>
              </Field>
            </div>
          </Card>

          <Card>
            <CardHeader title="Who votes, and when" />
            <div className="space-y-4 p-5">
              <Field label="Who may vote" htmlFor="poll-eligibility" required>
                <Select
                  id="poll-eligibility"
                  value={eligibility}
                  onChange={(event) => setEligibility(event.target.value)}
                >
                  <option value="ALL_ACTIVE">Every active member</option>
                  <option value="OFFICERS">Officers only</option>
                  <option value="SHAREHOLDERS">Shareholders only</option>
                </Select>
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Opens" htmlFor="poll-opens" required>
                  <Input
                    id="poll-opens"
                    type="datetime-local"
                    value={opensAt}
                    onChange={(event) => setOpensAt(event.target.value)}
                  />
                </Field>
                <Field
                  label="Closes"
                  htmlFor="poll-closes"
                  required
                  error={closesBeforeOpening ? 'It must close after it opens' : undefined}
                >
                  <Input
                    id="poll-closes"
                    type="datetime-local"
                    value={closesAt}
                    onChange={(event) => setClosesAt(event.target.value)}
                  />
                </Field>
              </div>

              <Checkbox
                checked={isAnonymous}
                onChange={setIsAnonymous}
                label="Anonymous ballot"
                description="Individual votes stay hidden — only the totals are shown, to officers and members alike. Leave it off and the result names who voted for what."
              />
            </div>
          </Card>

          <div className="flex items-center gap-3">
            <Button
              icon={<Vote className="h-4 w-4" />}
              loading={create.pending}
              disabled={!valid}
              onClick={() => create.run()}
            >
              Open the ballot
            </Button>
            <Button variant="ghost" onClick={() => router.back()}>
              Cancel
            </Button>
          </div>
        </div>

        {/* What members will see, before it is fixed. */}
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <Card>
            <CardHeader title="What members see" />
            <div className="p-5">
              <div className="rounded-xl border border-slate-200 p-4">
                <p className="text-[14px] font-semibold text-navy-900">
                  {title.trim() || 'Your ballot title'}
                </p>
                <p className="mt-1 text-[12.5px] leading-5 text-slate-600">
                  {question.trim() || 'The question members are answering.'}
                </p>
                <ul className="mt-3 space-y-1.5">
                  {(cleanOptions.length ? cleanOptions : ['Option one', 'Option two']).map(
                    (option) => (
                      <li
                        key={option}
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-[12.5px] text-navy-800"
                      >
                        {option}
                      </li>
                    ),
                  )}
                </ul>
              </div>
              <p className="mt-3 text-[12px] leading-5 text-slate-500">
                {isAnonymous
                  ? 'Votes are anonymous — nobody sees who chose what.'
                  : 'Votes are open — the result names who chose what.'}
              </p>
            </div>
          </Card>
        </aside>
      </div>
    </>
  );
}
