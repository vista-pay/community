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
  Checkbox,
  Field,
  Input,
  PageHeader,
  Segmented,
  Select,
  Textarea,
} from '@/components/ui';
import { useMutation, useQuery } from '@/hooks/use-query';
import { useCommunityId } from '@/components/providers/session-provider';
import { useToast } from '@/components/providers/toast-provider';
import { portalApi, type InvitePlacement } from '@/services/portal';
import type {
  BranchesOverview,
  BranchPost,
  CommunityRole,
  ExistingMemberInvite,
  InviteOutcome,
  InviteResult,
} from '@/types';

type Mode = 'single' | 'list' | 'csv';
type MemberKind = 'new' | 'existing';

type ExistingCsvRow = ExistingMemberInvite & { row: number; error?: string };

const EXISTING_CSV_HEADER = 'full_name,email,phone,date_joined,member_code';

function parseExistingMembersCsv(raw: string): ExistingCsvRow[] {
  const lines = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0]!.split(',').map((cell) => cell.trim().toLowerCase());
  const column = (names: string[]) => headers.findIndex((header) => names.includes(header));
  const indexes = {
    fullName: column(['full_name', 'name', 'full name']),
    email: column(['email', 'email_address']),
    phone: column(['phone', 'phone_number', 'mobile']),
    dateJoined: column(['date_joined', 'joined_at', 'join_date']),
    memberCode: column(['member_code', 'code', 'member id']),
  };
  if (Object.values(indexes).some((index) => index < 0)) return [];

  return lines.slice(1).map((line, index) => {
    const cells = line.split(',').map((cell) => cell.trim().replace(/^"|"$/g, ''));
    const item: ExistingCsvRow = {
      row: index + 2,
      fullName: cells[indexes.fullName] ?? '',
      email: (cells[indexes.email] ?? '').toLowerCase(),
      phone: cells[indexes.phone] ?? '',
      dateJoined: cells[indexes.dateJoined] ?? '',
      memberCode: cells[indexes.memberCode] ?? '',
    };
    if (!item.fullName || !EMAIL.test(item.email) || !item.phone || !item.dateJoined || !item.memberCode) {
      item.error = 'All five fields are required and the email must be valid.';
    } else if (new Date(item.dateJoined) > new Date()) {
      item.error = 'Date joined cannot be in the future.';
    }
    return item;
  });
}

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
  DELIVERY_FAILED: {
    label: 'Email failed',
    tone: 'red',
    blurb: 'The invitation was not delivered. You can try again.',
  },
};

/** What to tell the officer about where the people they just invited will land. */
function placementNote(branchName: string | undefined, withSeat: boolean): string {
  if (!branchName) return 'They will be asked to accept before joining.';
  if (withSeat) {
    return `They join ${branchName} with their seat as soon as they sign in — a seat invitation is taken up by taking up the account.`;
  }
  return `They will be asked to accept, and land in ${branchName} when they do.`;
}

export function AddMembersClient() {
  const communityId = useCommunityId();
  const { toast } = useToast();
  const fileInput = useRef<HTMLInputElement>(null);
  const existingFileInput = useRef<HTMLInputElement>(null);

  const [memberKind, setMemberKind] = useState<MemberKind>('new');
  const [mode, setMode] = useState<Mode>('single');
  const [single, setSingle] = useState('');
  const [bulk, setBulk] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [result, setResult] = useState<InviteResult | null>(null);
  const [existingMode, setExistingMode] = useState<'single' | 'csv'>('single');
  const [existing, setExisting] = useState<ExistingMemberInvite>({
    fullName: '', email: '', phone: '', dateJoined: '', memberCode: '',
  });
  const [existingRows, setExistingRows] = useState<ExistingCsvRow[]>([]);
  const [existingFileName, setExistingFileName] = useState<string | null>(null);
  const [existingFileError, setExistingFileError] = useState<string | null>(null);

  /**
   * Where these invitations land.
   *
   * Asked here rather than left for afterwards: an officer importing a
   * register knows which chapter each batch belongs to, and placing people
   * later leaves a window where everybody is a member of nowhere. The whole
   * block is hidden for a community with no branches, so nothing changes for
   * one that does not use them.
   */
  const { data: branchOverview } = useQuery<BranchesOverview | null>(
    () => (communityId ? portalApi.branches(communityId) : Promise.resolve(null)),
    [communityId],
    { enabled: Boolean(communityId) },
  );
  const { data: roles } = useQuery<CommunityRole[] | null>(
    () => (communityId ? portalApi.roles(communityId) : Promise.resolve(null)),
    [communityId],
    { enabled: Boolean(communityId) },
  );
  const openBranches = (branchOverview?.branches ?? []).filter((branch) => branch.isActive);
  const branchRoles = (roles ?? []).filter((role) => role.isBranchRole);
  const [branchId, setBranchId] = useState('');
  const [asOfficer, setAsOfficer] = useState(false);
  const [branchPost, setBranchPost] = useState<BranchPost>('STAFF');
  const [branchRoleId, setBranchRoleId] = useState('');
  const [branchTitle, setBranchTitle] = useState('');

  // Built fresh on each render and read through the mutation's action ref, so
  // it is always the placement currently on screen.
  const placement: InvitePlacement = branchId
    ? {
        branchId,
        ...(asOfficer && branchRoleId
          ? {
              branchPost,
              branchRoleId,
              ...(branchTitle.trim() ? { branchTitle: branchTitle.trim() } : {}),
            }
          : {}),
      }
    : {};

  const raw = mode === 'single' ? single : bulk;
  const emails = useMemo(() => parseEmails(raw), [raw]);

  // Only flagged once something has been typed, so the field is not red on arrival.
  const singleInvalid = mode === 'single' && single.trim().length > 0 && emails.length === 0;
  const tooMany = emails.length > MAX_BULK;

  const invite = useMutation((list: string[]) => portalApi.inviteCommunityMembers(communityId, list, placement), {
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
          : placementNote(openBranches.find((b) => b.id === branchId)?.name, asOfficer && Boolean(branchRoleId)),
      );
    },
    onError: (message) => toast('Could not send invitations', 'error', message),
  });

  const inviteExisting = useMutation(
    (members: ExistingMemberInvite[]) =>
      portalApi.inviteExistingCommunityMembers(communityId, members, placement),
    {
      onSuccess: (res) => {
        setResult(res);
        setExisting({ fullName: '', email: '', phone: '', dateJoined: '', memberCode: '' });
        setExistingRows([]);
        setExistingFileName(null);
        toast(
          res.invited === 0 ? 'Nothing to send' : `${res.invited} invitation${res.invited === 1 ? '' : 's'} sent`,
          res.invited === 0 ? 'info' : 'success',
          res.invited === 0
            ? 'Check the result below for duplicate members or member codes.'
            : `Their historical membership details will be applied when they accept.${
                branchId ? ` ${placementNote(openBranches.find((b) => b.id === branchId)?.name, false)}` : ''
              }`,
        );
      },
      onError: (message) => toast('Could not import members', 'error', message),
    },
  );

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

  async function onExistingFile(file: File) {
    setExistingFileError(null);
    const rows = parseExistingMembersCsv(await file.text());
    if (!rows.length) {
      setExistingFileError(`Use these columns: ${EXISTING_CSV_HEADER}`);
      setExistingFileName(null);
      setExistingRows([]);
      return;
    }
    setExistingFileName(file.name);
    setExistingRows(rows);
  }

  function downloadExistingTemplate() {
    const csv = `${EXISTING_CSV_HEADER}\nAdaeze Okafor,adaeze@example.com,+2348012345678,2021-03-15,RND-0001`;
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'existing-members-template.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const canSend = emails.length > 0 && !tooMany && !invite.pending;
  const existingSingleValid =
    existing.fullName.trim().length > 0 && EMAIL.test(existing.email.trim()) &&
    existing.phone.trim().length > 0 && existing.dateJoined.length > 0 &&
    existing.memberCode.trim().length > 0 && new Date(existing.dateJoined) <= new Date();
  const validExistingRows = existingRows.filter((row) => !row.error);
  const canSendExisting = existingMode === 'single'
    ? existingSingleValid && !inviteExisting.pending
    : validExistingRows.length > 0 && existingRows.length <= MAX_BULK && !inviteExisting.pending;

  return (
    <>
      <PageHeader
        title="Add members"
        subtitle="Invite a new member or bring your existing register into Rendi"
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
        {branchId && (
          <>
            {' '}
            Either way they land in{' '}
            <b>{openBranches.find((branch) => branch.id === branchId)?.name}</b>
            {asOfficer && branchRoleId ? ', holding the seat you chose' : ''} — there is no second
            step to remember.
          </>
        )}
      </Callout>

      <Card className="p-4">
        <Segmented<MemberKind>
          label="Member type"
          value={memberKind}
          onChange={(next) => {
            setMemberKind(next);
            setResult(null);
          }}
          options={[
            { value: 'new', label: 'New member' },
            { value: 'existing', label: 'Existing member' },
          ]}
        />
        <p className="mt-2 text-[13px] text-slate-600">
          {memberKind === 'new'
            ? 'Invite someone who is joining this community now.'
            : 'Bring a member from your existing register into Rendi without losing their original details.'}
        </p>
      </Card>

      {openBranches.length > 0 && (
        <Card>
          <CardHeader
            title="Which branch?"
            subtitle="They land there when they take the invitation up — you do not have to place them afterwards"
          />
          <div className="space-y-4 px-5 pb-5">
            <Field
              label="Branch"
              htmlFor="inv-branch"
              optional
              hint="Leave unset to admit them to the community and place them later."
            >
              <Select
                id="inv-branch"
                value={branchId}
                onChange={(e) => {
                  setBranchId(e.target.value);
                  if (!e.target.value) setAsOfficer(false);
                }}
              >
                <option value="">No branch — place them later</option>
                {openBranches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {[branch.name, branch.code, [branch.city, branch.state].filter(Boolean).join(', ')]
                      .filter(Boolean)
                      .join(' · ')}
                  </option>
                ))}
              </Select>
            </Field>

            {branchId && (
              <Checkbox
                checked={asOfficer}
                onChange={setAsOfficer}
                label="They are joining the branch leadership"
                description="Give them a seat as well as a place. Leave this off for an ordinary member of the branch."
              />
            )}

            {branchId && asOfficer && (
              <div className="grid gap-4 rounded-xl border border-slate-200 p-3.5 sm:grid-cols-2">
                <Field label="Post" htmlFor="inv-post" required>
                  <Select
                    id="inv-post"
                    value={branchPost}
                    onChange={(e) => setBranchPost(e.target.value as BranchPost)}
                  >
                    <option value="STAFF">Branch staff</option>
                    <option value="MANAGER">Branch manager — replaces whoever runs it now</option>
                  </Select>
                </Field>
                <Field
                  label="Role that bounds the seat"
                  htmlFor="inv-role"
                  required
                  hint="Their authority applies inside that branch and nowhere else."
                >
                  <Select
                    id="inv-role"
                    value={branchRoleId}
                    onChange={(e) => setBranchRoleId(e.target.value)}
                  >
                    <option value="">Choose a role…</option>
                    {[...branchRoles, ...(roles ?? []).filter((role) => !role.isBranchRole && !role.isProtected)].map(
                      (role) => (
                        <option key={role.id} value={role.id}>
                          {role.label}
                          {role.isBranchRole ? '' : ' (community-wide post, bounded there)'}
                        </option>
                      ),
                    )}
                  </Select>
                </Field>
                <Field label="Title at the branch" htmlFor="inv-title" optional className="sm:col-span-2">
                  <Input
                    id="inv-title"
                    value={branchTitle}
                    onChange={(e) => setBranchTitle(e.target.value)}
                    placeholder="Branch Secretary"
                  />
                </Field>
                <p className="text-[13px] leading-relaxed text-slate-500 sm:col-span-2">
                  A seat invitation is taken up by signing in — somebody recruited to run a branch
                  has already accepted the job. An invitation without a seat still asks before
                  joining them to anything.
                </p>
              </div>
            )}
          </div>
        </Card>
      )}

      <Card>
        <CardHeader
          title={memberKind === 'new' ? 'Who are you inviting?' : 'Add existing members'}
          subtitle={memberKind === 'new' ? 'One person, a pasted list, or a CSV export' : 'One person or a complete CSV register'}
          action={
            memberKind === 'new' ? <Segmented<Mode>
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
            /> : <Segmented<'single' | 'csv'>
              label="How to add"
              size="sm"
              value={existingMode}
              onChange={(next) => {
                setExistingMode(next);
                setExistingFileError(null);
              }}
              options={[
                { value: 'single', label: 'One person' },
                { value: 'csv', label: 'CSV file' },
              ]}
            />
          }
        />

        <div className="space-y-4 p-5">
          {memberKind === 'new' ? <>
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
          </> : <>
            {existingMode === 'single' ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Full name" htmlFor="existing-full-name" required>
                  <Input id="existing-full-name" autoComplete="name" placeholder="Adaeze Okafor" value={existing.fullName} onChange={(event) => setExisting((value) => ({ ...value, fullName: event.target.value }))} />
                </Field>
                <Field label="Email address" htmlFor="existing-email" required hint="The invitation is sent here immediately.">
                  <Input id="existing-email" type="email" autoComplete="email" placeholder="adaeze@example.com" value={existing.email} onChange={(event) => setExisting((value) => ({ ...value, email: event.target.value }))} />
                </Field>
                <Field label="Phone number" htmlFor="existing-phone" required>
                  <Input id="existing-phone" type="tel" autoComplete="tel" placeholder="+234 801 234 5678" value={existing.phone} onChange={(event) => setExisting((value) => ({ ...value, phone: event.target.value }))} />
                </Field>
                <Field label="Date joined" htmlFor="existing-date-joined" required hint="Their original date in your register.">
                  <Input id="existing-date-joined" type="date" max={new Date().toISOString().slice(0, 10)} value={existing.dateJoined} onChange={(event) => setExisting((value) => ({ ...value, dateJoined: event.target.value }))} />
                </Field>
                <Field label="Member code" htmlFor="existing-member-code" required hint="Must be unique in this community." className="sm:col-span-2">
                  <Input id="existing-member-code" placeholder="RND-0001" value={existing.memberCode} onChange={(event) => setExisting((value) => ({ ...value, memberCode: event.target.value }))} />
                </Field>
              </div>
            ) : (
              <>
                <Field label="Existing members CSV" required error={existingFileError} hint={`Required columns: ${EXISTING_CSV_HEADER}`}>
                  <div className="flex flex-wrap items-center gap-3">
                    <input ref={existingFileInput} type="file" accept=".csv,text/csv" className="sr-only" onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void onExistingFile(file);
                      event.target.value = '';
                    }} />
                    <Button variant="secondary" icon={<FileUp className="h-4 w-4" />} onClick={() => existingFileInput.current?.click()}>Choose CSV file</Button>
                    <Button variant="ghost" onClick={downloadExistingTemplate}>Download template</Button>
                    {existingFileName && <span className="text-[13px] text-slate-600">{existingFileName}</span>}
                  </div>
                </Field>
                {existingRows.length > 0 && (
                  <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
                    <p className="text-[12.5px] font-medium text-navy-900">
                      {validExistingRows.length} of {existingRows.length} rows ready
                    </p>
                    {existingRows.some((row) => row.error) && (
                      <ul className="mt-2 space-y-1 text-[12px] text-red-600">
                        {existingRows.filter((row) => row.error).slice(0, 10).map((row) => <li key={row.row}>Row {row.row}: {row.error}</li>)}
                      </ul>
                    )}
                  </div>
                )}
              </>
            )}

            {inviteExisting.error && <Callout tone="danger" title="Could not send">{inviteExisting.error}</Callout>}

            <div className="flex items-center gap-3 border-t border-slate-200 pt-4">
              <Button
                icon={<Mail className="h-4 w-4" />}
                loading={inviteExisting.pending}
                disabled={!canSendExisting}
                onClick={() => inviteExisting.run(existingMode === 'single' ? [existing] : validExistingRows.map((row) => ({
                  fullName: row.fullName,
                  email: row.email,
                  phone: row.phone,
                  dateJoined: row.dateJoined,
                  memberCode: row.memberCode,
                })))}
              >
                {existingMode === 'csv' && validExistingRows.length > 1 ? `Send ${validExistingRows.length} invitations` : 'Send invitation'}
              </Button>
              <p className="text-[12.5px] text-slate-500">Their details are applied after they accept.</p>
            </div>
          </>}
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
    const order: InviteOutcome['status'][] = [
      'INVITED',
      'ALREADY_INVITED',
      'ALREADY_MEMBER',
      'DELIVERY_FAILED',
      'INVALID',
    ];
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
