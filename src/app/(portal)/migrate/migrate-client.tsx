'use client';

import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  Check,
  Download,
  FileUp,
  Landmark,
  RefreshCw,
  Upload,
  Users,
  X,
} from 'lucide-react';
import {
  Badge,
  Button,
  Callout,
  Card,
  CardHeader,
  ConfirmDialog,
  DataTable,
  Field,
  Input,
  KV,
  LinkButton,
  PageHeader,
  Select,
  Stat,
  StatusBadge,
  Textarea,
} from '@/components/ui';
import { useMutation, useQuery } from '@/hooks/use-query';
import { useCommunityId } from '@/components/providers/session-provider';
import { useToast } from '@/components/providers/toast-provider';
import { portalApi } from '@/services/portal';
import { cn, date, money } from '@/lib/format';
import { downloadCsv } from '@/lib/csv';
import type { Route } from 'next';
import type { BatchPreview, MigrationStatus, RowRejection } from '@/types';
import { MIGRATION_STEPS, UPLOAD_KINDS, fieldOrder, productKindFor, stepIndex } from './steps';

/**
 * Bringing a community in from its previous system.
 *
 * A migration is a project revisited over weeks, not a form. So this screen
 * is stateful and resumable: it reads where the community got to and opens
 * there, rather than starting at step one every time.
 *
 * Nothing on this page writes anything until an officer has read a preview.
 */
export function MigrateClient({ initial }: { initial: MigrationStatus }) {
  const communityId = useCommunityId();
  const { toast } = useToast();

  const { data, refresh } = useQuery<MigrationStatus>(
    () => portalApi.migrationStatus(communityId),
    [communityId],
    { initial },
  );
  const status = data ?? initial;

  const [preview, setPreview] = useState<{ slug: string; label: string; result: BatchPreview } | null>(
    null,
  );
  const [discarding, setDiscarding] = useState(false);

  const live = useMemo(
    () => status.batches.find((b) => b.status === 'PREVIEW') ?? null,
    [status.batches],
  );

  /**
   * The preview to show: the one from this session's upload, or one rebuilt
   * from the waiting batch.
   *
   * Rebuilt because the screen is meant to be resumable. Without this, an
   * officer who reloads the page — or comes back tomorrow — loses the editor
   * and is left with a banner telling them rows were rejected but no way to
   * see or fix which.
   */
  const shown = useMemo(() => {
    if (preview) return preview;
    if (!live) return null;
    return {
      slug: live.kind.toLowerCase(),
      label: UPLOAD_KINDS.find((k) => k.kind === live.kind)?.label ?? 'Import',
      result: {
        batchId: live.id,
        kind: live.kind,
        rowCount: live.rowCount,
        accepted: live.acceptedRows,
        rejected: live.rejectedRows,
        rejections: live.rejections ?? [],
        totalAmount: live.totalAmount ?? '0.00',
        summary: `${live.acceptedRows} of ${live.rowCount} rows ready to import`,
      } satisfies BatchPreview,
    };
  }, [preview, live]);

  const upload = useMutation(
    (slug: 'members' | 'savings' | 'loans' | 'plans', label: string, csv: string, fileName: string) =>
      portalApi.previewMigration(communityId, slug, csv, fileName).then((result) => {
        setPreview({ slug, label, result });
        return result;
      }),
    {
      onSuccess: (result) => {
        if (result.accepted === 0) {
          toast('Nothing in that file could be used', 'error', 'Every row was rejected — see why below.');
        } else if (result.rejected > 0) {
          toast(`${result.accepted} rows ready`, 'info', `${result.rejected} need fixing first.`);
        } else {
          toast(`${result.accepted} rows ready`, 'success', 'Nothing was rejected.');
        }
        void refresh();
      },
      onError: (message) => toast('Could not read that file', 'error', message),
    },
  );

  const commit = useMutation(
    (batchId: string) => portalApi.commitMigrationBatch(communityId, batchId),
    {
      onSuccess: (result) => {
        toast(`${result.committed} rows imported`, 'success');
        setPreview(null);
        void refresh();
      },
      onError: (message) => toast('Could not apply the import', 'error', message),
    },
  );

  const discard = useMutation(
    (batchId: string) => portalApi.discardMigrationBatch(communityId, batchId),
    {
      onSuccess: () => {
        toast('Import discarded', 'info');
        setPreview(null);
        setDiscarding(false);
        void refresh();
      },
      onError: (message) => toast('Could not discard', 'error', message),
    },
  );

  const at = stepIndex(status.step);

  return (
    <>
      <PageHeader
        title="Migrate"
        subtitle="Bring your members and their records in from your previous system"
        actions={
          status.step === 'COMPLETE' ? (
            <Badge tone="green">Migration complete</Badge>
          ) : (
            <Badge tone="navy">Step {Math.min(at + 1, MIGRATION_STEPS.length)} of {MIGRATION_STEPS.length}</Badge>
          )
        }
      />

      {status.members.total === 0 ? (
        <Callout tone="info" title="Before you start">
          Create your savings products and loan offers first, so each balance has somewhere to go
          with the terms you set. Then upload your member list, then the balances. Nothing is
          written until you have seen a preview, and no money moves until you transfer it.
        </Callout>
      ) : null}

      <Stepper at={at} />

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Stat
          label="Members imported"
          value={status.members.total}
          hint={`${status.members.claimed} have claimed their record`}
          icon={<Users className="h-4 w-4" />}
        />
        <Stat
          label="Owed to members"
          value={money(status.positions.savingsOwed)}
          hint={`${money(status.positions.loansOut)} is out on loan`}
          icon={<Landmark className="h-4 w-4" />}
        />
        <Stat
          label="Still to transfer"
          value={money(status.funding.outstanding)}
          hint={status.funding.complete ? 'Fully funded' : `of ${money(status.funding.expectedCash)}`}
          tone={status.funding.complete ? 'positive' : 'warning'}
          icon={<Banknote className="h-4 w-4" />}
        />
      </div>

      {/* The reconciliation check. Its whole purpose is to be compared
          against their own bank statement before they trust anything else. */}
      {status.positions.total > 0 && !status.funding.complete ? (
        <Callout tone="warning" title="Check this against your bank statement" className="mt-6">
          Your records say you are holding{' '}
          <strong>{money(status.funding.expectedCash)}</strong> in cash —{' '}
          {money(status.positions.savingsOwed)} owed to members, less{' '}
          {money(status.positions.loansOut)} that is out with borrowers. If your own bank balance
          does not match that, your records are off and it is worth fixing before your members
          start arriving.
        </Callout>
      ) : null}

      {shown ? (
        <PreviewCard
          label={shown.label}
          slug={shown.slug}
          result={shown.result}
          committing={commit.pending}
          onApply={() => commit.run(shown.result.batchId)}
          onDiscard={() => setDiscarding(true)}
          onRechecked={(result) => {
            setPreview({ slug: shown.slug, label: shown.label, result });
            void refresh();
          }}
        />
      ) : (
        <UploadCards
          disabled={upload.pending}
          pending={upload.pending}
          onFile={(slug, label, csv, fileName) => void upload.run(slug, label, csv, fileName)}
        />
      )}

      {status.positions.total > 0 && !status.funding.complete ? (
        <FundingCard
          outstanding={status.funding.outstanding}
          onDone={refresh}
        />
      ) : null}

      {status.members.total > 0 ? <Arrivals status={status} /> : null}

      {status.batches.length > 0 ? <History status={status} /> : null}

      <ConfirmDialog
        open={discarding}
        onClose={() => setDiscarding(false)}
        onConfirm={() => {
          const id = shown?.result.batchId;
          if (id) void discard.run(id);
        }}
        loading={discard.pending}
        title="Discard this import?"
        confirmLabel="Discard"
        tone="danger"
        body="Nothing has been written yet, so nothing is lost. The attempt stays on record and you can upload the file again."
      />
    </>
  );
}

/** Where the community is in the sequence. */
function Stepper({ at }: { at: number }) {
  return (
    <ol className="mt-6 grid gap-px overflow-hidden rounded-xl bg-slate-200/70 sm:grid-cols-4">
      {MIGRATION_STEPS.map((step, index) => {
        const done = index < at;
        const current = index === at;
        return (
          <li
            key={step.step}
            className={cn('bg-white p-4', current && 'bg-brand-50/60', done && 'bg-slate-50')}
          >
            <span className="flex items-center gap-2">
              <span
                className={cn(
                  'flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold',
                  done && 'bg-green-600 text-white',
                  current && 'bg-brand-600 text-white',
                  !done && !current && 'bg-slate-200 text-slate-600',
                )}
              >
                {done ? <Check className="h-3 w-3" strokeWidth={3} /> : index + 1}
              </span>
              <span
                className={cn(
                  'text-[13px] font-semibold',
                  current ? 'text-brand-800' : done ? 'text-slate-500' : 'text-navy-900',
                )}
              >
                {step.title}
              </span>
            </span>
            <p className="mt-1 pl-7 text-[12px] leading-5 text-slate-500">{step.blurb}</p>
          </li>
        );
      })}
    </ol>
  );
}

/** The four file types, each with the columns it needs stated on the card. */
function UploadCards({
  disabled,
  pending,
  onFile,
}: {
  disabled: boolean;
  pending: boolean;
  onFile: (
    slug: 'members' | 'savings' | 'loans' | 'plans',
    label: string,
    csv: string,
    fileName: string,
  ) => void;
}) {
  return (
    <Card className="mt-6">
      <CardHeader
        title="Upload a file"
        subtitle="Checked and totalled before anything is written"
      />
      <div className="grid gap-px bg-slate-200/70 sm:grid-cols-2">
        {UPLOAD_KINDS.map((kind) => (
          <div key={kind.slug} className="bg-white p-5">
            <p className="text-[14px] font-semibold text-navy-900">{kind.label}</p>
            <p className="mt-1 font-mono text-[11.5px] leading-5 text-slate-500">{kind.columns}</p>
            <p className="mt-1.5 text-[12px] leading-5 text-slate-500">{kind.note}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <label className="inline-flex">
              <input
                type="file"
                accept=".csv,.txt,text/csv,text/plain"
                className="sr-only"
                disabled={disabled}
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  event.target.value = '';
                  if (!file) return;
                  // Read in the browser: the API only ever needs the text, so
                  // nothing else about the spreadsheet leaves the machine.
                  onFile(kind.slug, kind.label, await file.text(), file.name);
                }}
              />
              <span
                className={cn(
                  'inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-[13px] font-medium text-navy-800 transition hover:bg-slate-50',
                  disabled && 'cursor-not-allowed opacity-50 hover:bg-white',
                )}
              >
                {pending ? (
                  <Upload className="h-3.5 w-3.5 animate-pulse" />
                ) : (
                  <FileUp className="h-3.5 w-3.5" />
                )}
                Choose a CSV
              </span>
              </label>
              {/* The sample is the fastest answer to "what exactly goes in
                  this file?" — its rows demonstrate the formats that work,
                  which a list of column names cannot. */}
              <Button
                size="sm"
                variant="ghost"
                icon={<Download className="h-3.5 w-3.5" />}
                onClick={() => downloadCsv(`rendi-${kind.slug}-sample.csv`, kind.sample)}
              >
                Sample
              </Button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

/** The dry run: what would happen, and every row that would not. */
function PreviewCard({
  label,
  slug,
  result,
  committing,
  onApply,
  onDiscard,
  onRechecked,
}: {
  label: string;
  slug: string;
  result: BatchPreview;
  committing: boolean;
  onApply: () => void;
  onDiscard: () => void;
  onRechecked: (result: BatchPreview) => void;
}) {
  return (
    <Card className="mt-6">
      <CardHeader
        title={`${label} — nothing written yet`}
        subtitle={result.summary}
        action={
          <span className="flex gap-2">
            <Button
              size="sm"
              icon={<ArrowRight className="h-3.5 w-3.5" />}
              loading={committing}
              disabled={result.accepted === 0}
              onClick={onApply}
            >
              Apply {result.accepted} rows
            </Button>
            <Button size="sm" variant="ghost" icon={<X className="h-3.5 w-3.5" />} onClick={onDiscard}>
              Discard
            </Button>
          </span>
        }
      />
      <dl className="grid grid-cols-2 gap-4 border-b border-slate-100 px-5 py-4 sm:grid-cols-4">
        <KV label="Rows in the file">{result.rowCount}</KV>
        <KV label="Ready to import">{result.accepted}</KV>
        <KV label="Rejected">{result.rejected}</KV>
        <KV label="Total">{money(result.totalAmount)}</KV>
      </dl>

      {result.rejections.length > 0 ? (
        <RejectedRows
          batchId={result.batchId}
          slug={slug}
          rejections={result.rejections}
          onRechecked={onRechecked}
        />
      ) : null}
    </Card>
  );
}

/**
 * The rows that will not import, editable in place.
 *
 * Two different problems land in this table and they look identical to an
 * officer, so one control fixes both: either the row is wrong and the cells
 * need correcting, or the row is fine and something around it was missing —
 * a product that did not exist when the file went up. Re-check re-runs the
 * same validation against current state, so creating the product in another
 * tab and pressing Re-check is a complete fix with no editing at all.
 *
 * Sending someone back to a spreadsheet to correct two rows out of four
 * hundred, re-export and re-upload is a loop that gets abandoned.
 */
function RejectedRows({
  batchId,
  slug,
  rejections,
  onRechecked,
}: {
  batchId: string;
  slug: string;
  rejections: RowRejection[];
  onRechecked: (result: BatchPreview) => void;
}) {
  const communityId = useCommunityId();
  const { toast } = useToast();
  /** Edits by line, holding only the fields actually touched. */
  const [edits, setEdits] = useState<Record<number, Record<string, string>>>({});
  /** Which groups the officer has opened to edit row by row. */
  const [opened, setOpened] = useState<Record<string, boolean>>({});

  /**
   * Rejections with their cells guaranteed present.
   *
   * A batch uploaded before rows could be edited here has rejections with no
   * cells at all, and one waiting in the database outlives the deploy that
   * added them. Those rows fall through to the not-fixable-here list, which
   * is the honest outcome: there is nothing to edit, and re-uploading is
   * genuinely the only way to correct them.
   */
  const rows = useMemo(
    () => rejections.map((row) => ({ ...row, cells: row.cells ?? {} })),
    [rejections],
  );

  const editable = rows.filter((r) => Object.keys(r.cells).length > 0);
  const fixed = rows.filter((r) => Object.keys(r.cells).length === 0);

  /**
   * Nothing carries cells, so this import was uploaded before rows could be
   * edited here and kept nothing to re-check against. Discarding and
   * uploading again is genuinely the only way forward, so say that rather
   * than offer a button that errors.
   */
  const stale = rows.length > 0 && editable.length === 0;

  /**
   * Rejections grouped by reason.
   *
   * Four hundred rows missing the same product is one problem, not four
   * hundred. Listing them individually buries the single action that fixes
   * them all under a page of identical forms.
   */
  const groups = useMemo(() => {
    const byReason = new Map<string, typeof editable>();
    for (const row of editable) {
      const list = byReason.get(row.reason) ?? [];
      list.push(row);
      byReason.set(row.reason, list);
    }
    return [...byReason.entries()].map(([reason, members]) => ({
      reason,
      rows: members,
      /** The product this group is complaining about, if it is that kind of
       * complaint — which is what a bulk re-point needs to know. */
      missingProduct: /called "(.+?)"/.exec(reason)?.[1] ?? null,
    }));
  }, [editable]);

  // Only fetched when a group actually needs it, so a members import does no
  // product lookups at all.
  const needsProducts = groups.some((g) => g.missingProduct) && productKindFor(slug);
  const products = useQuery<Array<{ id: string; name: string }>>(
    () =>
      productKindFor(slug) === 'loans'
        ? portalApi.loanProducts(communityId)
        : portalApi.savingsProducts(communityId),
    [communityId, slug, needsProducts],
    { enabled: Boolean(needsProducts) },
  );

  const corrections = useMemo(
    () =>
      Object.entries(edits)
        .filter(([, cells]) => Object.keys(cells).length > 0)
        .map(([line, cells]) => ({ line: Number(line), cells })),
    [edits],
  );

  const recheck = useMutation(
    () => portalApi.revalidateMigrationBatch(communityId, batchId, corrections),
    {
      onSuccess: (result) => {
        setEdits({});
        onRechecked(result);
        if (result.rejected === 0) {
          toast('All rows pass now', 'success', `${result.accepted} ready to import.`);
        } else {
          toast(`${result.accepted} ready`, 'info', `${result.rejected} still need attention.`);
        }
      },
      onError: (message) => toast('Could not re-check', 'error', message),
    },
  );

  /** Point every row in a group at a product that does exist. */
  const repoint = (lines: number[], name: string) =>
    setEdits((current) => {
      const next = { ...current };
      for (const line of lines) {
        next[line] = { ...next[line], product: name };
      }
      return next;
    });

  const order = fieldOrder(slug);
  const sortKeys = (keys: string[]) =>
    [...keys].sort((a, b) => {
      const ia = order.indexOf(a);
      const ib = order.indexOf(b);
      // Anything the upload card does not name goes last, in its own order.
      return (ia === -1 ? order.length : ia) - (ib === -1 ? order.length : ib);
    });

  return (
    <div className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 text-[13px] font-semibold text-navy-900">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            {rows.length} row{rows.length === 1 ? '' : 's'} will not be imported
          </p>
          <p className="mt-1 max-w-2xl text-[12.5px] leading-5 text-slate-500">
            {stale
              ? 'This import was uploaded before rows could be edited here, so there is nothing to re-check against. Discard it and upload the file again to fix these rows on screen.'
              : 'Grouped by what is wrong. Fix a whole group at once where you can — no need to touch your spreadsheet.'}
          </p>
        </div>
        {/* An import from before on-screen editing kept no rows to re-check
            against, so offering the button would be a trap. */}
        {stale ? null : (
          <Button
            size="sm"
            variant={corrections.length > 0 ? 'primary' : 'secondary'}
            icon={<RefreshCw className="h-3.5 w-3.5" />}
            loading={recheck.pending}
            onClick={() => recheck.run()}
          >
            {corrections.length > 0
              ? `Re-check with ${corrections.length} fix${corrections.length === 1 ? '' : 'es'}`
              : 'Re-check'}
          </Button>
        )}
      </div>

      <div className="mt-4 space-y-4">
        {groups.map((group) => {
          const lines = group.rows.map((r) => r.line);
          const isOpen = opened[group.reason] ?? false;
          const pending = lines.filter((line) => edits[line]).length;

          return (
            <div key={group.reason} className="rounded-xl border border-slate-200">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 p-4">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2">
                    <Badge tone={pending === group.rows.length ? 'green' : 'amber'}>
                      {group.rows.length} row{group.rows.length === 1 ? '' : 's'}
                    </Badge>
                    <span className="text-[13px] font-medium text-navy-900">{group.reason}</span>
                  </p>
                  <p className="mt-1 text-[12px] text-slate-500">
                    Rows {lines.join(', ')}
                    {pending > 0 ? ` · ${pending} fixed, re-check to confirm` : ''}
                  </p>
                </div>
                <Button size="xs" variant="ghost" onClick={() => setOpened((o) => ({ ...o, [group.reason]: !isOpen }))}>
                  {isOpen ? 'Hide rows' : `Edit ${group.rows.length === 1 ? 'row' : 'rows'}`}
                </Button>
              </div>

              {/* The whole-group fix, where one exists. A product that does
                  not exist is the commonest rejection by far, and the row is
                  almost never what is wrong — so the two real answers are
                  offered here rather than left as an editing exercise. */}
              {group.missingProduct ? (
                <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50/60 p-4">
                  <span className="text-[12.5px] text-slate-600">Point all {group.rows.length} at:</span>
                  <Select
                    aria-label={`Replace ${group.missingProduct} for all rows`}
                    className="max-w-[220px]"
                    value=""
                    onChange={(event) => {
                      if (event.target.value) repoint(lines, event.target.value);
                    }}
                  >
                    <option value="">Choose an existing one…</option>
                    {(products.data ?? []).map((product) => (
                      <option key={product.id} value={product.name}>
                        {product.name}
                      </option>
                    ))}
                  </Select>
                  <span className="text-[12.5px] text-slate-400">or</span>
                  <LinkButton
                    size="sm"
                    variant="secondary"
                    href={(productKindFor(slug) === 'loans' ? '/loans/new' : '/savings/new') as Route}
                  >
                    Create &ldquo;{group.missingProduct}&rdquo;
                  </LinkButton>
                  <span className="text-[12.5px] text-slate-500">
                    then come back and press Re-check — the rows themselves are fine.
                  </span>
                </div>
              ) : null}

              {isOpen ? (
                <div className="divide-y divide-slate-100">
                  {group.rows.map((row) => (
                    <div key={`${row.line}-${row.value}`} className="p-4">
                      <Badge tone="slate">Row {row.line > 0 ? row.line : '—'}</Badge>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {sortKeys(Object.keys(row.cells)).map((key) => (
                          <Field key={key} label={labelFor(key)} htmlFor={`cell-${row.line}-${key}`}>
                            <Input
                              id={`cell-${row.line}-${key}`}
                              value={edits[row.line]?.[key] ?? row.cells[key]}
                              onChange={(event) =>
                                setEdits((current) => ({
                                  ...current,
                                  [row.line]: { ...current[row.line], [key]: event.target.value },
                                }))
                              }
                            />
                          </Field>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}

        {/* Rows nothing on this screen can fix — editing them would not help,
            so they are listed rather than offered as a form. */}
        {fixed.length > 0 ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
            <p className="text-[12.5px] font-medium text-navy-900">
              {stale
                ? `${fixed.length} rejected row${fixed.length === 1 ? '' : 's'}`
                : `${fixed.length} row${fixed.length === 1 ? '' : 's'} cannot be fixed here`}
            </p>
            <ul className="mt-2 space-y-1">
              {fixed.map((row) => (
                <li key={`${row.line}-${row.value}`} className="text-[12.5px] text-slate-600">
                  <span className="font-medium text-navy-900">{row.value}</span> — {row.reason}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** Column keys arrive with spaces stripped; put them back for the label. */
function labelFor(key: string): string {
  const named: Record<string, string> = {
    memberno: 'Member no',
    membernumber: 'Member no',
    membercode: 'Member no',
    fullname: 'Full name',
    membername: 'Full name',
    phonenumber: 'Phone',
    emailaddress: 'Email',
    joinedon: 'Joined on',
    datejoined: 'Joined on',
    openedon: 'Opened on',
    dateopened: 'Opened on',
    disbursedon: 'Disbursed on',
    datetaken: 'Disbursed on',
    dueon: 'Due on',
    duedate: 'Due on',
    productname: 'Product',
  };
  if (named[key]) return named[key];
  return key.charAt(0).toUpperCase() + key.slice(1);
}

/** Recording money actually transferred in. */
function FundingCard({ outstanding, onDone }: { outstanding: string; onDone: () => void }) {
  const communityId = useCommunityId();
  const { toast } = useToast();
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');

  const record = useMutation(
    () =>
      portalApi.recordMigrationFunding(communityId, {
        amount,
        bankReference: reference.trim() || undefined,
        note: note.trim() || undefined,
      }),
    {
      onSuccess: (result) => {
        toast(
          'Funding recorded',
          'success',
          Number(result.outstanding) === 0
            ? 'That completes the migration — withdrawals are now fully covered.'
            : `${money(result.outstanding)} still to transfer.`,
        );
        setAmount('');
        setReference('');
        setNote('');
        onDone();
      },
      onError: (message) => toast('Could not record that', 'error', message),
    },
  );

  const valid = Number(amount) > 0 && Number(amount) <= Number(outstanding);

  return (
    <Card className="mt-6">
      <CardHeader
        title="Record a transfer"
        subtitle={`${money(outstanding)} still to move into Rendi`}
      />
      <div className="grid gap-4 p-5 sm:grid-cols-3">
        <Field
          label="Amount transferred"
          htmlFor="fund-amount"
          required
          error={
            amount && Number(amount) > Number(outstanding)
              ? `More than the ${money(outstanding)} outstanding`
              : undefined
          }
        >
          <Input
            id="fund-amount"
            inputMode="decimal"
            placeholder="0.00"
            value={amount}
            onChange={(event) => setAmount(event.target.value.replace(/[^\d.]/g, ''))}
          />
        </Field>
        <Field label="Bank reference" htmlFor="fund-ref" optional hint="So this ties to a statement line">
          <Input
            id="fund-ref"
            placeholder="e.g. TRF/2026/00412"
            value={reference}
            onChange={(event) => setReference(event.target.value)}
          />
        </Field>
        <Field label="Note" htmlFor="fund-note" optional>
          <Textarea
            id="fund-note"
            rows={1}
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </Field>
      </div>
      <div className="flex items-center gap-3 border-t border-slate-100 px-5 py-4">
        <Button loading={record.pending} disabled={!valid} onClick={() => record.run()}>
          Record transfer
        </Button>
        <p className="text-[12.5px] text-slate-500">
          Until this reaches zero, withdrawals are limited to what has actually arrived.
        </p>
      </div>
    </Card>
  );
}

/** Who has arrived and who has not. */
function Arrivals({ status }: { status: MigrationStatus }) {
  const { members, positions } = status;
  const share = members.total ? Math.round((members.claimed / members.total) * 100) : 0;

  return (
    <Card className="mt-6">
      <CardHeader
        title="Members arriving"
        subtitle={`${members.claimed} of ${members.total} have downloaded the app and claimed their record`}
      />
      <div className="p-5">
        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-brand-600 transition-all"
            style={{ width: `${share}%` }}
          />
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <KV label="Claimed">{members.claimed}</KV>
          <KV label="Still to arrive">{members.unclaimed}</KV>
          <KV label="Records attached">{positions.materialised}</KV>
          <KV label="Records waiting">{positions.total - positions.materialised}</KV>
        </dl>
        {members.unclaimed > 0 ? (
          <p className="mt-4 text-[12.5px] leading-5 text-slate-500">
            A member&apos;s savings and loans attach the moment they register with the phone number
            or email on your list — there is nothing more for you to do. Their balances are already
            on your books either way, which is why the figures above do not wait for them.
          </p>
        ) : null}
      </div>
    </Card>
  );
}

/** Every import attempted, kept so the opening balances can be explained. */
function History({ status }: { status: MigrationStatus }) {
  return (
    <Card className="mt-6">
      <CardHeader
        title="Import history"
        subtitle="Kept on record, so an opening balance can always be traced to the file it came from"
      />
      <DataTable
        rows={status.batches}
        rowKey={(b) => b.id}
        columns={[
          {
            key: 'file',
            header: 'File',
            cell: (b) => (
              <span>
                <span className="block text-[13px] font-medium text-navy-900">
                  {b.fileName ?? 'Untitled'}
                </span>
                <span className="block text-xs text-slate-500">{b.kind.toLowerCase()}</span>
              </span>
            ),
          },
          {
            key: 'rows',
            header: 'Rows',
            cell: (b) => (
              <span className="text-[12.5px] text-slate-600">
                {b.acceptedRows} of {b.rowCount}
                {b.rejectedRows > 0 ? ` · ${b.rejectedRows} rejected` : ''}
              </span>
            ),
          },
          {
            key: 'total',
            header: 'Total',
            align: 'right',
            cell: (b) => (b.totalAmount ? money(b.totalAmount) : '—'),
          },
          {
            key: 'status',
            header: 'Status',
            cell: (b) => <StatusBadge status={b.status.toLowerCase()} />,
          },
          {
            key: 'when',
            header: 'When',
            hideOnMobile: true,
            cell: (b) => (
              <span className="text-[12.5px] text-slate-600">
                {date(b.committedAt ?? b.createdAt)}
              </span>
            ),
          },
        ]}
      />
    </Card>
  );
}
