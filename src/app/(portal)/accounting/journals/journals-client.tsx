'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { NotebookPen } from 'lucide-react';
import {
  Badge,
  Card,
  CardHeader,
  DataTable,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Select,
  StatusBadge,
} from '@/components/ui';
import { useCommunityId } from '@/components/providers/session-provider';
import { useQuery } from '@/hooks/use-query';
import { portalApi } from '@/services/portal';
import { date, humanise, money } from '@/lib/format';
import type { JournalEntry } from '@/types';

/**
 * Every journal entry, manual and automatic.
 *
 * `source` is shown prominently because it answers the question an officer
 * actually has when a figure looks wrong: did a person post this, or did the
 * system? Before the automatic postings existed, every entry was MANUAL and
 * the column would have been pointless.
 */
export function JournalsClient({ initial }: { initial: JournalEntry[] }) {
  const communityId = useCommunityId();
  const [status, setStatus] = useState('all');
  const [source, setSource] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const { data } = useQuery<JournalEntry[]>(
    () =>
      portalApi.journals(communityId, {
        status: status === 'all' ? undefined : status,
        from: from || undefined,
        to: to || undefined,
      }),
    [communityId, status, from, to],
    { initial },
  );

  const entries = useMemo(() => {
    const all = data ?? initial;
    return source === 'all' ? all : all.filter((e) => e.source === source);
  }, [data, initial, source]);

  const sources = useMemo(
    () => [...new Set((data ?? initial).map((e) => e.source))].sort(),
    [data, initial],
  );

  return (
    <>
      <PageHeader
        title="Journals"
        subtitle="Manual entries and every automatic posting"
        breadcrumb={
          <Link href="/accounting" className="hover:text-navy-900">
            Accounting
          </Link>
        }
      />

      <Card className="mb-5">
        <div className="flex flex-wrap items-end gap-3 px-5 py-4">
          <Field label="Status" className="w-40">
            <Select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="all">All</option>
              <option value="DRAFT">Draft</option>
              <option value="POSTED">Posted</option>
              <option value="REVERSED">Reversed</option>
            </Select>
          </Field>
          <Field label="Source" className="w-44">
            <Select value={source} onChange={(e) => setSource(e.target.value)}>
              <option value="all">All sources</option>
              {sources.map((s) => (
                <option key={s} value={s}>
                  {humanise(s)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="From" className="w-40">
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label="To" className="w-40">
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </Field>
          <span className="ml-auto text-[13px] text-slate-500">
            {entries.length} entr{entries.length === 1 ? 'y' : 'ies'}
          </span>
        </div>
      </Card>

      <Card>
        <CardHeader title="Entries" subtitle="Newest first" />
        {!entries.length ? (
          <EmptyState
            icon={<NotebookPen className="h-5 w-5" />}
            title="No entries match"
            body="Widen the dates, or clear the status and source filters."
          />
        ) : (
          <DataTable
            rows={entries}
            rowKey={(e) => e.id}
            columns={[
              { key: 'date', header: 'Date', cell: (e) => date(e.date) },
              {
                key: 'ref',
                header: 'Reference',
                cell: (e) => <span className="font-mono text-[12px]">{e.reference}</span>,
              },
              { key: 'desc', header: 'Description', cell: (e) => e.description },
              {
                key: 'source',
                header: 'Source',
                cell: (e) => (
                  <Badge tone={e.source === 'MANUAL' ? 'purple' : 'slate'}>
                    {humanise(e.source)}
                  </Badge>
                ),
              },
              { key: 'status', header: 'Status', cell: (e) => <StatusBadge status={e.status} /> },
              {
                key: 'amount',
                header: 'Amount',
                align: 'right',
                // The API already totals the entry; re-deriving it from the
                // lines would quietly disagree the moment one is rounded.
                cell: (e) => <span className="font-semibold">{money(e.total, 'NGN')}</span>,
              },
            ]}
          />
        )}
      </Card>
    </>
  );
}
