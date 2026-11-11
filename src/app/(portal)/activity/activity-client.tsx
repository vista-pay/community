'use client';

import { useState } from 'react';
import {
  Activity,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Download,
  Gavel,
  Search,
  Users,
} from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  DataTable,
  EmptyState,
  Field,
  Input,
  Segmented,
  PageHeader,
  type Column,
  type Tone,
} from '@/components/ui';
import { useQuery } from '@/hooks/use-query';
import { useDebounced } from '@/hooks/use-debounced';
import { useCommunityId } from '@/components/providers/session-provider';
import { portalApi } from '@/services/portal';
import { date, humanise, num, relative } from '@/lib/format';
import { downloadCsv } from '@/lib/csv';
import type { ActivityCategory, ActivityEntry, ActivityFeed } from '@/types';

const PAGE_SIZE = 50;

const CATEGORY: Record<ActivityCategory, { label: string; tone: Tone; icon: typeof Users }> = {
  members: { label: 'Members', tone: 'green', icon: Users },
  finance: { label: 'Finance', tone: 'navy', icon: BookOpen },
  governance: { label: 'Governance', tone: 'gold', icon: Gavel },
  other: { label: 'Other', tone: 'slate', icon: Activity },
};

type Filter = 'all' | ActivityCategory;

/**
 * The whole activity trail.
 *
 * Deliberately not a second dashboard: the one question this page answers is
 * "who did what, and when", so every column is part of that sentence and the
 * filters are the three an officer actually asks — which area, which words,
 * and which dates.
 */
export function ActivityClient({ initial }: { initial?: ActivityFeed }) {
  const communityId = useCommunityId();
  const [page, setPage] = useState(1);
  const [category, setCategory] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  // Typing a word should not fire a request per keystroke; the server is
  // doing three ILIKEs across a table that only grows.
  const debouncedSearch = useDebounced(search, 350);

  const { data, loading, error } = useQuery<ActivityFeed>(
    () =>
      portalApi.activity(communityId, {
        page,
        limit: PAGE_SIZE,
        category,
        search: debouncedSearch.trim() || undefined,
        from: from || undefined,
        to: to || undefined,
      }),
    [communityId, page, category, debouncedSearch, from, to],
    // Only the untouched first page matches what the server already sent.
    { initial: page === 1 && category === 'all' && !debouncedSearch && !from && !to ? initial : undefined },
  );

  const feed = data;
  const entries = feed?.entries ?? [];
  const total = feed?.total ?? 0;
  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));

  /** Any filter change invalidates the page number it was read on. */
  const resetTo = <T,>(setter: (value: T) => void) => (value: T) => {
    setter(value);
    setPage(1);
  };

  const columns: Column<ActivityEntry>[] = [
    {
      key: 'action',
      header: 'What happened',
      cell: (entry) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-navy-900">{humanise(entry.action)}</p>
          <p className="truncate text-xs text-slate-500">
            {humanise(entry.entityType)}
            {entry.reason ? ` · ${entry.reason}` : ''}
          </p>
        </div>
      ),
    },
    {
      key: 'category',
      header: 'Area',
      cell: (entry) => <Badge tone={CATEGORY[entry.category].tone}>{CATEGORY[entry.category].label}</Badge>,
    },
    {
      key: 'actor',
      header: 'Who',
      cell: (entry) => (
        <span className="text-slate-700">
          {entry.actorName ?? (entry.actorType === 'USER' ? 'Unknown user' : humanise(entry.actorType))}
        </span>
      ),
    },
    {
      key: 'at',
      header: 'When',
      align: 'right',
      cell: (entry) => (
        <span title={date(entry.at, 'datetime')} className="whitespace-nowrap text-slate-600">
          {relative(entry.at)}
        </span>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Activity"
        subtitle={
          loading && !feed
            ? 'Loading the trail…'
            : `${num(total)} recorded action${total === 1 ? '' : 's'} across the community portal`
        }
        actions={
          <Button
            variant="secondary"
            disabled={entries.length === 0}
            onClick={() =>
              downloadCsv(
                'community-activity.csv',
                entries.map((entry) => ({
                  When: date(entry.at, 'datetime'),
                  Action: humanise(entry.action),
                  Area: CATEGORY[entry.category].label,
                  Entity: humanise(entry.entityType),
                  Who: entry.actorName ?? entry.actorType,
                  Reason: entry.reason ?? '',
                })),
              )
            }
          >
            <Download className="h-4 w-4" /> Export this page
          </Button>
        }
      />

      <Card className="mb-4 p-4 sm:p-5">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto]">
          <Field
            label="Search"
            htmlFor="activity-search"
            optional
            hint="Matches the action, the record type or the reason given."
          >
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                aria-hidden
              />
              <Input
                id="activity-search"
                className="pl-9"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder="e.g. loan, suspended, journal"
              />
            </div>
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="From" htmlFor="activity-from" optional>
              <Input
                id="activity-from"
                type="date"
                value={from}
                max={to || undefined}
                onChange={(event) => resetTo(setFrom)(event.target.value)}
              />
            </Field>
            <Field label="To" htmlFor="activity-to" optional>
              <Input
                id="activity-to"
                type="date"
                value={to}
                min={from || undefined}
                onChange={(event) => resetTo(setTo)(event.target.value)}
              />
            </Field>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Segmented<Filter>
            label="Filter by area"
            value={category}
            onChange={resetTo(setCategory)}
            options={[
              { value: 'all', label: 'Everything' },
              { value: 'members', label: 'Members' },
              { value: 'finance', label: 'Finance' },
              { value: 'governance', label: 'Governance' },
              { value: 'other', label: 'Other' },
            ]}
          />
          {(search || from || to || category !== 'all') && (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setFrom('');
                setTo('');
                setCategory('all');
                setPage(1);
              }}
              className="text-sm font-medium text-brand-700 hover:underline"
            >
              Clear filters
            </button>
          )}
        </div>
      </Card>

      <Card>
        <DataTable
          rows={entries}
          columns={columns}
          rowKey={(entry) => entry.id}
          loading={loading}
          empty={
            <EmptyState
              icon={<Activity className="h-5 w-5" />}
              title={error ? 'Could not load the activity trail' : 'Nothing recorded here'}
              body={
                error ??
                (search || from || to || category !== 'all'
                  ? 'No activity matches these filters. Widen the dates or clear them.'
                  : 'Actions appear here as officers and members use the community.')
              }
            />
          }
          mobile={(entry) => (
            <div className="space-y-1">
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium text-navy-900">{humanise(entry.action)}</p>
                <Badge tone={CATEGORY[entry.category].tone}>{CATEGORY[entry.category].label}</Badge>
              </div>
              <p className="text-xs text-slate-500">
                {humanise(entry.entityType)} · {entry.actorName ?? humanise(entry.actorType)}
              </p>
              <p className="text-xs text-slate-400">{date(entry.at, 'datetime')}</p>
            </div>
          )}
        />

        {total > PAGE_SIZE && (
          <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-4 py-3">
            <p className="text-sm text-slate-500">
              Page {feed?.page ?? page} of {num(lastPage)}
            </p>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="h-4 w-4" /> Previous
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={!feed?.hasMore || loading}
                onClick={() => setPage((p) => p + 1)}
              >
                Next <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </>
  );
}
