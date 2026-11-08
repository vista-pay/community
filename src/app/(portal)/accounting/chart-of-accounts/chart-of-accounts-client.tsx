'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, Lock, Pencil, Plus, Wallet } from 'lucide-react';
import type { Column } from '@/components/ui';
import {
  Badge,
  Card,
  CardHeader,
  DataTable,
  EmptyState,
  Input,
  LinkButton,
  PageHeader,
} from '@/components/ui';
import { useQuery } from '@/hooks/use-query';
import { useCommunityId } from '@/components/providers/session-provider';
import { portalApi } from '@/services/portal';
import { cn, money } from '@/lib/format';
import type { Route } from 'next';
import type { BookAccount, BookAccountType, PostingRule } from '@/types';
import { ACCOUNT_CLASSES } from './account-classes';


type Tab = 'all' | BookAccountType;

export function ChartOfAccountsClient({ initial }: { initial: BookAccount[] }) {
  const communityId = useCommunityId();
  const [tab, setTab] = useState<Tab>('all');
  const [search, setSearch] = useState('');
  /** Unused accounts start folded; they are the thing being scrolled past. */
  const [showUnused, setShowUnused] = useState(false);
  const { data } = useQuery<{ accounts: BookAccount[]; postingRules: PostingRule[] }>(
    () => portalApi.accounts(communityId),
    [communityId],
    { initial: { accounts: initial, postingRules: [] } },
  );
  const accounts = data?.accounts ?? initial;

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of accounts) map.set(a.type, (map.get(a.type) ?? 0) + 1);
    return map;
  }, [accounts]);

  /** Accounts carrying at least one posting, per class. */
  const used = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of accounts) {
      if ((a.entries ?? 0) > 0) map.set(a.type, (map.get(a.type) ?? 0) + 1);
    }
    return map;
  }, [accounts]);

  /**
   * The chart split by whether anything has ever posted to it.
   *
   * A seeded chart is mostly empty — a community that runs no Ajo and owns
   * no equipment still carries accounts for both — so ordering strictly by
   * code buried the dozen accounts with real figures among thirty that have
   * never been touched.
   *
   * Code order is kept *within* each part, because that is how a chart of
   * accounts is read and an auditor expects 1010 before 1100. The unused
   * ones are not hidden, only moved and folded: an account that exists and
   * has never been used is a fact worth being able to see.
   */
  const { inUse, unused } = useMemo(() => {
    const q = search.trim().toLowerCase();
    const matching = accounts
      .filter((a) => (tab === 'all' ? true : a.type === tab))
      .filter(
        (a) =>
          !q ||
          a.code.includes(q) ||
          a.name.toLowerCase().includes(q) ||
          a.group.toLowerCase().includes(q),
      )
      .sort((a, b) => a.code.localeCompare(b.code));

    return {
      inUse: matching.filter((a) => (a.entries ?? 0) > 0),
      unused: matching.filter((a) => (a.entries ?? 0) === 0),
    };
  }, [accounts, tab, search]);

  // Searching is a deliberate hunt, often for an account that has never been
  // posted to. Folding the match away would answer "not found" to a question
  // the page can answer, so a search opens the fold regardless.
  const searching = search.trim().length > 0;
  const unusedOpen = showUnused || searching;

  return (
    <>
      <PageHeader
        title="Chart of accounts"
        subtitle="Every account the books post to"
        breadcrumb={
          <Link href="/accounting" className="hover:text-navy-900">
            Accounting
          </Link>
        }
        actions={
          <LinkButton href="/accounting/chart-of-accounts/new" icon={<Plus className="h-4 w-4" />}>
            Add account
          </LinkButton>
        }
      />

      {/* One card per class. The counts come from the data rather than being
          hardcoded, so an account added to the chart shows up here. */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {ACCOUNT_CLASSES.map((c) => (
          <button
            key={c.type}
            type="button"
            onClick={() => setTab(tab === c.type ? 'all' : c.type)}
            className={`rounded-xl border bg-white p-4 text-left shadow-card transition focus-ring ${
              tab === c.type ? 'border-brand-500 ring-2 ring-brand-500/20' : 'border-slate-200/80 hover:border-slate-300'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-navy-50 text-navy-700">
                <c.icon className="h-4 w-4" />
              </span>
              <Badge tone={c.normal === 'Debit' ? 'blue' : 'purple'}>{c.normal}</Badge>
            </div>
            <p className="mt-3 text-[15px] font-semibold text-navy-900">{c.label}</p>
            <p className="mt-0.5 text-xs text-slate-500">{c.blurb}</p>
            <p className="tnum mt-2 text-[13px] font-semibold text-navy-900">
              {counts.get(c.type) ?? 0}
              <span className="ml-1 text-xs font-normal text-slate-500">accounts</span>
            </p>
            {/* How many are actually carrying postings. "9 accounts" says
                nothing about whether any of them has ever been used. */}
            <p className="mt-0.5 text-[11.5px] text-slate-500">
              {used.get(c.type) ?? 0} in use
            </p>
          </button>
        ))}
      </div>

      <Card>
        <CardHeader
          title={tab === 'all' ? 'All accounts' : ACCOUNT_CLASSES.find((c) => c.type === tab)?.plural}
          subtitle={
            // Named where it lives, because "where is savings?" on the asset
            // tab is the commonest question a chart of accounts provokes:
            // member savings is money the community owes, so it sits on the
            // other side. The cash it arrived as is here, in the bank.
            tab === 'ASSET'
              ? 'What the community holds. Member savings is not here — it is money owed to members, under Liabilities; the cash behind it sits in the bank accounts above.'
              : tab === 'LIABILITY'
                ? 'What the community owes. Member savings, Ajo money held for a round, and the welfare fund all sit here.'
                : 'Select an account to see every posting against it.'
          }
          action={
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search code or name"
              className="w-56"
              aria-label="Search accounts"
            />
          }
        />
        {inUse.length === 0 && unused.length === 0 ? (
          <EmptyState
            icon={<Wallet className="h-5 w-5" />}
            title="No accounts match"
            body="Clear the search, or pick a different account class."
          />
        ) : (
          <>
            {inUse.length > 0 ? (
              <DataTable rows={inUse} rowKey={(a) => a.id} columns={ACCOUNT_COLUMNS} />
            ) : searching ? null : (
              <EmptyState
                icon={<Wallet className="h-5 w-5" />}
                title="Nothing posted here yet"
                body="Accounts appear here as soon as something posts against them."
              />
            )}

            {/* Moved and folded, not hidden: an account that exists and has
                never been used is a fact worth being able to see, just not
                one worth scrolling past thirty times to reach the figures. */}
            {unused.length > 0 ? (
              <div className="border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowUnused(!unusedOpen)}
                  className="flex w-full items-center gap-2 px-4 py-3 text-left transition hover:bg-slate-50 focus-ring"
                >
                  <ChevronRight
                    className={cn(
                      'h-4 w-4 text-slate-400 transition-transform',
                      unusedOpen && 'rotate-90',
                    )}
                  />
                  <span className="flex-1 text-[13px] font-medium text-navy-900">
                    {unused.length} account{unused.length === 1 ? '' : 's'} never used
                  </span>
                  <span className="text-[12.5px] text-slate-500">
                    {unusedOpen ? 'Hide' : 'Show'}
                  </span>
                </button>
                {unusedOpen ? (
                  <DataTable rows={unused} rowKey={(a) => a.id} columns={ACCOUNT_COLUMNS} />
                ) : null}
              </div>
            ) : null}
          </>
        )}
      </Card>
    </>
  );
}

/**
 * One definition, used by both the in-use table and the folded one below it.
 *
 * At module scope because nothing here reads component state — two copies
 * would be two chances for the columns to drift apart.
 */
const ACCOUNT_COLUMNS: Column<BookAccount>[] = [
              {
                key: 'code',
                header: 'Code',
                cell: (a) => <span className="tnum font-semibold text-navy-900">{a.code}</span>,
              },
              {
                key: 'name',
                header: 'Account',
                cell: (a) => (
                  <span className="flex items-center gap-1.5">
                    <Link
                      // Object form: typed routes reject a template literal
                      // carrying a query string.
                      href={{ pathname: '/accounting/ledger', query: { account: a.id } }}
                      className={`font-medium hover:text-brand-700 ${
                        a.isActive ? 'text-navy-900' : 'text-slate-400 line-through'
                      }`}
                    >
                      {a.name}
                    </Link>
                    {/* The posting rules reference this account by code, so
                        parts of it are not the community's to change. */}
                    {a.isSystem ? (
                      <span title="Used by the automatic posting rules">
                        <Lock className="h-3 w-3 text-slate-400" />
                      </span>
                    ) : null}
                  </span>
                ),
              },
              { key: 'group', header: 'Group', cell: (a) => a.group },
              {
                key: 'type',
                header: 'Class',
                cell: (a) => <Badge tone="slate">{a.type}</Badge>,
              },
              {
                key: 'movement',
                header: 'Movement',
                align: 'right',
                hideOnMobile: true,
                /**
                 * What passed through, which the balance alone hides. An Ajo
                 * account that took 2,400 in and paid 2,400 out nets to zero
                 * and reads as untouched; a fine issued and then settled does
                 * the same.
                 *
                 * Both sides shown rather than added together. Summing them
                 * says 4,800 passed through an account that only ever handled
                 * 2,400 — the same money counted on its way in and again on
                 * its way out.
                 */
                cell: (a) => {
                  const dr = Number(a.debits ?? 0);
                  const cr = Number(a.credits ?? 0);
                  if (!dr && !cr) {
                    return <span className="text-[12.5px] text-slate-300">Never used</span>;
                  }
                  return (
                    <span className="block">
                      <span className="tnum block text-[12.5px] text-slate-600">
                        {dr ? `Dr ${money(a.debits!, 'NGN')}` : null}
                        {dr && cr ? <span className="text-slate-300"> · </span> : null}
                        {cr ? `Cr ${money(a.credits!, 'NGN')}` : null}
                      </span>
                      <span className="block text-[11px] text-slate-400">
                        {a.entries} {a.entries === 1 ? 'entry' : 'entries'}
                      </span>
                    </span>
                  );
                },
              },
              {
                key: 'balance',
                header: 'Balance',
                align: 'right',
                cell: (a) => {
                  const moved = Number(a.debits ?? 0) > 0 || Number(a.credits ?? 0) > 0;
                  const settled = moved && Number(a.balance) === 0;
                  return (
                    <span
                      className={
                        Number(a.balance) < 0
                          ? 'tnum font-semibold text-red-600'
                          : settled
                            ? 'tnum text-slate-500'
                            : 'tnum'
                      }
                      // A balance on the wrong side of its own account is a
                      // signal, not a formatting quirk. Zero after real
                      // movement is a different statement from zero because
                      // nothing ever happened.
                      title={
                        Number(a.balance) < 0
                          ? 'Negative for this account class — worth investigating'
                          : settled
                            ? 'Money passed through and settled — see Movement'
                            : undefined
                      }
                    >
                      {money(a.balance, 'NGN')}
                      {settled ? (
                        <span className="ml-1 text-[11px] text-slate-400">settled</span>
                      ) : null}
                    </span>
                  );
                },
              },
              {
                key: 'actions',
                header: '',
                align: 'right',
                cell: (a) => (
                  <LinkButton
                    size="xs"
                    variant="ghost"
                    href={`/accounting/chart-of-accounts/${a.id}` as Route}
                    icon={<Pencil className="h-3.5 w-3.5" />}
                  >
                    Edit
                  </LinkButton>
                ),
              },
];
