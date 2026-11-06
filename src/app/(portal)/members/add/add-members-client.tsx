'use client';

import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import {
  AlertCircle,
  CheckCircle2,
  FileUp,
  Mail,
  MailCheck,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import {
  Badge,
  Button,
  LinkButton,
  Callout,
  Card,
  CardHeader,
  Field,
  Input,
  PageHeader,
  Segmented,
  Textarea,
} from '@/components/ui';
import { useMutation } from '@/hooks/use-query';
import { useCommunityId } from '@/components/providers/session-provider';
import { useToast } from '@/components/providers/toast-provider';
import { portalApi } from '@/services/portal';
import type { InviteOutcome, InviteResult } from '@/types';

type Mode = 'single' | 'list' | 'csv';

/** Matches the backend's own validation so obvious typos never leave the page. */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** The API's own cap — mirrored here so a 600-row CSV fails before the request. */
const MAX_BULK = 500;

/**
 * Pulls addresses out of anything an officer is likely to paste or upload:
 * commas, semicolons, newlines, tabs, and `Name <a@b.com>` forms all work,
 * as does a CSV with a header row and other columns alongside the email.
 */
function parseEmails(raw: string): string[] {
  const seen = new Set<string>();
  for (const token of raw.split(/[\s,;]+/)) {
    const cleaned = token.replace(/^[<"']+|[>"',]+$/g, '').trim().toLowerCase();
    if (cleaned && EMAIL.test(cleaned)) seen.add(cleaned);
  }
  return [...seen];
}

const OUTCOME_COPY: Record<
  InviteOutcome['status'],
  { label: string; tone: 'green' | 'navy' | 'amber' | 'red'; blurb: string }
> = {
  INVITED: { label: 'Invited', tone: 'green', blurb: 'Invitation sent.' },
  ALREADY_MEMBER: { label: 'Already a member', tone: 'navy', blurb: 'No invitation needed.' },
  ALREADY_INVITED: { label: 'Already invited', tone: 'amber', blurb: 'Still waiting on a reply.' },
  INVALID: { label: 'Not sent', tone: 'red', blurb: 'Check the address.' },
};

export function AddMembersClient() {
  const communityId = useCommunityId();
  const { toast } = useToast();
  const fileInput = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<Mode>('single');
  const [single, setSingle] = useState('');
  const [bulk, setBulk] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [result, setResult] = useState<InviteResult | null>(null);

  const raw = mode === 'single' ? single : bulk;
  const emails = useMemo(() => parseEmails(raw), [raw]);

  // Only flagged once something has been typed, so the field is not red on arrival.
  const singleInvalid = mode === 'single' && single.trim().length > 0 && emails.length === 0;
  const tooMany = emails.length > MAX_BULK;

  const invite = useMutation((list: string[]) => portalApi.inviteCommunityMembers(communityId, list), {
    onSuccess: (res) => {
      setResult(res);
      setSingle('');
      setBulk('');
      setFileName(null);
      toast(
        res.invited === 0 ? 'Nothing to send' : `${res.invited} invitation${res.invited === 1 ? '' : 's'} sent`,
        res.invited === 0 ? 'info' : 'success',
        res.invited === 0
          ? 'Everyone on that list was already a member or already invited.'
          : 'They will be asked to accept before joining.',
      );
    },
    onError: (message) => toast('Could not send invitations', 'error', message),
  });

  async function onFile(file: File) {
    setFileError(null);
    // Read client-side: the API only ever needs the addresses, so the rest of
    // the spreadsheet never leaves the officer's machine.
    const text = await file.text();
    const found = parseEmails(text);
    if (found.length === 0) {
      setFileError('No email addresses found in that file.');
      setFileName(null);
      return;
    }
    setFileName(file.name);
    setBulk(found.join('\n'));
  }

  const canSend = emails.length > 0 && !tooMany && !invite.pending;

  return (
    <>
      <PageHeader
        title="Add new member"
        subtitle="Invite by email — nobody is added until they accept"
        breadcrumb={
          <Link href={'/members' as Route} className="hover:text-navy-700">
            Members
          </Link>
        }
        actions={
          <LinkButton variant="secondary" size="sm" href={'/members/requests' as Route}>
            Pending members
          </LinkButton>
        }
      />

      <Callout tone="info" title="What happens next">
        If the address already belongs to a Rendi account, they get an in-app invitation and join
        the moment they accept — no officer review afterwards, because you invited them. If there
        is no account yet, they are emailed a link to download the app and are prompted to join
        once they have registered.
      </Callout>

      <Card>
        <CardHeader
          title="Who are you inviting?"
          subtitle="One person, a pasted list, or a CSV export"
          action={
            <Segmented<Mode>
              label="How to add"
              size="sm"
              value={mode}
              onChange={(next) => {
                setMode(next);
                setFileError(null);
              }}
              options={[
                { value: 'single', label: 'One person' },
                { value: 'list', label: 'Paste a list' },
                { value: 'csv', label: 'CSV file' },
              ]}
            />
          }
        />

        <div className="space-y-4 p-5">
          {mode === 'single' && (
            <Field
              label="Email address"
              htmlFor="invite-email"
              required
              error={singleInvalid && 'That does not look like an email address.'}
              hint="We will check whether they already have a Rendi account."
            >
              <Input
                id="invite-email"
                type="email"
                autoComplete="off"
                placeholder="member@example.com"
                value={single}
                invalid={singleInvalid}
                onChange={(event) => setSingle(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && canSend) void invite.run(emails);
                }}
              />
            </Field>
          )}

          {mode === 'list' && (
            <Field
              label="Email addresses"
              htmlFor="invite-emails"
              required
              hint={`Separate with commas, spaces or new lines. Up to ${MAX_BULK} at a time.`}
            >
              <Textarea
                id="invite-emails"
                rows={8}
                placeholder={'ada@example.com\nchidi@example.com, ngozi@example.com'}
                value={bulk}
                onChange={(event) => setBulk(event.target.value)}
              />
            </Field>
          )}

          {mode === 'csv' && (
            <Field
              label="CSV file"
              hint="Any CSV with an email column works — headers and extra columns are ignored."
              error={fileError}
            >
              <div className="flex flex-wrap items-center gap-3">
                <input
                  ref={fileInput}
                  type="file"
                  accept=".csv,.txt,text/csv,text/plain"
                  className="sr-only"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void onFile(file);
                    event.target.value = '';
                  }}
                />
                <Button variant="secondary" icon={<FileUp className="h-4 w-4" />} onClick={() => fileInput.current?.click()}>
                  Choose a file
                </Button>
                {fileName && (
                  <span className="inline-flex items-center gap-1.5 text-[13px] text-slate-600">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    {fileName}
                    <button
                      type="button"
                      aria-label="Remove file"
                      className="rounded p-0.5 text-slate-400 hover:text-slate-700 focus-ring"
                      onClick={() => {
                        setFileName(null);
                        setBulk('');
                      }}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </span>
                )}
              </div>
            </Field>
          )}

          {mode !== 'single' && emails.length > 0 && (
            <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
              <p className="text-[12.5px] font-medium text-navy-900">
                {emails.length} unique address{emails.length === 1 ? '' : 'es'} found
                {tooMany && (
                  <span className="ml-1.5 font-normal text-red-600">
                    — {MAX_BULK} is the most we can send at once.
                  </span>
                )}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {emails.slice(0, 40).map((email) => (
                  <span
                    key={email}
                    className="rounded-md bg-white px-2 py-0.5 text-[12px] text-slate-600 ring-1 ring-slate-200"
                  >
                    {email}
                  </span>
                ))}
                {emails.length > 40 && (
                  <span className="px-1 py-0.5 text-[12px] text-slate-500">
                    +{emails.length - 40} more
                  </span>
                )}
              </div>
            </div>
          )}

          {invite.error && (
            <Callout tone="danger" title="Could not send">
              {invite.error}
            </Callout>
          )}

          <div className="flex items-center gap-3 border-t border-slate-200 pt-4">
            <Button icon={<Mail className="h-4 w-4" />} loading={invite.pending} disabled={!canSend} onClick={() => invite.run(emails)}>
              {emails.length > 1 ? `Send ${emails.length} invitations` : 'Send invitation'}
            </Button>
            <p className="text-[12.5px] text-slate-500">
              Invitations expire after 30 days.
            </p>
          </div>
        </div>
      </Card>

      {result && <InviteSummary result={result} />}
    </>
  );
}

/**
 * The per-address outcome. A bulk send is deliberately partial-tolerant on the
 * API, so the officer needs to see which rows did nothing and why — a bare
 * "sent" count hides the duplicates and typos.
 */
function InviteSummary({ result }: { result: InviteResult }) {
  const grouped = useMemo(() => {
    const order: InviteOutcome['status'][] = ['INVITED', 'ALREADY_INVITED', 'ALREADY_MEMBER', 'INVALID'];
    return order
      .map((status) => ({ status, rows: result.outcomes.filter((o) => o.status === status) }))
      .filter((group) => group.rows.length > 0);
  }, [result]);

  return (
    <Card>
      <CardHeader
        title="Result"
        subtitle={`${result.invited} of ${result.outcomes.length} address${result.outcomes.length === 1 ? '' : 'es'} invited`}
        action={
          <LinkButton variant="ghost" size="sm" href={'/members/requests' as Route}>
            View pending
          </LinkButton>
        }
      />
      <div className="divide-y divide-slate-100">
        {grouped.map((group) => {
          const copy = OUTCOME_COPY[group.status];
          return (
            <div key={group.status} className="p-4">
              <div className="flex items-center gap-2">
                {group.status === 'INVALID' ? (
                  <AlertCircle className="h-4 w-4 text-red-500" />
                ) : group.status === 'ALREADY_MEMBER' ? (
                  <UserCheck className="h-4 w-4 text-navy-500" />
                ) : group.status === 'INVITED' ? (
                  <MailCheck className="h-4 w-4 text-green-600" />
                ) : (
                  <Users className="h-4 w-4 text-amber-500" />
                )}
                <span className="text-[13px] font-semibold text-navy-900">{copy.label}</span>
                <Badge tone={copy.tone}>{group.rows.length}</Badge>
                <span className="text-[12.5px] text-slate-500">{copy.blurb}</span>
              </div>
              <ul className="mt-2 space-y-1 pl-6">
                {group.rows.map((row) => (
                  <li key={row.email} className="flex flex-wrap items-baseline gap-2 text-[12.5px]">
                    <span className="font-medium text-slate-700">{row.email}</span>
                    {group.status === 'INVITED' && (
                      <span className="text-slate-500">
                        {row.hasAccount ? 'notified in the app' : 'emailed a download link'}
                      </span>
                    )}
                    {row.reason && <span className="text-slate-500">{row.reason}</span>}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
