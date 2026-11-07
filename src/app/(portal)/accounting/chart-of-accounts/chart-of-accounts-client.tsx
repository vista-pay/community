'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Lock, Pencil, Plus, Wallet } from 'lucide-react';
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
import { money } from '@/lib/format';
import type { Route } from 'next';
import type { BookAccount, BookAccountType, PostingRule } from '@/types';
import { ACCOUNT_CLASSES } from './account-classes';


type Tab = 'all' | BookAccountType;

export function ChartOfAccountsClient({ initial }: { initial: BookAccount[] }) {
  const communityId = useCommunityId();
  const [tab, setTab] = useState<Tab>('all');
  const [search, setSearch] = useState('');
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

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return accounts
      .filter((a) => (tab === 'all' ? true : a.type === tab))
      .filter((a) => !q || a.code.includes(q) || a.name.toLowerCase().includes(q))
      .sort((a, b) => a.code.localeCompare(b.code));
  }, [accounts, tab, search]);

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
          </button>
        ))}
      </div>

      <Card>
        <CardHeader
          title={tab === 'all' ? 'All accounts' : ACCOUNT_CLASSES.find((c) => c.type === tab)?.plural}
          subtitle="Select an account to see every posting against it."
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
        {rows.length === 0 ? (
          <EmptyState
            icon={<Wallet className="h-5 w-5" />}
            title="No accounts match"
            body="Clear the search, or pick a different account class."
          />
        ) : (
          <DataTable
            rows={rows}
            rowKey={(a) => a.id}
            columns={[
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
                key: 'balance',
                header: 'Balance',
                align: 'right',
                cell: (a) => (
                  <span
                    className={
                      Number(a.balance) < 0 ? 'tnum font-semibold text-red-600' : 'tnum'
                    }
                    // A balance on the wrong side of its own account is a
                    // signal, not a formatting quirk.
                    title={
                      Number(a.balance) < 0
                        ? 'Negative for this account class — worth investigating'
                        : undefined
                    }
                  >
                    {money(a.balance, 'NGN')}
                  </span>
                ),
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
            ]}
          />
        )}
      </Card>
    </>
  );
}
