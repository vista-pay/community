'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import { Download, PiggyBank } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  DataTable,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Select,
  Stat,
} from '@/components/ui';
import { downloadCsv } from '@/lib/csv';
import { date, humanise, money } from '@/lib/format';
import { savingsProductName } from '@/lib/savings';
import type { SavingsStatement } from '@/types';

type Transaction = SavingsStatement['transactions'][number];
type EntryType = Transaction['type'] | 'ALL';

export function SavingsStatementClient({ statement }: { statement: SavingsStatement }) {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [type, setType] = useState<EntryType>('ALL');
  const [search, setSearch] = useState('');

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return statement.transactions.filter((transaction) => {
      const day = transaction.at.slice(0, 10);
      if (from && day < from) return false;
      if (to && day > to) return false;
      if (type !== 'ALL' && transaction.type !== type) return false;
      if (
        term &&
        !transaction.reference.toLowerCase().includes(term) &&
        !transaction.note?.toLowerCase().includes(term)
      ) {
        return false;
      }
      return true;
    });
  }, [from, search, statement.transactions, to, type]);

  const clearFilters = () => {
    setFrom('');
    setTo('');
    setType('ALL');
    setSearch('');
  };

  const exportRows = () => {
    const period = from || to ? `${from || 'start'}-to-${to || 'today'}` : 'all-time';
    downloadCsv(
      `savings-statement-${statement.accountNumber}-${period}.csv`,
      rows.map((transaction) => ({
        Date: date(transaction.at, 'datetime'),
        Type: humanise(transaction.type),
        Reference: transaction.reference,
        Note: transaction.note,
        Amount: transaction.amount,
        Direction: transaction.type === 'WITHDRAWAL' ? 'Debit' : 'Credit',
        'Balance after': transaction.balanceAfter,
      })),
    );
  };

  const hasFilters = Boolean(from || to || search || type !== 'ALL');

  return (
    <>
      <PageHeader
        title={`${statement.memberName}'s statement`}
        subtitle={`${statement.accountNumber} · ${savingsProductName(statement.product.name)}`}
        breadcrumb={
          <Link href={'/savings' as Route} className="hover:text-navy-700">
            Savings
          </Link>
        }
        actions={
          <Button
            variant="secondary"
            icon={<Download className="h-4 w-4" />}
            disabled={rows.length === 0}
            onClick={exportRows}
          >
            Export CSV
          </Button>
        }
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <Stat
          label="Current balance"
          value={money(statement.balance)}
          hint={statement.accountNumber}
          icon={<PiggyBank className="h-4 w-4" />}
        />
        <Stat
          label="Product"
          value={savingsProductName(statement.product.name)}
          hint={`Minimum balance ${money(statement.product.minBalance)}`}
        />
        <Stat
          label="Account status"
          value={humanise(statement.status)}
          hint={
            statement.product.policy === 'LOCKED'
              ? 'Withdrawals are locked'
              : statement.product.policy === 'NOTICE'
                ? `${statement.product.noticeDays} days withdrawal notice`
                : 'Withdrawals allowed at any time'
          }
        />
      </div>

      <Card className="mb-5">
        <div className="flex flex-wrap items-end gap-3 px-5 py-4">
          <Field label="From" className="w-40">
            <Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
          </Field>
          <Field label="To" className="w-40">
            <Input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
          </Field>
          <Field label="Transaction type" className="w-48">
            <Select value={type} onChange={(event) => setType(event.target.value as EntryType)}>
              <option value="ALL">All transactions</option>
              <option value="DEPOSIT">Deposits</option>
              <option value="WITHDRAWAL">Withdrawals</option>
              <option value="INTEREST">Interest credits</option>
              <option value="ADJUSTMENT">Corrections</option>
            </Select>
          </Field>
          <Field label="Reference or note" className="min-w-52 flex-1">
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search transactions"
            />
          </Field>
          {hasFilters && (
            <Button size="sm" variant="ghost" onClick={clearFilters}>
              Clear filters
            </Button>
          )}
        </div>
      </Card>

      <Card>
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="font-semibold text-navy-900">Transactions</h2>
            <p className="text-xs text-slate-500">
              {rows.length} of {statement.transactions.length} transaction
              {statement.transactions.length === 1 ? '' : 's'}
            </p>
          </div>
          <Badge tone="slate">Filtered statement</Badge>
        </div>
        <DataTable
          rows={rows}
          rowKey={(transaction) => transaction.id}
          columns={[
            {
              key: 'date',
              header: 'Date',
              cell: (transaction) => date(transaction.at, 'datetime'),
            },
            {
              key: 'type',
              header: 'Type',
              cell: (transaction) => humanise(transaction.type),
            },
            {
              key: 'reference',
              header: 'Reference',
              cell: (transaction) => (
                <span>
                  <span className="block font-medium text-navy-900">
                    {transaction.reference}
                  </span>
                  {transaction.note && (
                    <span className="block text-xs text-slate-500">{transaction.note}</span>
                  )}
                </span>
              ),
            },
            {
              key: 'amount',
              header: 'Amount',
              align: 'right',
              cell: (transaction) => (
                <span
                  className={
                    transaction.type === 'WITHDRAWAL' ? 'text-red-700' : 'text-emerald-700'
                  }
                >
                  {transaction.type === 'WITHDRAWAL' ? '−' : '+'}
                  {money(transaction.amount)}
                </span>
              ),
            },
            {
              key: 'balance',
              header: 'Balance',
              align: 'right',
              cell: (transaction) => money(transaction.balanceAfter),
            },
          ]}
          empty={
            <EmptyState
              compact
              title={hasFilters ? 'No matching transactions' : 'Nothing recorded yet'}
              body={
                hasFilters
                  ? 'Change or clear the filters to see more transactions.'
                  : 'Transactions appear here after they are recorded.'
              }
              action={
                hasFilters ? (
                  <Button size="sm" variant="secondary" onClick={clearFilters}>
                    Clear filters
                  </Button>
                ) : undefined
              }
            />
          }
        />
      </Card>
    </>
  );
}
