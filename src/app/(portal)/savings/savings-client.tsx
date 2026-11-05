'use client';

import { MoneyOutOtpDialog, useMoneyOutOtp } from '@/components/money-out-otp';
import { useState } from 'react';
import { AlertTriangle, Landmark, Lock, PiggyBank, Plus } from 'lucide-react';
import {
  AmountInput,
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
  StatusBadge,
  Stat,
  Tabs,
  Textarea,
} from '@/components/ui';
import { useMutation, useQuery } from '@/hooks/use-query';
import { useCommunityId } from '@/components/providers/session-provider';
import { useToast } from '@/components/providers/toast-provider';
import { portalApi } from '@/services/portal';
import { date, humanise, money } from '@/lib/format';
import type { MemberRow, SavingsAccountRow, SavingsOverview, SavingsProduct } from '@/types';

type Tab = 'accounts' | 'products';

export function SavingsClient({
  initial,
}: {
  initial: { overview: SavingsOverview; products: SavingsProduct[]; members: MemberRow[] };
}) {
  const communityId = useCommunityId();
  const [tab, setTab] = useState<Tab>('accounts');
  const [openAccount, setOpenAccount] = useState(false);
  const [productOpen, setProductOpen] = useState(false);
  const [entryFor, setEntryFor] = useState<SavingsAccountRow | null>(null);
  const [statementFor, setStatementFor] = useState<SavingsAccountRow | null>(null);

  const overview = useQuery(() => portalApi.savingsAccounts(communityId), [communityId], {
    initial: initial.overview,
  });
  const products = useQuery(() => portalApi.savingsProducts(communityId), [communityId], {
    initial: initial.products,
  });

  const data = overview.data ?? initial.overview;

  return (
    <>
      <PageHeader
        title="Savings"
        subtitle="What members have saved with the community, tied to account 2000 in the books"
        actions={
          tab === 'accounts' ? (
            <Button
              icon={<Plus className="h-4 w-4" />}
              disabled={(products.data ?? []).length === 0}
              title={
                (products.data ?? []).length === 0 ? 'Create a savings product first' : undefined
              }
              onClick={() => setOpenAccount(true)}
            >
              Open an account
            </Button>
          ) : (
            <Button icon={<Plus className="h-4 w-4" />} onClick={() => setProductOpen(true)}>
              New product
            </Button>
          )
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat
          label="Total member savings"
          value={money(data.totals.savingsLedger)}
          hint={`${data.totals.members} account${data.totals.members === 1 ? '' : 's'}`}
          icon={<PiggyBank className="h-4 w-4" />}
        />
        <Stat
          label="Control account 2000"
          value={money(data.totals.controlAccount)}
          hint="What the books say is owed to members"
          icon={<Landmark className="h-4 w-4" />}
        />
        <Stat
          label="Agreement"
          value={data.totals.inAgreement ? 'In step' : money(data.totals.difference)}
          hint={data.totals.inAgreement ? 'Ledger matches the books' : 'Savings ledger vs the books'}
          icon={<AlertTriangle className="h-4 w-4" />}
          tone={data.totals.inAgreement ? 'positive' : 'danger'}
        />
      </div>

      {!data.totals.inAgreement && (
        <Callout tone="danger" className="mt-4" title="The savings ledger and the books disagree">
          The member accounts add up to {money(data.totals.savingsLedger)} but control account
          2000 shows {money(data.totals.controlAccount)}. Every deposit recorded here posts to the
          books in the same transaction, so a gap means something was posted to 2000 by hand.
        </Callout>
      )}

      <WithdrawalRequestsCard onSettled={() => void overview.refresh()} />

      <Tabs
        className="mt-6"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'accounts', label: 'Member accounts', count: data.accounts.length },
          { value: 'products', label: 'Products', count: (products.data ?? []).length },
        ]}
      />

      <div className="mt-4">
        {tab === 'accounts' && (
          <Card>
            <DataTable
              rows={data.accounts}
              rowKey={(a) => a.id}
              loading={overview.loading}
              columns={[
                {
                  key: 'member',
                  header: 'Member',
                  cell: (a) => (
                    <span>
                      <span className="block font-medium text-navy-900">{a.memberName}</span>
                      <span className="block text-xs text-slate-500">{a.accountNumber}</span>
                    </span>
                  ),
                },
                {
                  key: 'product',
                  header: 'Product',
                  cell: (a) => (
                    <span className="flex items-center gap-2">
                      {a.product.name}
                      {a.product.policy === 'LOCKED' && (
                        <Lock className="h-3.5 w-3.5 text-slate-400" aria-label="Locked" />
                      )}
                    </span>
                  ),
                },
                { key: 'balance', header: 'Balance', align: 'right', cell: (a) => money(a.balance) },
                {
                  key: 'status',
                  header: 'Status',
                  cell: (a) => <StatusBadge status={a.status.toLowerCase()} />,
                },
                {
                  key: 'opened',
                  header: 'Opened',
                  hideOnMobile: true,
                  cell: (a) => <span className="text-slate-500">{date(a.openedAt)}</span>,
                },
                {
                  key: 'actions',
                  header: '',
                  align: 'right',
                  cell: (a) => (
                    <span className="flex justify-end gap-1.5">
                      <Button size="xs" variant="ghost" onClick={() => setStatementFor(a)}>
                        Statement
                      </Button>
                      <Button size="xs" variant="secondary" onClick={() => setEntryFor(a)}>
                        Record
                      </Button>
                    </span>
                  ),
                },
              ]}
              empty={
                <EmptyState
                  icon={<PiggyBank className="h-5 w-5" />}
                  title="No savings accounts"
                  body="Create a product, then open accounts for the members who save with you."
                />
              }
            />
          </Card>
        )}

        {tab === 'products' && (
          <div className="grid gap-4 md:grid-cols-2">
            {(products.data ?? []).length === 0 ? (
              <Card className="md:col-span-2">
                <EmptyState
                  icon={<PiggyBank className="h-5 w-5" />}
                  title="No savings products"
                  body="A product sets the interest rate, the minimum balance and whether members can withdraw."
                  action={<Button onClick={() => setProductOpen(true)}>Create a product</Button>}
                />
              </Card>
            ) : (
              (products.data ?? []).map((p) => (
                <Card key={p.id}>
                  <CardHeader
                    title={p.name}
                    subtitle={p.description ?? undefined}
                    action={
                      <Badge tone={p.withdrawalPolicy === 'LOCKED' ? 'amber' : 'green'}>
                        {p.withdrawalPolicy === 'LOCKED'
                          ? 'No withdrawals'
                          : p.withdrawalPolicy === 'NOTICE'
                            ? `${p.noticeDays} days notice`
                            : 'Withdraw anytime'}
                      </Badge>
                    }
                  />
                  <dl className="grid grid-cols-3 gap-4 px-5 py-4 text-[13px]">
                    <div>
                      <dt className="text-xs text-slate-500">Interest</dt>
                      <dd className="font-medium text-navy-900">
                        {(Number(p.interestRate) * 100).toFixed(2)}% a year
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500">Minimum</dt>
                      <dd className="font-medium text-navy-900">{money(p.minBalance)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500">Accounts</dt>
                      <dd className="font-medium text-navy-900">{p._count?.accounts ?? 0}</dd>
                    </div>
                  </dl>
                </Card>
              ))
            )}
          </div>
        )}
      </div>

      <OpenAccountModal
        open={openAccount}
        onClose={() => setOpenAccount(false)}
        communityId={communityId}
        members={initial.members}
        products={products.data ?? []}
        onDone={overview.refresh}
      />

      <ProductModal
        open={productOpen}
        onClose={() => setProductOpen(false)}
        communityId={communityId}
        onDone={products.refresh}
      />

      <EntryModal
        account={entryFor}
        communityId={communityId}
        onClose={() => setEntryFor(null)}
        onDone={async () => {
          setEntryFor(null);
          await overview.refresh();
        }}
      />

      <StatementModal
        account={statementFor}
        communityId={communityId}
        onClose={() => setStatementFor(null)}
      />
    </>
  );
}

function OpenAccountModal({
  open,
  onClose,
  communityId,
  members,
  products,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  communityId: string;
  members: MemberRow[];
  products: SavingsProduct[];
  onDone: () => Promise<void>;
}) {
  const { toast } = useToast();
  const [memberId, setMemberId] = useState('');
  const [productId, setProductId] = useState('');

  const create = useMutation(
    () => portalApi.openSavingsAccount(communityId, { memberId, productId }),
    {
      onSuccess: async () => {
        toast('Account opened', 'success');
        setMemberId('');
        setProductId('');
        onClose();
        await onDone();
      },
      onError: (message) => toast('Could not open the account', 'error', message),
    },
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Open a savings account"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!memberId || !productId}
            loading={create.pending}
            onClick={() => void create.run()}
          >
            Open account
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {create.error && <Callout tone="danger">{create.error}</Callout>}
        <Field label="Member" htmlFor="sa-member" required>
          <Select id="sa-member" value={memberId} onChange={(e) => setMemberId(e.target.value)}>
            <option value="">Choose a member…</option>
            {members
              .filter((m) => m.status === 'ACTIVE')
              .map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} — {m.memberNumber}
                </option>
              ))}
          </Select>
        </Field>
        <Field label="Product" htmlFor="sa-product" required>
          <Select id="sa-product" value={productId} onChange={(e) => setProductId(e.target.value)}>
            <option value="">Choose a product…</option>
            {products
              .filter((p) => p.isActive)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
          </Select>
        </Field>
      </div>
    </Modal>
  );
}

function ProductModal({
  open,
  onClose,
  communityId,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  communityId: string;
  onDone: () => Promise<void>;
}) {
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [interestRate, setInterestRate] = useState('0');
  const [minBalance, setMinBalance] = useState('0');
  const [withdrawalPolicy, setWithdrawalPolicy] = useState('LOCKED');
  const [noticeDays, setNoticeDays] = useState('30');

  const create = useMutation(
    () =>
      portalApi.createSavingsProduct(communityId, {
        name: name.trim(),
        description: description.trim() || undefined,
        // Entered as a percentage; stored as the fraction the API expects.
        interestRate: String(Number(interestRate) / 100),
        minBalance,
        withdrawalPolicy,
        noticeDays: withdrawalPolicy === 'NOTICE' ? Number(noticeDays) : 0,
      }),
    {
      onSuccess: async () => {
        toast('Product created', 'success');
        setName('');
        setDescription('');
        onClose();
        await onDone();
      },
      onError: (message) => toast('Could not create the product', 'error', message),
    },
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New savings product"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={name.trim().length < 2}
            loading={create.pending}
            onClick={() => void create.run()}
          >
            Create
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {create.error && <Callout tone="danger">{create.error}</Callout>}

        <Field label="Name" htmlFor="sp-name" required>
          <Input
            id="sp-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ordinary savings"
          />
        </Field>

        <Field label="Description" htmlFor="sp-desc" optional>
          <Textarea
            id="sp-desc"
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Interest rate" htmlFor="sp-rate" hint="Per year">
            <Input
              id="sp-rate"
              type="number"
              step="0.01"
              min="0"
              value={interestRate}
              onChange={(e) => setInterestRate(e.target.value)}
              suffix="%"
            />
          </Field>
          <Field label="Minimum balance" htmlFor="sp-min">
            <AmountInput id="sp-min" value={minBalance} onChange={setMinBalance} />
          </Field>
        </div>

        <Field
          label="Withdrawals"
          htmlFor="sp-policy"
          required
          hint="Most cooperatives release savings only at year end or on exit"
        >
          <Select
            id="sp-policy"
            value={withdrawalPolicy}
            onChange={(e) => setWithdrawalPolicy(e.target.value)}
          >
            <option value="LOCKED">Not permitted</option>
            <option value="NOTICE">After notice</option>
            <option value="ANYTIME">Any time</option>
          </Select>
        </Field>

        {withdrawalPolicy === 'NOTICE' && (
          <Field label="Notice period" htmlFor="sp-notice" required>
            <Input
              id="sp-notice"
              type="number"
              min="1"
              value={noticeDays}
              onChange={(e) => setNoticeDays(e.target.value)}
              suffix="days"
            />
          </Field>
        )}
      </div>
    </Modal>
  );
}

function EntryModal({
  account,
  communityId,
  onClose,
  onDone,
}: {
  account: SavingsAccountRow | null;
  communityId: string;
  onClose: () => void;
  onDone: () => Promise<void>;
}) {
  const { toast } = useToast();
  const [type, setType] = useState<'DEPOSIT' | 'WITHDRAWAL' | 'INTEREST' | 'ADJUSTMENT'>('DEPOSIT');
  const [amount, setAmount] = useState('');
  const [cashAccountCode, setCashAccountCode] = useState('1010');
  const [note, setNote] = useState('');

  const record = useMutation(
    () =>
      portalApi.recordSavingsEntry(communityId, account!.id, {
        type,
        amount,
        cashAccountCode: type === 'INTEREST' ? undefined : cashAccountCode,
        note: note.trim() || undefined,
      }),
    {
      onSuccess: async () => {
        toast('Recorded', 'success', 'The matching journal entry is posted.');
        setAmount('');
        setNote('');
        await onDone();
      },
      onError: (message) => toast('Could not record it', 'error', message),
    },
  );

  if (!account) return null;

  const locked = account.product.policy === 'LOCKED' && type === 'WITHDRAWAL';

  return (
    <Modal
      open
      onClose={onClose}
      title={`${account.memberName} — ${account.accountNumber}`}
      description={`Balance ${money(account.balance)} · ${account.product.name}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={Number(amount) <= 0 || locked}
            loading={record.pending}
            onClick={() => void record.run()}
          >
            Record
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {record.error && <Callout tone="danger">{record.error}</Callout>}

        <Field label="Type" htmlFor="se-type" required>
          <Select
            id="se-type"
            value={type}
            onChange={(e) => setType(e.target.value as typeof type)}
          >
            <option value="DEPOSIT">Deposit</option>
            <option value="WITHDRAWAL">Withdrawal</option>
            <option value="INTEREST">Interest credit</option>
            <option value="ADJUSTMENT">Correction</option>
          </Select>
        </Field>

        {locked && (
          <Callout tone="warning" title="This product does not permit withdrawals">
            {account.product.name} is locked. Change the product&apos;s withdrawal policy before
            releasing funds — the rule is what members agreed to.
          </Callout>
        )}

        <Field label="Amount" htmlFor="se-amount" required>
          <AmountInput id="se-amount" value={amount} onChange={setAmount} />
        </Field>

        {type !== 'INTEREST' && (
          <Field
            label="Money moved through"
            htmlFor="se-cash"
            required
            hint="Which account in the books the cash hit"
          >
            <Select
              id="se-cash"
              value={cashAccountCode}
              onChange={(e) => setCashAccountCode(e.target.value)}
            >
              <option value="1010">1010 — Bank, main account</option>
              <option value="1000">1000 — Cash in hand</option>
              <option value="1020">1020 — Bank, Ajo collections</option>
            </Select>
          </Field>
        )}

        {type === 'INTEREST' && (
          <Callout tone="info">
            Interest is posted from accumulated surplus (3200) to members&apos; savings (2000). No
            cash moves.
          </Callout>
        )}

        <Field label="Note" htmlFor="se-note" optional>
          <Textarea id="se-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}

function StatementModal({
  account,
  communityId,
  onClose,
}: {
  account: SavingsAccountRow | null;
  communityId: string;
  onClose: () => void;
}) {
  const { data, loading } = useQuery(
    () => portalApi.savingsStatement(communityId, account!.id),
    [communityId, account?.id],
    { enabled: Boolean(account) },
  );

  if (!account) return null;

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={`Statement — ${account.memberName}`}
      description={account.accountNumber}
    >
      {loading && !data ? (
        <EmptyState compact title="Loading" body="Fetching the statement." />
      ) : !data ? (
        <EmptyState compact title="Could not load" body="Try again in a moment." />
      ) : (
        <>
          <div className="mb-4 rounded-lg bg-slate-50 px-4 py-3">
            <div className="flex items-center justify-between">
              <span className="text-[13px] text-slate-600">Current balance</span>
              <span className="tnum text-base font-semibold text-navy-900">
                {money(data.balance)}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {data.product.name} ·{' '}
              {data.product.policy === 'LOCKED'
                ? 'withdrawals not permitted'
                : data.product.policy === 'NOTICE'
                  ? `${data.product.noticeDays} days notice`
                  : 'withdraw any time'}
            </p>
          </div>

          {data.transactions.length === 0 ? (
            <EmptyState compact title="Nothing recorded yet" body="Entries appear here as they are recorded." />
          ) : (
            <ul className="divide-y divide-slate-100">
              {data.transactions.map((t) => (
                <li key={t.id} className="flex items-center gap-3 py-2.5">
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] text-navy-900">{humanise(t.type)}</span>
                    <span className="block text-xs text-slate-500">
                      {date(t.at, 'datetime')} · {t.reference}
                    </span>
                    {t.note && <span className="block text-xs italic text-slate-500">{t.note}</span>}
                  </span>
                  <span className="text-right">
                    <span className="tnum block text-[13px] font-medium text-navy-900">
                      {t.type === 'WITHDRAWAL' ? '−' : '+'}
                      {money(t.amount)}
                    </span>
                    <span className="tnum block text-xs text-slate-500">
                      {money(t.balanceAfter)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </Modal>
  );
}

/**
 * Member withdrawal requests from the app. Approving pays on the spot —
 * community wallet → member wallet, savings ledger and books in one
 * transaction — so the card only offers it to someone ready to move money.
 */
function WithdrawalRequestsCard({ onSettled }: { onSettled: () => void }) {
  const communityId = useCommunityId();
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState('');

  const requests = useQuery(
    () => portalApi.savingsWithdrawalRequests(communityId),
    [communityId],
  );

  // Approving releases community money, so it runs through the owner approval
  // gate. Rejecting moves nothing and the API asks for no code, so the same
  // gate handles both — the server decides which needs approval.
  const decide = useMoneyOutOtp<{ requestId: string; approve: boolean; note?: string }>({
    perform: (extra, { requestId, approve, note }) =>
      portalApi.decideSavingsWithdrawal(communityId, requestId, approve, note, extra),
    onDone: async () => {
      setRejectingId(null);
      setRejectNote('');
      await requests.refresh();
      onSettled();
    },
    successMessage: 'Decision recorded',
  });

  const pending = (requests.data ?? []).filter((r) => r.status === 'PENDING');
  if (pending.length === 0) return null;

  return (
    <Card className="mt-4">
      <CardHeader
        title={`Withdrawal requests (${pending.length})`}
        subtitle="Members asking for part — or all — of their savings back"
      />
      <div className="space-y-3 px-5 py-4">
        {pending.map((r) => (
          <div key={r.id} className="rounded-xl border border-slate-200 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-navy-900">
                  {r.memberName} · {money(r.amount)}
                  {r.amount === r.accountBalance && (
                    <Badge tone="amber" className="ml-2">Full withdrawal</Badge>
                  )}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {r.productName} · balance {money(r.accountBalance)} · asked {date(r.requestedAt)}
                </p>
                {r.note && <p className="mt-1 text-xs italic text-slate-600">“{r.note}”</p>}
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
                <Button
                  size="xs"
                  disabled={decide.pending}
                  onClick={() => void decide.run({ requestId: r.id, approve: true })}
                >
                  Approve & pay
                </Button>
                <Button
                  size="xs"
                  variant="ghost"
                  disabled={decide.pending}
                  onClick={() => {
                    setRejectingId(rejectingId === r.id ? null : r.id);
                    setRejectNote('');
                  }}
                >
                  Reject
                </Button>
              </div>
            </div>
            {rejectingId === r.id && (
              <div className="mt-3 flex flex-col gap-2 border-t border-slate-100 pt-3 sm:flex-row">
                <Input
                  value={rejectNote}
                  onChange={(e) => setRejectNote(e.target.value)}
                  placeholder="Reason the member can act on"
                  className="flex-1"
                />
                <Button
                  size="xs"
                  variant="danger"
                  disabled={decide.pending || rejectNote.trim().length < 5}
                  onClick={() =>
                    void decide.run({ requestId: r.id, approve: false, note: rejectNote.trim() })
                  }
                >
                  Confirm rejection
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>
      {/* The gate opens this when the server asks for the owner's code. */}
      <MoneyOutOtpDialog gate={decide} />
    </Card>
  );
}
