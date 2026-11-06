'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Rows3 } from 'lucide-react';
import { Card, CardHeader, DataTable, EmptyState, Field, PageHeader, Select } from '@/components/ui';
import { useCommunityId } from '@/components/providers/session-provider';
import { useQuery } from '@/hooks/use-query';
import { portalApi } from '@/services/portal';
import { date, money } from '@/lib/format';
import type { AccountLedger, BookAccount } from '@/types';

/**
 * Every posting against one account, with a running balance.
 *
 * The account comes from the query string so the chart of accounts can link
 * straight to it — "show me what moved through 2000" is the question this
 * page exists to answer, and making the officer re-find the account after
 * clicking it would be the wrong way round.
 */
export function LedgerClient({ accounts }: { accounts: BookAccount[] }) {
  const communityId = useCommunityId();
  const params = useSearchParams();
  const sorted = [...accounts].sort((a, b) => a.code.localeCompare(b.code));
  // The query string chooses the account so the chart of accounts can link
  // straight here; the dropdown then takes over. Derived rather than synced
  // from an effect, which would render once with the wrong account first.
  const [picked, setPicked] = useState<string | null>(null);
  const accountId = picked ?? params.get('account') ?? sorted[0]?.id ?? '';

  const { data, loading } = useQuery<AccountLedger>(
    () => portalApi.accountLedger(communityId, accountId),
    [communityId, accountId],
    { enabled: Boolean(accountId) },
  );

  const selected = sorted.find((a) => a.id === accountId);

  return (
    <>
      <PageHeader
        title="Ledger entries"
        subtitle="Every posting against a single account"
        breadcrumb={
          <Link href="/accounting" className="hover:text-navy-900">
            Accounting
          </Link>
        }
        actions={
          <Field label="Account" className="w-72">
            <Select value={accountId} onChange={(e) => setPicked(e.target.value)}>
              {sorted.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.code} · {a.name}
                </option>
              ))}
            </Select>
          </Field>
        }
      />

      <Card>
        <CardHeader
          title={selected ? `${selected.code} · ${selected.name}` : 'Select an account'}
          subtitle={
            selected
              ? `${selected.type} · increases on the ${
                  selected.type === 'ASSET' || selected.type === 'EXPENSE' ? 'debit' : 'credit'
                } side`
              : undefined
          }
        />
        {!data?.lines?.length ? (
          <EmptyState
            icon={<Rows3 className="h-5 w-5" />}
            title={loading ? 'Loading…' : 'Nothing posted to this account yet'}
            body={loading ? undefined : 'Movements appear here as soon as something posts against it.'}
          />
        ) : (
          <DataTable
            rows={data.lines}
            rowKey={(l) => `${l.entryId}-${l.reference}`}
            columns={[
              { key: 'date', header: 'Date', cell: (l) => date(l.date) },
              {
                key: 'ref',
                header: 'Reference',
                cell: (l) => <span className="font-mono text-[12px]">{l.reference}</span>,
              },
              { key: 'desc', header: 'Description', cell: (l) => l.description },
              {
                key: 'dr',
                header: 'Debit',
                align: 'right',
                cell: (l) => (Number(l.debit) ? money(l.debit, 'NGN') : <span className="text-slate-300">—</span>),
              },
              {
                key: 'cr',
                header: 'Credit',
                align: 'right',
                cell: (l) => (Number(l.credit) ? money(l.credit, 'NGN') : <span className="text-slate-300">—</span>),
              },
              {
                key: 'bal',
                header: 'Balance',
                align: 'right',
                cell: (l) => <span className="font-semibold">{money(l.running, 'NGN')}</span>,
              },
            ]}
          />
        )}
      </Card>
    </>
  );
}
