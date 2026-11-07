'use client';

import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  Check,
  FileUp,
  Landmark,
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
  PageHeader,
  Stat,
  StatusBadge,
  Textarea,
} from '@/components/ui';
import { useMutation, useQuery } from '@/hooks/use-query';
import { useCommunityId } from '@/components/providers/session-provider';
import { useToast } from '@/components/providers/toast-provider';
import { portalApi } from '@/services/portal';
import { cn, date, money } from '@/lib/format';
import type { BatchPreview, MigrationStatus } from '@/types';
import { MIGRATION_STEPS, UPLOAD_KINDS, stepIndex } from './steps';

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

      {live && !preview ? (
        <Callout
          tone="info"
          title="You have an import waiting"
          className="mt-6"
          action={
            <span className="flex gap-2">
              <Button size="sm" loading={commit.pending} onClick={() => commit.run(live.id)}>
                Apply it
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setDiscarding(true)}>
                Discard
              </Button>
            </span>
          }
        >
          {live.fileName ?? 'A file'} — {live.acceptedRows} of {live.rowCount} rows ready
          {live.rejectedRows > 0 ? `, ${live.rejectedRows} rejected` : ''}.
        </Callout>
      ) : null}

      {preview ? (
        <PreviewCard
          label={preview.label}
          result={preview.result}
          committing={commit.pending}
          onApply={() => commit.run(preview.result.batchId)}
          onDiscard={() => setDiscarding(true)}
        />
      ) : (
        <UploadCards
          disabled={Boolean(live) || upload.pending}
          disabledReason={live ? 'Apply or discard the waiting import first' : undefined}
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
          const id = preview?.result.batchId ?? live?.id;
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
  disabledReason,
  pending,
  onFile,
}: {
  disabled: boolean;
  disabledReason?: string;
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
      {disabledReason ? (
        <div className="border-b border-slate-100 px-5 py-3 text-[12.5px] text-amber-700">
          {disabledReason}
        </div>
      ) : null}
      <div className="grid gap-px bg-slate-200/70 sm:grid-cols-2">
        {UPLOAD_KINDS.map((kind) => (
          <div key={kind.slug} className="bg-white p-5">
            <p className="text-[14px] font-semibold text-navy-900">{kind.label}</p>
            <p className="mt-1 font-mono text-[11.5px] leading-5 text-slate-500">{kind.columns}</p>
            <p className="mt-1.5 text-[12px] leading-5 text-slate-500">{kind.note}</p>
            <label className="mt-3 inline-flex">
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
          </div>
        ))}
      </div>
    </Card>
  );
}

/** The dry run: what would happen, and every row that would not. */
function PreviewCard({
  label,
  result,
  committing,
  onApply,
  onDiscard,
}: {
  label: string;
  result: BatchPreview;
  committing: boolean;
  onApply: () => void;
  onDiscard: () => void;
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
        <div className="p-5">
          <p className="flex items-center gap-1.5 text-[13px] font-semibold text-navy-900">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            These rows will not be imported
          </p>
          <p className="mt-1 text-[12.5px] text-slate-500">
            Fix them in your file and upload it again — the rows that are fine will import either
            way, so you can also apply now and bring the rest later.
          </p>
          <div className="mt-3">
          <DataTable
            rows={result.rejections}
            rowKey={(r) => `${r.line}:${r.value}:${r.reason}`}
            dense
            columns={[
              {
                key: 'line',
                header: 'Row',
                cell: (r) => (
                  <span className="tnum text-[12.5px] text-slate-600">
                    {r.line > 0 ? r.line : '—'}
                  </span>
                ),
              },
              {
                key: 'value',
                header: 'Member',
                cell: (r) => <span className="text-[12.5px] font-medium text-navy-900">{r.value}</span>,
              },
              {
                key: 'reason',
                header: 'Why',
                cell: (r) => <span className="text-[12.5px] text-slate-600">{r.reason}</span>,
              },
            ]}
          />
          </div>
        </div>
      ) : null}
    </Card>
  );
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
