'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Download, FileSpreadsheet } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  DataTable,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Select,
} from '@/components/ui';
import type { Column } from '@/components/ui';
import { UnusedDisclosure, hasMovement } from '@/components/accounting/unused-rows';
import { useCommunityId } from '@/components/providers/session-provider';
import { useQuery } from '@/hooks/use-query';
import { portalApi } from '@/services/portal';
import { money } from '@/lib/format';
import type { Statements } from '@/types';

/** RFC 4180: quote everything and double embedded quotes. */
const csvCell = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;

function downloadCsv(filename: string, rows: string[][]) {
  // Prefixed with a BOM so Excel opens ₦ and member names correctly instead
  // of mojibake — the most common complaint about exported statements.
  const body = '﻿' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([body], { type: 'text/csv;charset=utf-8;' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function StatementsClient() {
  const communityId = useCommunityId();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [accountType, setAccountType] = useState('all');

  const { data, loading } = useQuery<Statements>(
    () => portalApi.statements(communityId, { from: from || undefined, to: to || undefined }),
    [communityId, from, to],
  );

  const rows = useMemo(() => {
    const all = data?.rows ?? [];
    return accountType === 'all' ? all : all.filter((r) => r.type === accountType);
  }, [data, accountType]);

  /**
   * Accounts with movement in this period, and the ones with none.
   *
   * A statement is read to see what happened, and a seeded chart carries
   * forty accounts of which a handful ever move. Listing every zero row
   * first meant scrolling past them to reach the figures the period is
   * actually about.
   *
   * Totals and the CSV export still use `rows`: a statement that silently
   * omitted accounts would be a different document, and the export is what
   * gets sent to an auditor.
   */
  const moved = useMemo(() => rows.filter(hasMovement), [rows]);
  const still = useMemo(() => rows.filter((r) => !hasMovement(r)), [rows]);
  const [showStill, setShowStill] = useState(false);

  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, r) => ({
          debit: acc.debit + Number(r.debit || 0),
          credit: acc.credit + Number(r.credit || 0),
        }),
        { debit: 0, credit: 0 },
      ),
    [rows],
  );

  const exportCsv = () => {
    const period = from || to ? `${from || 'start'}_to_${to || 'today'}` : 'all-time';
    downloadCsv(`statement_${period}.csv`, [
      ['Code', 'Account', 'Class', 'Group', 'Debit', 'Credit', 'Balance'],
      ...rows.map((r) => [r.code, r.name, r.type, r.group ?? '', r.debit, r.credit, r.balance]),
      [],
      // The totals are part of the statement, not decoration — an export
      // without them is not the thing that was on screen.
      ['', '', '', 'Totals', totals.debit.toFixed(2), totals.credit.toFixed(2), ''],
    ]);
  };

  const balanced = Math.abs(totals.debit - totals.credit) < 0.005;

  return (
    <>
      <PageHeader
        title="Statements"
        subtitle="Filter by period and account class, then export"
        breadcrumb={
          <Link href="/accounting" className="hover:text-navy-900">
            Accounting
          </Link>
        }
        actions={
          <Button
            variant="secondary"
            onClick={exportCsv}
            disabled={!rows.length}
            icon={<Download className="h-4 w-4" />}
          >
            Export CSV
          </Button>
        }
      />

      <Card className="mb-5">
        <div className="flex flex-wrap items-end gap-3 px-5 py-4">
          <Field label="From" className="w-40">
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label="To" className="w-40">
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </Field>
          <Field label="Account class" className="w-44">
            <Select value={accountType} onChange={(e) => setAccountType(e.target.value)}>
              <option value="all">All classes</option>
              <option value="ASSET">Assets</option>
              <option value="LIABILITY">Liabilities</option>
              <option value="EQUITY">Equity</option>
              <option value="INCOME">Income</option>
              <option value="EXPENSE">Expenses</option>
            </Select>
          </Field>
          {(from || to || accountType !== 'all') && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setFrom('');
                setTo('');
                setAccountType('all');
              }}
            >
              Clear filters
            </Button>
          )}
          <span className="ml-auto text-[13px] text-slate-500">
            {rows.length} account{rows.length === 1 ? '' : 's'}
          </span>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Account statement"
          subtitle={
            from || to
              ? `${from || 'the beginning'} to ${to || 'today'}`
              : 'All activity to date'
          }
          action={
            rows.length ? (
              <Badge tone={balanced ? 'green' : 'red'} dot>
                {balanced ? 'Balanced' : 'Does not balance'}
              </Badge>
            ) : null
          }
        />
        {!rows.length ? (
          <EmptyState
            icon={<FileSpreadsheet className="h-5 w-5" />}
            title={loading ? 'Loading…' : 'Nothing in this period'}
            body={loading ? undefined : 'Widen the dates, or clear the account filter.'}
          />
        ) : (
          <>
            <DataTable rows={moved} rowKey={(r) => r.code} columns={STATEMENT_COLUMNS} />
            <UnusedDisclosure
              count={still.length}
              open={showStill}
              onToggle={() => setShowStill((open) => !open)}
            >
              <DataTable rows={still} rowKey={(r) => r.code} columns={STATEMENT_COLUMNS} />
            </UnusedDisclosure>
            {/* Totals cover every account in the filter, folded or not — a
                statement whose totals disagreed with its own rows would be
                worse than one that scrolls. */}
            <div className="flex items-center justify-end gap-8 border-t border-slate-200 px-5 py-3 text-[13px]">
              <span className="text-slate-500">Totals</span>
              <span className="tnum font-semibold text-navy-900">{money(totals.debit, 'NGN')}</span>
              <span className="tnum font-semibold text-navy-900">{money(totals.credit, 'NGN')}</span>
            </div>
          </>
        )}
      </Card>
    </>
  );
}

/** One definition for both tables, so they cannot drift apart. */
const STATEMENT_COLUMNS: Column<Statements['rows'][number]>[] = [
  {
    key: 'code',
    header: 'Code',
    cell: (r) => <span className="tnum font-semibold text-navy-900">{r.code}</span>,
  },
  { key: 'name', header: 'Account', cell: (r) => r.name },
  { key: 'type', header: 'Class', cell: (r) => <Badge tone="slate">{r.type}</Badge> },
  { key: 'dr', header: 'Debit', align: 'right', cell: (r) => money(r.debit, 'NGN') },
  { key: 'cr', header: 'Credit', align: 'right', cell: (r) => money(r.credit, 'NGN') },
  {
    key: 'bal',
    header: 'Balance',
    align: 'right',
    cell: (r) => (
      <span className={Number(r.balance) < 0 ? 'font-semibold text-red-600' : 'font-semibold'}>
        {money(r.balance, 'NGN')}
      </span>
    ),
  },
];
