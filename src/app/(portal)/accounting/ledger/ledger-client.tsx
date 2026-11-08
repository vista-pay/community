'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import { useSearchParams } from 'next/navigation';
import { ChevronRight, Download, Rows3, Search, Settings2 } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  DataTable,
  EmptyState,
  Field,
  Input,
  LinkButton,
  PageHeader,
  Spinner,
} from '@/components/ui';
import { useCommunityId } from '@/components/providers/session-provider';
import { useQuery } from '@/hooks/use-query';
import { portalApi } from '@/services/portal';
import { downloadCsv } from '@/lib/csv';
import { cn, date, money } from '@/lib/format';
import type { AccountLedger, BookAccount } from '@/types';
import {
  ACCOUNT_CLASSES,
  classOf,
  effectOf,
  sidesSentence,
} from '../chart-of-accounts/account-classes';

/**
 * Every posting against one account, with a running balance.
 *
 * The account is chosen from the chart itself — by class, then section, then
 * account — rather than from a flat dropdown of forty codes. A chart of
 * accounts is a structure, and "show me what moved through the welfare fund"
 * starts from knowing welfare is a liability, not from remembering it is
 * 2020.
 *
 * The query string still selects an account so the chart of accounts can
 * link straight here.
 */
export function LedgerClient({ accounts }: { accounts: BookAccount[] }) {
  const communityId = useCommunityId();
  const params = useSearchParams();

  const [picked, setPicked] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  /** Accounts with no postings start hidden; they are what buries the rest. */
  const [showUnused, setShowUnused] = useState(false);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const sorted = useMemo(
    () => [...accounts].sort((a, b) => a.code.localeCompare(b.code)),
    [accounts],
  );

  // Derived rather than synced from an effect, which would render once with
  // the wrong account before correcting itself.
  //
  // Falls back to the first account carrying postings, not the first by
  // code. A seeded chart starts at 1000 Cash in hand, which most
  // communities never touch, so the page opened on an empty ledger and gave
  // no sign that anything else had anything in it.
  const firstWithEntries = useMemo(
    () => sorted.find((a) => (a.entries ?? 0) > 0) ?? sorted[0],
    [sorted],
  );
  const accountId = picked ?? params.get('account') ?? firstWithEntries?.id ?? '';
  const selected = sorted.find((a) => a.id === accountId);

  /**
   * The chart as a tree: class → section → accounts.
   *
   * Built from the accounts themselves, so a section a community invents
   * appears here without anything else changing.
   */
  const matching = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return sorted.filter(
      (a) =>
        !needle ||
        a.code.includes(needle) ||
        a.name.toLowerCase().includes(needle) ||
        a.group.toLowerCase().includes(needle),
    );
  }, [sorted, search]);

  // Searching is a deliberate hunt, often for an account that has never been
  // posted to. Hiding the match would answer "not found" to a question the
  // rail can answer, so a search shows everything.
  const searching = search.trim().length > 0;
  const unusedCount = matching.filter(
    (a) => (a.entries ?? 0) === 0 && a.id !== accountId,
  ).length;
  const showAll = showUnused || searching;

  /**
   * The chart as a tree: class → section → accounts.
   *
   * Built from the accounts themselves, so a section a community invents
   * appears here without anything else changing.
   *
   * Narrowed to accounts carrying postings unless asked otherwise. A seeded
   * chart is mostly empty — a community that runs no Ajo and owns no
   * equipment still carries accounts for both — and a rail listing all forty
   * buried the dozen worth opening.
   */
  const tree = useMemo(() => {
    const visible = showAll
      ? matching
      : matching.filter(
          // The selected account is always listed, even with nothing in it.
          // The chart of accounts links straight here, and following that
          // link for an empty account would otherwise show it open on the
          // right with nothing highlighted on the left.
          (a) => (a.entries ?? 0) > 0 || a.id === accountId,
        );

    return ACCOUNT_CLASSES.map((klass) => {
      const mine = visible.filter((a) => a.type === klass.type);
      const sections = [...new Set(mine.map((a) => a.group))].sort().map((group) => ({
        group,
        accounts: mine.filter((a) => a.group === group),
      }));
      return { klass, sections, count: mine.length };
    }).filter((branch) => branch.count > 0);
  }, [matching, showAll, accountId]);

  const { data, loading } = useQuery<AccountLedger>(
    () => portalApi.accountLedger(communityId, accountId),
    [communityId, accountId],
    { enabled: Boolean(accountId) },
  );

  /**
   * The lines in range, and what the balance was before them.
   *
   * Filtering client-side keeps the running balance honest: it is carried on
   * each line from the start of the account, so slicing a window out of the
   * middle still shows the true balance rather than one restarted at zero.
   */
  const view = useMemo(() => {
    const all = data?.lines ?? [];
    const fromTime = from ? new Date(from).getTime() : -Infinity;
    // Through the end of the chosen day, not its first instant.
    const toTime = to ? new Date(to).getTime() + 86_399_999 : Infinity;

    const lines = all.filter((l) => {
      const at = new Date(l.date).getTime();
      return at >= fromTime && at <= toTime;
    });

    const firstIndex = all.indexOf(lines[0]);
    const opening =
      lines.length === 0 || firstIndex <= 0
        ? '0.00'
        : // The running balance on the line before the window begins.
          all[firstIndex - 1].running;

    const totals = lines.reduce(
      (sum, l) => ({
        debit: sum.debit + Number(l.debit || 0),
        credit: sum.credit + Number(l.credit || 0),
      }),
      { debit: 0, credit: 0 },
    );

    return {
      lines,
      opening,
      closing: lines.length ? lines[lines.length - 1].running : opening,
      debit: totals.debit.toFixed(2),
      credit: totals.credit.toFixed(2),
      filtered: Boolean(from || to),
      total: all.length,
    };
  }, [data, from, to]);

  const klass = selected ? classOf(selected.type) : null;

  return (
    <>
      <PageHeader
        title="Ledger entries"
        subtitle="Every posting against a single account, with its running balance"
        breadcrumb={
          <Link href="/accounting" className="hover:text-navy-900">
            Accounting
          </Link>
        }
        actions={
          <LinkButton
            variant="secondary"
            size="sm"
            href={'/accounting/chart-of-accounts' as Route}
            icon={<Settings2 className="h-4 w-4" />}
          >
            Chart of accounts
          </LinkButton>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
        {/* The chart, as a chart. Picking an account starts from where it
            sits in the books, not from recalling its number. */}
        <aside className="lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:self-start lg:overflow-y-auto">
          <Card>
            <div className="border-b border-slate-100 p-3">
              {/* Icon positioned rather than passed as `prefix`: the DOM's own
                  prefix attribute is a string, so the intersection with
                  InputProps makes a node unassignable. */}
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search accounts"
                  aria-label="Search accounts"
                  className="pl-9"
                />
              </div>
            </div>

            {tree.length === 0 ? (
              <p className="p-5 text-center text-[12.5px] text-slate-500">
                {searching
                  ? `No account matches “${search}”.`
                  : 'Nothing has been posted to any account yet.'}
              </p>
            ) : (
              <nav className="p-2">
                {tree.map(({ klass: branch, sections }) => (
                  <div key={branch.type} className="mb-3 last:mb-0">
                    <p className="flex items-center gap-1.5 px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                      <branch.icon className="h-3.5 w-3.5" />
                      {branch.plural}
                    </p>
                    {sections.map(({ group, accounts: rows }) => (
                      <div key={group} className="mb-1.5 last:mb-0">
                        <p className="px-2 py-1 text-[11.5px] font-medium text-slate-400">
                          {group}
                        </p>
                        {rows.map((account) => (
                          <button
                            key={account.id}
                            type="button"
                            onClick={() => setPicked(account.id)}
                            className={cn(
                              'flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition focus-ring',
                              account.id === accountId
                                ? 'bg-brand-50 text-brand-900'
                                : 'hover:bg-slate-50',
                            )}
                          >
                            <span
                              className={cn(
                                'tnum text-[11.5px]',
                                account.id === accountId
                                  ? 'font-semibold text-brand-700'
                                  : 'text-slate-400',
                              )}
                            >
                              {account.code}
                            </span>
                            <span
                              className={cn(
                                'min-w-0 flex-1 truncate text-[12.5px]',
                                account.id === accountId
                                  ? 'font-semibold'
                                  : account.isActive
                                    ? 'text-navy-800'
                                    : 'text-slate-400 line-through',
                              )}
                            >
                              {account.name}
                            </span>
                            {/* How much is in it, so the rail answers "which
                                of these is worth opening?" without opening
                                each one. */}
                            {(account.entries ?? 0) > 0 ? (
                              <span className="tnum shrink-0 text-[11px] text-slate-400">
                                {account.entries}
                              </span>
                            ) : null}
                            {account.id === accountId ? (
                              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-brand-600" />
                            ) : null}
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>
                ))}
              </nav>
            )}

            {/* Shown rather than hidden, just not first: an account that has
                never been posted to is still one you may need to open — to
                check it really is empty, or before posting to it. */}
            {unusedCount > 0 && !searching ? (
              <button
                type="button"
                onClick={() => setShowUnused(!showUnused)}
                className="flex w-full items-center gap-2 border-t border-slate-100 px-4 py-3 text-left transition hover:bg-slate-50 focus-ring"
              >
                <ChevronRight
                  className={cn(
                    'h-3.5 w-3.5 text-slate-400 transition-transform',
                    showUnused && 'rotate-90',
                  )}
                />
                <span className="flex-1 text-[12.5px] text-slate-600">
                  {unusedCount} never used
                </span>
                <span className="text-[11.5px] text-slate-400">
                  {showUnused ? 'Hide' : 'Show'}
                </span>
              </button>
            ) : null}
          </Card>
        </aside>

        <div className="min-w-0 space-y-4">
          {selected && klass ? (
            <Card>
              <div className="flex flex-wrap items-start justify-between gap-3 p-5">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="tnum text-[13px] font-semibold text-slate-500">
                      {selected.code}
                    </span>
                    <span className="text-[17px] font-semibold text-navy-900">
                      {selected.name}
                    </span>
                    <Badge tone="slate">{selected.group}</Badge>
                  </p>
                  <p className="mt-1 text-[12.5px] text-slate-500">
                    {klass.label} · increases on the {klass.normal.toLowerCase()} side
                    {selected.isActive ? '' : ' · closed to new entries'}
                  </p>
                  {/* Debit and credit read backwards to anyone who learned
                      them from a bank statement, where "credit" means money
                      in — because that is the bank's books, not yours. */}
                  <p className="mt-1 text-[12.5px] text-slate-500">
                    {sidesSentence(selected.type)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    {view.filtered ? 'Closing balance' : 'Balance'}
                  </p>
                  <p className="tnum text-[22px] font-bold text-navy-900">
                    {money(view.closing, 'NGN')}
                  </p>
                </div>
              </div>

              {/* The four figures that answer "what happened here?" without
                  reading every row. Opening matters once a range is set:
                  without it the movement has nothing to move from. */}
              <dl className="grid grid-cols-2 gap-px border-t border-slate-100 bg-slate-100 sm:grid-cols-4">
                {[
                  { label: 'Opening', value: view.opening },
                  {
                    label: `Total ${effectOf(selected.type, 'debit').toLowerCase()}`,
                    value: view.debit,
                  },
                  {
                    label: `Total ${effectOf(selected.type, 'credit').toLowerCase()}`,
                    value: view.credit,
                  },
                  { label: 'Entries', value: String(view.lines.length), plain: true },
                ].map((stat) => (
                  <div key={stat.label} className="bg-white px-4 py-3">
                    <dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                      {stat.label}
                    </dt>
                    <dd className="tnum mt-0.5 text-[14px] font-semibold text-navy-900">
                      {stat.plain ? stat.value : money(stat.value, 'NGN')}
                    </dd>
                  </div>
                ))}
              </dl>
            </Card>
          ) : null}

          <Card>
            <CardHeader
              title="Postings"
              subtitle={
                view.filtered
                  ? `${view.lines.length} of ${view.total} entries in this period`
                  : 'Oldest first, with the balance after each one'
              }
              action={
                <div className="flex flex-wrap items-end gap-2">
                  <Field label="From" htmlFor="ledger-from" className="w-[150px]">
                    <Input
                      id="ledger-from"
                      type="date"
                      value={from}
                      onChange={(event) => setFrom(event.target.value)}
                    />
                  </Field>
                  <Field label="To" htmlFor="ledger-to" className="w-[150px]">
                    <Input
                      id="ledger-to"
                      type="date"
                      value={to}
                      onChange={(event) => setTo(event.target.value)}
                    />
                  </Field>
                  {view.filtered ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setFrom('');
                        setTo('');
                      }}
                    >
                      Clear
                    </Button>
                  ) : null}
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={<Download className="h-3.5 w-3.5" />}
                    disabled={view.lines.length === 0}
                    onClick={() =>
                      downloadCsv(
                        `ledger-${selected?.code ?? 'account'}.csv`,
                        view.lines.map((l) => ({
                          Date: date(l.date),
                          Reference: l.reference,
                          Description: l.description,
                          Memo: l.memo ?? '',
                          Debit: l.debit,
                          Credit: l.credit,
                          Balance: l.running,
                        })),
                      )
                    }
                  >
                    Export
                  </Button>
                </div>
              }
            />

            {loading && !data ? (
              <div className="flex justify-center p-10">
                <Spinner />
              </div>
            ) : view.lines.length === 0 ? (
              <EmptyState
                icon={<Rows3 className="h-5 w-5" />}
                title={
                  view.filtered
                    ? 'Nothing posted in this period'
                    : 'Nothing posted to this account yet'
                }
                body={
                  view.filtered
                    ? `This account has ${view.total} entries outside the dates you chose.`
                    : 'Movements appear here as soon as something posts against it.'
                }
                action={
                  view.filtered ? (
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setFrom('');
                        setTo('');
                      }}
                    >
                      Clear the dates
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <DataTable
                rows={view.lines}
                rowKey={(l) => `${l.entryId}-${l.reference}`}
                columns={[
                  {
                    key: 'date',
                    header: 'Date',
                    cell: (l) => (
                      <span className="whitespace-nowrap text-[12.5px] text-slate-600">
                        {date(l.date)}
                      </span>
                    ),
                  },
                  {
                    key: 'desc',
                    header: 'Description',
                    cell: (l) => (
                      <span className="min-w-0">
                        <span className="block text-[13px] text-navy-900">{l.description}</span>
                        <span className="block font-mono text-[11px] text-slate-400">
                          {l.reference}
                          {/* The memo is the line-level note, which said what
                              this particular side of the entry was for. It
                              was being fetched and thrown away. */}
                          {l.memo ? <span className="font-sans"> · {l.memo}</span> : null}
                        </span>
                      </span>
                    ),
                  },
                  {
                    key: 'dr',
                    header: (
                      <span className="block">
                        Debit
                        <span className="block text-[10px] font-normal normal-case tracking-normal text-slate-400">
                          {effectOf(selected?.type ?? 'ASSET', 'debit')}
                        </span>
                      </span>
                    ),
                    align: 'right',
                    cell: (l) =>
                      Number(l.debit) ? (
                        <span className="tnum text-[13px] font-medium text-navy-900">
                          {money(l.debit, 'NGN')}
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      ),
                  },
                  {
                    key: 'cr',
                    header: (
                      <span className="block">
                        Credit
                        <span className="block text-[10px] font-normal normal-case tracking-normal text-slate-400">
                          {effectOf(selected?.type ?? 'ASSET', 'credit')}
                        </span>
                      </span>
                    ),
                    align: 'right',
                    cell: (l) =>
                      Number(l.credit) ? (
                        <span className="tnum text-[13px] font-medium text-navy-900">
                          {money(l.credit, 'NGN')}
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      ),
                  },
                  {
                    key: 'bal',
                    header: 'Balance',
                    align: 'right',
                    cell: (l) => (
                      <span
                        className={cn(
                          'tnum text-[13px] font-semibold',
                          Number(l.running) < 0 ? 'text-red-600' : 'text-navy-900',
                        )}
                        // A balance on the wrong side of its own account is a
                        // signal, not a formatting quirk.
                        title={
                          Number(l.running) < 0
                            ? 'Negative for this account class — worth investigating'
                            : undefined
                        }
                      >
                        {money(l.running, 'NGN')}
                      </span>
                    ),
                  },
                ]}
              />
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
