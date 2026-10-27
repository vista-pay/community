'use client';

import { useMemo, useState } from 'react';
import { CheckCircle2, HandCoins, Package, Plus, Send, Download, ShieldCheck } from 'lucide-react';
import {
  AmountInput,
  Badge,
  Button,
  Callout,
  Card,
  CardHeader,
  ConfirmDialog,
  DataTable,
  EmptyState,
  Field,
  Input,
  KV,
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
import { sumMoney } from '@/lib/money';
import type {
  AjoGroupSummary,
  Loan,
  LoanApplicationDetail,
  LoanProduct,
  LoanQuote,
} from '@/types';

type Tab = 'applications' | 'products';

interface GroupLoans {
  group: AjoGroupSummary;
  loans: Loan[];
}

const AWAITING: Loan['status'][] = ['SUBMITTED', 'UNDER_REVIEW'];
const RUNNING: Loan['status'][] = ['DISBURSED', 'REPAYING'];

export function LoansClient({
  products: initialProducts,
  loansByGroup,
}: {
  products: LoanProduct[];
  loansByGroup: GroupLoans[];
}) {
  const communityId = useCommunityId();
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>('applications');
  const [productOpen, setProductOpen] = useState(false);
  const [quoting, setQuoting] = useState<LoanProduct | null>(null);
  const [deciding, setDeciding] = useState<{ loan: Loan; approve: boolean } | null>(null);
  const [viewing, setViewing] = useState<Loan | null>(null);

  const products = useQuery(() => portalApi.loanProducts(communityId), [communityId], {
    initial: initialProducts,
  });

  // This portal's primary queue is community-funded. Keep compatibility with
  // any legacy Ajo-group rows while using the correct community endpoint for
  // the synthetic community bucket created by the server page.
  const [groups, setGroups] = useState(loansByGroup);
  async function refreshLoans() {
    const next = await Promise.all(
      groups.map(async (g) => ({
        group: g.group,
        loans: await (g.group.groupId === 'community'
          ? portalApi.communityLoans(communityId)
          : portalApi.groupLoans(g.group.groupId)
        ).catch(() => g.loans),
      })),
    );
    setGroups(next);
  }

  const allLoans = useMemo(
    () => groups.flatMap((g) => g.loans.map((l) => ({ ...l, groupName: g.group.name }))),
    [groups],
  );

  const awaiting = allLoans.filter((l) => AWAITING.includes(l.status));
  const running = allLoans.filter((l) => RUNNING.includes(l.status));
  const outstanding = sumMoney(running.map((l) => l.outstanding));

  const review = useMutation(
    (loanId: string, approve: boolean, notes?: string) =>
      portalApi.reviewLoan(loanId, approve, undefined, notes),
    {
      onSuccess: async () => {
        toast('Decision recorded', 'success');
        setDeciding(null);
        await refreshLoans();
      },
      onError: (message) => toast('Could not record the decision', 'error', message),
    },
  );

  const disburse = useMutation((loanId: string) => portalApi.disburseLoan(loanId), {
    onSuccess: async () => {
      toast('Loan disbursed', 'success', 'The money has left the group pool.');
      await refreshLoans();
    },
    onError: (message) => toast('Could not disburse', 'error', message),
  });

  return (
    <>
      <PageHeader
        title="Loans"
        subtitle="Review member applications, guarantors, affordability, and lending terms"
        actions={
          tab === 'products' ? (
            <Button icon={<Plus className="h-4 w-4" />} onClick={() => setProductOpen(true)}>
              New product
            </Button>
          ) : null
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat
          label="Awaiting a decision"
          value={awaiting.length}
          icon={<HandCoins className="h-4 w-4" />}
          tone={awaiting.length ? 'warning' : 'default'}
        />
        <Stat label="Running loans" value={running.length} icon={<CheckCircle2 className="h-4 w-4" />} />
        <Stat label="Outstanding" value={money(outstanding)} icon={<Package className="h-4 w-4" />} />
      </div>

      <Tabs
        className="mt-6"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'applications', label: 'Applications', count: awaiting.length || undefined },
          { value: 'products', label: 'Products', count: (products.data ?? []).length },
        ]}
      />

      <div className="mt-4">
        {tab === 'applications' && (
          <Card>
            <DataTable
              rows={allLoans}
              rowKey={(l) => l.id}
              columns={[
                {
                  key: 'ref',
                  header: 'Reference',
                  cell: (l) => (
                    <span>
                      <span className="block font-medium text-navy-900">{l.loanReference}</span>
                      <span className="block text-xs text-slate-500">{l.groupName}</span>
                    </span>
                  ),
                },
                {
                  key: 'borrower',
                  header: 'Borrower',
                  cell: (l) => l.borrower ?? '—',
                },
                {
                  key: 'principal',
                  header: 'Principal',
                  align: 'right',
                  cell: (l) => money(l.principal, l.currencyCode),
                },
                {
                  key: 'outstanding',
                  header: 'Outstanding',
                  align: 'right',
                  hideOnMobile: true,
                  cell: (l) => money(l.outstanding, l.currencyCode),
                },
                {
                  key: 'due',
                  header: 'Due',
                  hideOnMobile: true,
                  cell: (l) => (l.dueDate ? date(l.dueDate) : '—'),
                },
                { key: 'status', header: 'Status', cell: (l) => <StatusBadge status={l.status.toLowerCase()} /> },
                {
                  key: 'actions',
                  header: '',
                  align: 'right',
                  cell: (l) => (
                    <span className="flex justify-end gap-1.5">
                      <Button size="xs" variant="secondary" onClick={() => setViewing(l)}>
                        Review application
                      </Button>
                      {AWAITING.includes(l.status) && (
                        <>
                          <Button
                            size="xs"
                            variant="ghost"
                            onClick={() => setDeciding({ loan: l, approve: false })}
                          >
                            Reject
                          </Button>
                          <Button
                            size="xs"
                            variant="secondary"
                            onClick={() => setDeciding({ loan: l, approve: true })}
                          >
                            Approve
                          </Button>
                        </>
                      )}
                      {l.status === 'APPROVED' && (
                        <Button
                          size="xs"
                          icon={<Send className="h-3.5 w-3.5" />}
                          loading={disburse.pending}
                          onClick={() => void disburse.run(l.id)}
                        >
                          Disburse
                        </Button>
                      )}
                    </span>
                  ),
                },
              ]}
              empty={
                <EmptyState
                  icon={<HandCoins className="h-5 w-5" />}
                  title="No loan applications"
                  body="Applications submitted by community members will appear here for review."
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
                  icon={<Package className="h-5 w-5" />}
                  title="No loan products"
                  body="A product fixes the rate, the tenors and who has to approve, so applications are judged against written terms."
                  action={<Button onClick={() => setProductOpen(true)}>Create a product</Button>}
                />
              </Card>
            ) : (
              (products.data ?? []).map((p) => (
                <Card key={p.id}>
                  <CardHeader
                    title={p.name}
                    subtitle={p.description ?? undefined}
                    action={<StatusBadge status={p.status.toLowerCase()} />}
                  />
                  <dl className="grid grid-cols-2 gap-4 px-5 py-4 sm:grid-cols-4">
                    <KV label="Rate">{p.rateLabel}</KV>
                    <KV label="Amount">
                      {money(p.minPrincipal, p.currencyCode, { decimals: false })} –{' '}
                      {money(p.maxPrincipal, p.currencyCode, { decimals: false })}
                    </KV>
                    <KV label="Tenors">{p.tenorMonths.join(', ')} months</KV>
                    <KV label="Loans">{p.loanCount}</KV>
                  </dl>
                  {p.eligibility.length > 0 && (
                    <ul className="flex flex-wrap gap-1.5 px-5 pb-4">
                      {p.eligibility.map((e) => (
                        <li key={e}>
                          <Badge tone="slate">{e}</Badge>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="border-t border-slate-100 px-5 py-3">
                    <Button size="sm" variant="secondary" onClick={() => setQuoting(p)}>
                      Quote a loan
                    </Button>
                  </div>
                </Card>
              ))
            )}
          </div>
        )}
      </div>

      <ProductModal
        open={productOpen}
        onClose={() => setProductOpen(false)}
        communityId={communityId}
        onDone={products.refresh}
      />

      <QuoteModal product={quoting} communityId={communityId} onClose={() => setQuoting(null)} />

      {viewing && (
        <LoanDetailModal
          loan={viewing}
          onClose={() => setViewing(null)}
          onDecide={(approve) => {
            setDeciding({ loan: viewing, approve });
            setViewing(null);
          }}
          onDisburse={() => {
            void disburse.run(viewing.id);
            setViewing(null);
          }}
        />
      )}

      <ConfirmDialog
        open={Boolean(deciding)}
        onClose={() => setDeciding(null)}
        title={deciding?.approve ? 'Approve this loan?' : 'Reject this loan?'}
        confirmLabel={deciding?.approve ? 'Approve' : 'Reject'}
        tone={deciding?.approve ? 'primary' : 'danger'}
        requireReason={!deciding?.approve}
        reasonLabel="Reason"
        loading={review.pending}
        onConfirm={(reason) =>
          deciding && void review.run(deciding.loan.id, deciding.approve, reason || undefined)
        }
        body={
          deciding?.approve ? (
            <>
              {deciding.loan.borrower ?? 'The member'} would be approved for{' '}
              {money(deciding.loan.principal, deciding.loan.currencyCode)}. Approving does not move
              money — you disburse it as a separate step.
            </>
          ) : (
            <>The applicant is told the decision. Give a reason they can act on.</>
          )
        }
      />
    </>
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
  const [minPrincipal, setMinPrincipal] = useState('');
  const [maxPrincipal, setMaxPrincipal] = useState('');
  const [tenors, setTenors] = useState('6, 12');
  const [ratePercent, setRatePercent] = useState('2');
  const [frequency, setFrequency] = useState('MONTHLY');
  const [processingPercent, setProcessingPercent] = useState('1');
  const [eligibility, setEligibility] = useState('');

  const create = useMutation(
    () =>
      portalApi.createLoanProduct(communityId, {
        name: name.trim(),
        minPrincipal,
        maxPrincipal,
        tenorMonths: tenors
          .split(',')
          .map((t) => Number(t.trim()))
          .filter((n) => Number.isFinite(n) && n > 0),
        // Shown as a percentage, stored as the fraction the API calculates with.
        interestRate: String(Number(ratePercent) / 100),
        rateLabel: `${ratePercent}% per month, flat`,
        repaymentFrequency: frequency,
        processingFeePercent: String(Number(processingPercent) / 100),
        eligibility: eligibility
          .split('\n')
          .map((l) => l.trim())
          .filter(Boolean),
      }),
    {
      onSuccess: async () => {
        toast('Product created', 'success');
        onClose();
        await onDone();
      },
      onError: (message) => toast('Could not create the product', 'error', message),
    },
  );

  const valid =
    name.trim().length > 2 && Number(minPrincipal) > 0 && Number(maxPrincipal) >= Number(minPrincipal);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New loan product"
      description="Terms are frozen once loans are running on a product."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!valid} loading={create.pending} onClick={() => void create.run()}>
            Create
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {create.error && <Callout tone="danger">{create.error}</Callout>}

        <Field label="Name" htmlFor="lp-name" required>
          <Input
            id="lp-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Member development loan"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Minimum" htmlFor="lp-min" required>
            <AmountInput id="lp-min" value={minPrincipal} onChange={setMinPrincipal} />
          </Field>
          <Field label="Maximum" htmlFor="lp-max" required>
            <AmountInput id="lp-max" value={maxPrincipal} onChange={setMaxPrincipal} />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Rate" htmlFor="lp-rate" required hint="Flat, per month">
            <Input
              id="lp-rate"
              type="number"
              step="0.1"
              min="0"
              value={ratePercent}
              onChange={(e) => setRatePercent(e.target.value)}
              suffix="%"
            />
          </Field>
          <Field label="Processing fee" htmlFor="lp-fee">
            <Input
              id="lp-fee"
              type="number"
              step="0.1"
              min="0"
              value={processingPercent}
              onChange={(e) => setProcessingPercent(e.target.value)}
              suffix="%"
            />
          </Field>
          <Field label="Repayment" htmlFor="lp-freq" required>
            <Select id="lp-freq" value={frequency} onChange={(e) => setFrequency(e.target.value)}>
              <option value="MONTHLY">Monthly</option>
              <option value="WEEKLY">Weekly</option>
            </Select>
          </Field>
        </div>

        <Field label="Tenors" htmlFor="lp-tenors" required hint="Months, comma separated">
          <Input id="lp-tenors" value={tenors} onChange={(e) => setTenors(e.target.value)} />
        </Field>

        <Field label="Eligibility" htmlFor="lp-elig" optional hint="One condition per line">
          <Textarea
            id="lp-elig"
            rows={3}
            value={eligibility}
            onChange={(e) => setEligibility(e.target.value)}
            placeholder={'6 months of membership\nNo active loan\nTwo guarantors'}
          />
        </Field>
      </div>
    </Modal>
  );
}

function QuoteModal({
  product,
  communityId,
  onClose,
}: {
  product: LoanProduct | null;
  communityId: string;
  onClose: () => void;
}) {
  const [principal, setPrincipal] = useState('');
  const [tenor, setTenor] = useState<number>(product?.tenorMonths[0] ?? 6);
  const [quote, setQuote] = useState<LoanQuote | null>(null);

  const run = useMutation(
    () => portalApi.quoteLoan(communityId, product!.id, { principal, tenorMonths: tenor }),
    { onSuccess: setQuote },
  );

  if (!product) return null;

  return (
    <Modal
      open
      onClose={onClose}
      title={`Quote — ${product.name}`}
      description={product.rateLabel}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          {quote && (
            <Button variant="secondary" icon={<Download className="h-4 w-4" />} onClick={() => downloadQuote(quote)}>
              Download
            </Button>
          )}
          <Button
            disabled={Number(principal) <= 0}
            loading={run.pending}
            onClick={() => void run.run()}
          >
            Calculate
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {run.error && <Callout tone="danger">{run.error}</Callout>}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Amount" htmlFor="q-principal" required>
            <AmountInput id="q-principal" value={principal} onChange={setPrincipal} />
          </Field>
          <Field label="Tenor" htmlFor="q-tenor" required>
            <Select id="q-tenor" value={String(tenor)} onChange={(e) => setTenor(Number(e.target.value))}>
              {product.tenorMonths.map((t) => (
                <option key={t} value={t}>
                  {t} months
                </option>
              ))}
            </Select>
          </Field>
        </div>

        {quote && (
          <div className="rounded-lg border border-slate-200">
            <dl className="divide-y divide-slate-100">
              <QuoteRow label="Principal" value={money(quote.principal, quote.currencyCode)} />
              <QuoteRow
                label="Service charge"
                value={money(quote.serviceCharge, quote.currencyCode)}
              />
              <QuoteRow
                label="Processing fee"
                value={money(quote.processingFee, quote.currencyCode)}
              />
              <QuoteRow
                label="Member receives"
                value={money(quote.netDisbursed, quote.currencyCode)}
                strong
              />
              <QuoteRow
                label="Total repayable"
                value={money(quote.totalRepayable, quote.currencyCode)}
                strong
              />
              <QuoteRow
                label={`${quote.instalments} instalments of`}
                value={money(quote.perInstalment, quote.currencyCode)}
              />
              <QuoteRow
                label="Final instalment"
                value={money(quote.finalInstalment, quote.currencyCode)}
              />
            </dl>
          </div>
        )}
      </div>
    </Modal>
  );
}

/** The quote as a file the officer can hand to the member. */
function downloadQuote(quote: LoanQuote) {
  const row = (label: string, value: string) => `${label},${value}`;
  const lines = [
    row('Product', quote.product.name),
    row('Rate', quote.product.rateLabel),
    row('Principal', money(quote.principal, quote.currencyCode)),
    row('Service charge', money(quote.serviceCharge, quote.currencyCode)),
    row('Processing fee', money(quote.processingFee, quote.currencyCode)),
    row('Member receives', money(quote.netDisbursed, quote.currencyCode)),
    row('Total repayable', money(quote.totalRepayable, quote.currencyCode)),
    row(`Instalments (${quote.instalments})`, money(quote.perInstalment, quote.currencyCode)),
    row('Final instalment', money(quote.finalInstalment, quote.currencyCode)),
    row('Tenor', `${quote.tenorMonths} months`),
    row('Generated', new Date().toLocaleString('en-GB')),
    row('Note', 'Illustrative quote — final terms are set by the loan committee'),
  ];
  const url = URL.createObjectURL(
    new Blob([`Item,Value\n${lines.join('\n')}`], { type: 'text/csv' }),
  );
  const a = Object.assign(document.createElement('a'), {
    href: url,
    download: `loan-quote-${quote.product.name.toLowerCase().replace(/\s+/g, '-')}.csv`,
  });
  a.click();
  URL.revokeObjectURL(url);
}

function QuoteRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between px-4 py-2">
      <dt className={strong ? 'text-[13px] font-semibold text-navy-900' : 'text-[13px] text-slate-600'}>
        {label}
      </dt>
      <dd className={`tnum text-[13px] ${strong ? 'font-semibold text-navy-900' : 'text-navy-800'}`}>
        {value}
      </dd>
    </div>
  );
}

/** The application as the committee should read it: the person, the ask,
 * who stands behind it. */
function LoanDetailModal({
  loan,
  onClose,
  onDecide,
  onDisburse,
}: {
  loan: Loan;
  onClose: () => void;
  onDecide: (approve: boolean) => void;
  onDisburse: () => void;
}) {
  const { data, error } = useQuery<LoanApplicationDetail>(() => portalApi.loanDetail(loan.id), [loan.id]);
  const d = data;

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={`Loan application — ${loan.loanReference}`}
      description={d?.purpose ?? loan.purpose ?? undefined}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          {['SUBMITTED', 'UNDER_REVIEW'].includes(loan.status) && (
            <>
              <Button variant="danger" onClick={() => onDecide(false)}>
                Reject
              </Button>
              <Button onClick={() => onDecide(true)}>Approve</Button>
            </>
          )}
          {loan.status === 'APPROVED' && (
            <Button icon={<Send className="h-4 w-4" />} onClick={onDisburse}>
              Disburse
            </Button>
          )}
        </>
      }
    >
      {error ? (
        <Callout tone="danger">{error}</Callout>
      ) : !d ? (
        <p className="py-8 text-center text-sm text-slate-500">Loading application…</p>
      ) : (
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Borrower
              </p>
              <p className="mt-1 text-sm font-semibold text-navy-900">{d.borrower?.name ?? '—'}</p>
              <p className="text-xs text-slate-500">{d.borrower?.email}</p>
              <p className="text-xs text-slate-500">{d.borrower?.phone}</p>
              {d.borrower && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <Badge tone={d.borrower.kycStatus === 'APPROVED' ? 'green' : 'amber'}>
                    <ShieldCheck className="mr-1 inline h-3 w-3" />
                    {humanise(d.borrower.kycTier)} · {humanise(d.borrower.kycStatus)}
                  </Badge>
                  <Badge tone={d.borrower.membershipStatus === 'ACTIVE' ? 'green' : 'slate'}>
                    {humanise(d.borrower.membershipStatus)} member
                  </Badge>
                </div>
              )}
              {d.borrower?.memberSince && (
                <p className="mt-2 text-xs text-slate-500">
                  Member since {date(d.borrower.memberSince)}
                </p>
              )}
            </div>
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Status
              </p>
              <div className="mt-1">
                <StatusBadge status={d.status.toLowerCase()} />
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Applied {date(d.createdAt)}
                {d.approvedAt ? ` · approved ${date(d.approvedAt)}` : ''}
                {d.termsAcceptedAt ? ` · terms accepted ${date(d.termsAcceptedAt)}` : ''}
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Request
              </p>
              <p className="mt-1 text-sm font-medium text-navy-900">
                {d.purpose || 'No purpose supplied'}
              </p>
              <p className="mt-2 text-xs text-slate-500">
                {d.productName ? `${d.productName} · ` : ''}{d.termDays} days
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Member position
              </p>
              <p className="mt-1 text-sm font-semibold text-navy-900">
                {d.borrower?.savingsBalance == null
                  ? 'Savings not available'
                  : money(d.borrower.savingsBalance, d.currencyCode)}
              </p>
              <p className="text-xs text-slate-500">Community savings balance</p>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200">
            <dl className="divide-y divide-slate-100">
              <DetailRow label="Principal" value={money(d.principal, d.currencyCode)} />
              <DetailRow label="Interest" value={money(d.interestAmount, d.currencyCode)} />
              <DetailRow label="Processing fee" value={money(d.processingFee, d.currencyCode)} />
              <DetailRow label="Member receives" value={money(d.netDisbursed, d.currencyCode)} />
              <DetailRow
                label="Repayment"
                value={
                  d.schedule.length
                    ? `${d.schedule.length} × ${money(d.schedule[0].amount, d.currencyCode)} from ${date(d.schedule[0].dueDate)}`
                    : `${d.termDays} days`
                }
              />
              <DetailRow label="Total repayable" value={money(d.totalRepayable, d.currencyCode)} strong />
            </dl>
          </div>

          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Guarantors ({d.guarantors.length})
            </p>
            {d.guarantors.length === 0 && (
              <p className="text-sm text-slate-500">No guarantors were named.</p>
            )}
            <div className="space-y-2">
              {d.guarantors.map((g) => (
                <div
                  key={g.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-navy-900">
                      {g.name}
                      {g.external && <span className="ml-1.5 text-xs text-slate-400">external</span>}
                    </p>
                    <p className="text-xs text-slate-500">
                      {[g.email, g.phone].filter(Boolean).join(' · ') || 'Member of this community'}
                    </p>
                    {g.kycTier && (
                      <p className="mt-1 text-xs text-slate-500">
                        Identity: {humanise(g.kycTier)} · {humanise(g.kycStatus ?? 'NOT_STARTED')}
                      </p>
                    )}
                  </div>
                  <Badge tone={g.status === 'CONFIRMED' ? 'green' : g.status === 'DECLINED' ? 'red' : 'amber'}>
                    {humanise(g.status)}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}

function DetailRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5">
      <dt className="text-[13px] text-slate-500">{label}</dt>
      <dd className={`tnum text-[13px] ${strong ? 'font-bold text-navy-900' : 'font-medium text-navy-900'}`}>
        {value}
      </dd>
    </div>
  );
}
