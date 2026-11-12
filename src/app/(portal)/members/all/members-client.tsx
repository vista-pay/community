'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Download, Search, UserPlus, UserRoundCheck, Users } from 'lucide-react';
import {
  Avatar,
  Badge,
  Button,
  Card,
  DataTable,
  EmptyState,
  LinkButton,
  PageHeader,
  StatusBadge,
  Tabs,
  type Column,
} from '@/components/ui';
import { useQuery } from '@/hooks/use-query';
import { useDebounced } from '@/hooks/use-debounced';
import { useCommunityId } from '@/components/providers/session-provider';
import { portalApi } from '@/services/portal';
import { date, money } from '@/lib/format';
import { downloadCsv } from '@/lib/csv';
import type { DashboardData, MemberRow } from '@/types';
import { isPlainMember } from '@/lib/roles';

/** Stable empty result: `?? []` inline defeats the memos below. */
const NONE: never[] = [];

type Filter = 'all' | 'ACTIVE' | 'PENDING' | 'SUSPENDED';

export function MembersClient({
  initial,
  counts,
}: {
  initial: MemberRow[];
  counts?: DashboardData['navigationCounts'] | null;
}) {
  const communityId = useCommunityId();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  // Search hits the API; debouncing keeps a long member list from issuing a
  // request per keystroke.
  const debounced = useDebounced(search, 300);
  const { data, loading } = useQuery<MemberRow[]>(
    () => portalApi.members(communityId, debounced || undefined),
    [communityId, debounced],
    { initial: debounced ? undefined : initial },
  );

  const members = data ?? NONE;
  const rows = useMemo(
    () => (filter === 'all' ? members : members.filter((m) => m.status === filter)),
    [members, filter],
  );

  const columns: Column<MemberRow>[] = [
    {
      key: 'member',
      header: 'Member',
      cell: (m) => (
        <Link href={`/members/${m.id}`} className="flex items-center gap-3 hover:underline">
          <Avatar name={m.name} size="sm" />
          <span className="min-w-0">
            <span className="block truncate font-medium text-navy-900">{m.name}</span>
            {/* The community's own code where it has one; the derived
                number is only a fallback for members who predate it. */}
            <span className="block truncate text-xs text-slate-500">
              {m.memberCode ?? m.memberNumber}
            </span>
          </span>
        </Link>
      ),
    },
    {
      key: 'contact',
      header: 'Contact',
      hideOnMobile: true,
      cell: (m) => (
        <span className="block">
          <span className="block text-[13px] text-navy-800">{m.phone}</span>
          <span className="block truncate text-xs text-slate-500">{m.email}</span>
        </span>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      hideOnMobile: true,
      cell: (m) => (
        <Badge tone={isPlainMember(m.role) ? 'slate' : 'navy'}>
          {m.title ?? m.role.replace('COMMUNITY_', '').toLowerCase()}
        </Badge>
      ),
    },
    {
      key: 'savings',
      header: 'Savings',
      align: 'right',
      cell: (m) => <span className="tnum">{money(m.savings)}</span>,
    },
    {
      key: 'contributions',
      header: 'Contributions',
      align: 'right',
      hideOnMobile: true,
      cell: (m) => <span className="tnum">{money(m.contributions)}</span>,
    },
    {
      key: 'loan',
      header: 'Loan balance',
      align: 'right',
      hideOnMobile: true,
      cell: (m) => (
        <span className="tnum">{m.loanBalance === '0.00' ? '—' : money(m.loanBalance)}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      // A suspension is the thing an officer most needs to spot while
      // scanning the register, and it is invisible in `status` — a suspended
      // member stays ACTIVE so they can still read why.
      cell: (m) => (
        <span className="flex flex-wrap items-center gap-1.5">
          <StatusBadge status={m.status.toLowerCase()} />
          {m.suspension && (
            <Badge tone="red" dot>
              {m.suspension.isFull ? 'Suspended' : `${m.suspension.scopes.length} paused`}
            </Badge>
          )}
        </span>
      ),
    },
    {
      key: 'joined',
      header: 'Joined',
      hideOnMobile: true,
      cell: (m) => <span className="text-slate-500">{date(m.joinedAt)}</span>,
    },
  ];

  return (
    <>
      <PageHeader
        title="Members"
        subtitle={`${members.length} on the register · add people, review requests and manage historical records here`}
        actions={
          <>
            <Button
              variant="secondary"
              icon={<Download className="h-4 w-4" />}
              onClick={() =>
                downloadCsv(
                  'members.csv',
                  rows.map((m) => ({
                    'Member code': m.memberCode ?? m.memberNumber,
                    Name: m.name,
                    Phone: m.phone,
                    Email: m.email,
                    Role: m.title ?? m.role,
                    Status: m.status,
                    Savings: m.savings,
                    Contributions: m.contributions,
                    'Loan balance': m.loanBalance,
                    Joined: m.joinedAt,
                  })),
                )
              }
            >
              Export
            </Button>
            <LinkButton
              href="/members/requests"
              variant="secondary"
              icon={<UserRoundCheck className="h-4 w-4" />}
            >
              Pending members{counts?.joinRequests ? ` (${counts.joinRequests})` : ''}
            </LinkButton>
            <LinkButton href="/members/add" icon={<UserPlus className="h-4 w-4" />}>
              Add members
            </LinkButton>
          </>
        }
      />

      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-4 py-3">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, phone or email"
              aria-label="Search members"
              className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm placeholder:text-slate-400 focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            />
          </div>
          <Tabs
            value={filter}
            onChange={setFilter}
            tabs={[
              { value: 'all', label: 'All', count: members.length },
              {
                value: 'ACTIVE',
                label: 'Active',
                count: members.filter((m) => m.status === 'ACTIVE').length,
              },
              {
                value: 'PENDING',
                label: 'Pending',
                count: members.filter((m) => m.status === 'PENDING').length,
              },
              {
                value: 'SUSPENDED',
                label: 'Suspended',
                count: members.filter((m) => m.status === 'SUSPENDED').length,
              },
            ]}
          />
        </div>

        <DataTable
          rows={rows}
          columns={columns}
          rowKey={(m) => m.id}
          loading={loading}
          empty={
            <EmptyState
              icon={<Users className="h-5 w-5" />}
              title={search ? 'No matches' : 'No members yet'}
              body={
                search
                  ? `Nothing matched “${search}”. Try a phone number or part of a name.`
                  : 'Members appear here once they join from the Rendi app or you approve an application.'
              }
            />
          }
        />
      </Card>
    </>
  );
}
