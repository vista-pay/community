'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Landmark,
  Lock,
  Pencil,
  PiggyBank,
  Plus,
  Receipt,
  Scale,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import {
  Badge,
  Button,
  Callout,
  Card,
  CardHeader,
  DataTable,
  EmptyState,
  Field,
  Input,
  Modal,
  PageHeader,
  Select,
  Textarea,
  Toggle,
} from '@/components/ui';
import { useMutation, useQuery } from '@/hooks/use-query';
import { useCommunityId } from '@/components/providers/session-provider';
import { useToast } from '@/components/providers/toast-provider';
import { portalApi } from '@/services/portal';
import { money } from '@/lib/format';
import type { BookAccount, BookAccountType, PostingRule } from '@/types';

/**
 * The five account classes, in the order a balance sheet reads them.
 *
 * `normal` is which side increases the account. It is shown because a
 * negative balance is only meaningful once you know which way the account is
 * supposed to lean — a liability with a debit balance means something is
 * wrong, and nothing on the page said so before.
 */
const CLASSES = [
  {
    type: 'ASSET',
    label: 'Assets',
    normal: 'Debit',
    icon: Landmark,
    blurb: 'What the community owns or is owed.',
  },
  {
    type: 'LIABILITY',
    label: 'Liabilities',
    normal: 'Credit',
    icon: Scale,
    blurb: 'What it owes members and others.',
  },
  {
    type: 'EQUITY',
    label: 'Equity',
    normal: 'Credit',
    icon: PiggyBank,
    blurb: "Members' capital and accumulated reserves.",
  },
  {
    type: 'INCOME',
    label: 'Income',
    normal: 'Credit',
    icon: TrendingUp,
    blurb: 'Dues, charges and other earnings.',
  },
  {
    type: 'EXPENSE',
    label: 'Expenses',
    normal: 'Debit',
    icon: Receipt,
    blurb: 'What it costs to run the community.',
  },
] as const;

type Tab = 'all' | (typeof CLASSES)[number]['type'];

export function ChartOfAccountsClient({ initial }: { initial: BookAccount[] }) {
  const communityId = useCommunityId();
  const [tab, setTab] = useState<Tab>('all');
  const [search, setSearch] = useState('');
  /** The account being edited, or 'new' for the add form. */
  const [editing, setEditing] = useState<BookAccount | 'new' | null>(null);

  const { data, refresh } = useQuery<{ accounts: BookAccount[]; postingRules: PostingRule[] }>(
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
          <Button icon={<Plus className="h-4 w-4" />} onClick={() => setEditing('new')}>
            Add account
          </Button>
        }
      />

      {/* One card per class. The counts come from the data rather than being
          hardcoded, so an account added to the chart shows up here. */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {CLASSES.map((c) => (
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
          title={tab === 'all' ? 'All accounts' : CLASSES.find((c) => c.type === tab)?.label}
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
                  <Button
                    size="xs"
                    variant="ghost"
                    icon={<Pencil className="h-3.5 w-3.5" />}
                    onClick={() => setEditing(a)}
                  >
                    Edit
                  </Button>
                ),
              },
            ]}
          />
        )}
      </Card>

      {editing ? (
        <AccountForm
          account={editing === 'new' ? null : editing}
          existingCodes={accounts.map((a) => a.code)}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await refresh();
          }}
        />
      ) : null}
    </>
  );
}

/**
 * Add an account, or change one.
 *
 * The chart is seeded from a standard template, but it is the community's
 * own book from that moment on — a cooperative that runs a generator or
 * rents a hall needs a line for it, and until now the only way to get one
 * was a code change.
 *
 * What a system account allows is decided by the server, which owns the
 * posting rules. The form mirrors those limits so they read as design rather
 * than as a request that fails.
 */
function AccountForm({
  account,
  existingCodes,
  onClose,
  onSaved,
}: {
  account: BookAccount | null;
  existingCodes: string[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const communityId = useCommunityId();
  const { toast } = useToast();
  const isNew = account === null;
  const locked = account?.isSystem ?? false;

  const [code, setCode] = useState(account?.code ?? '');
  const [name, setName] = useState(account?.name ?? '');
  const [type, setType] = useState<BookAccountType>(account?.type ?? 'EXPENSE');
  const [group, setGroup] = useState(account?.group ?? '');
  const [description, setDescription] = useState(account?.description ?? '');
  const [isActive, setIsActive] = useState(account?.isActive ?? true);

  // Groups already in use, so a new account joins an existing section of the
  // chart instead of starting a one-account group through a typo.
  const codeClash = isNew && existingCodes.includes(code.trim());
  const codeShape = /^[0-9]{3,8}$/.test(code.trim());

  const save = useMutation(
    () =>
      isNew
        ? portalApi.createAccount(communityId, {
            code: code.trim(),
            name: name.trim(),
            type,
            group: group.trim(),
            description: description.trim() || undefined,
          })
        : portalApi.updateAccount(communityId, account.id, {
            // Only sent when it changed. The server compares against the
            // stored value so an unchanged code is harmless either way, but
            // omitting it keeps the audit entry to what was actually edited.
            ...(code.trim() !== account.code ? { code: code.trim() } : {}),
            name: name.trim(),
            group: group.trim(),
            description: description.trim() || undefined,
            isActive,
          }),
    {
      onSuccess: async () => {
        toast(isNew ? 'Account added' : 'Account updated', 'success');
        await onSaved();
      },
      onError: (message) => toast('Could not save the account', 'error', message),
    },
  );

  const valid = codeShape && !codeClash && name.trim().length > 1 && group.trim().length > 1;

  return (
    <Modal
      open
      onClose={onClose}
      title={isNew ? 'Add an account' : `Edit ${account.code}`}
      description={
        isNew
          ? 'It joins your chart straight away and can be posted to from a journal entry.'
          : undefined
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={save.pending} disabled={!valid} onClick={() => save.run()}>
            {isNew ? 'Add account' : 'Save changes'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {locked ? (
          <Callout tone="info" title="This account is used by the automatic postings">
            You can rename it and change its group or description. It cannot be renumbered or
            switched off, because contributions, savings and loans post to it by code — the books
            would quietly stop recording them.
          </Callout>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Code"
            htmlFor="account-code"
            required
            hint="3 to 8 digits. Keep it near its neighbours — 5xxx for expenses, 4xxx for income."
            error={
              code.trim() && !codeShape
                ? 'Digits only, 3 to 8 of them'
                : codeClash
                  ? `${code.trim()} is already in use`
                  : undefined
            }
          >
            <Input
              id="account-code"
              inputMode="numeric"
              value={code}
              disabled={locked}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
            />
          </Field>

          <Field label="Class" htmlFor="account-type" required>
            <Select
              id="account-type"
              value={type}
              // Changing the class of an account that already has postings
              // would move money between the balance sheet and the income
              // statement. The server does not accept it on an edit either.
              disabled={!isNew}
              onChange={(event) => setType(event.target.value as BookAccountType)}
            >
              {CLASSES.map((c) => (
                <option key={c.type} value={c.type}>
                  {c.label} — increases on {c.normal.toLowerCase()}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="Name" htmlFor="account-name" required>
          <Input
            id="account-name"
            value={name}
            placeholder="e.g. Generator fuel"
            onChange={(event) => setName(event.target.value)}
          />
        </Field>

        <Field
          label="Group"
          htmlFor="account-group"
          required
          hint="The section of the chart it sits under, e.g. Administration, Premises."
        >
          <Input
            id="account-group"
            value={group}
            placeholder="e.g. Premises"
            onChange={(event) => setGroup(event.target.value)}
          />
        </Field>

        <Field label="Description" htmlFor="account-description" optional>
          <Textarea
            id="account-description"
            rows={2}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </Field>

        {!isNew && !locked ? (
          <Toggle
            checked={isActive}
            onChange={setIsActive}
            label="Open for posting"
          />
        ) : null}
        {!isNew && !locked && !isActive ? (
          <p className="text-[12.5px] leading-5 text-slate-500">
            Closing an account hides it from new journal entries. Everything already posted to it
            stays on the books and in your statements.
          </p>
        ) : null}
      </div>
    </Modal>
  );
}
