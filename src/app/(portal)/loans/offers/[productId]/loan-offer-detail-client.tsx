'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { ArrowLeft, BookOpen, CalendarClock, Edit3, FileText, Percent, Users } from 'lucide-react';
import { MoneyOutOtpDialog, useMoneyOutOtp } from '@/components/money-out-otp';
import { useCommunityId } from '@/components/providers/session-provider';
import { AmountInput, Badge, Button, Card, Field, Input, LinkButton, PageHeader, Select, Textarea } from '@/components/ui';
import { money } from '@/lib/format';
import { portalApi } from '@/services/portal';
import type { LoanProduct } from '@/types';

export function LoanOfferDetailClient({ product }: { product: LoanProduct }) {
  const communityId = useCommunityId();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(product.name);
  const [description, setDescription] = useState(product.description ?? '');
  const [minimum, setMinimum] = useState(product.minPrincipal);
  const [maximum, setMaximum] = useState(product.maxPrincipal);
  const [tenors, setTenors] = useState(product.tenorMonths.join(', '));
  const [rate, setRate] = useState(String(Number(product.interestRate) * 100));
  const [fee, setFee] = useState(String(Number(product.processingFeePercent) * 100));
  const [frequency, setFrequency] = useState(product.repaymentFrequency);
  const [eligibility, setEligibility] = useState(product.eligibility.join('\n'));
  const [approvals, setApprovals] = useState(product.requiredApprovals.join('\n'));
  const [status, setStatus] = useState(product.status);

  const update = useMoneyOutOtp<Record<string, unknown>>({
    perform: (extra, payload) => portalApi.updateLoanProduct(communityId, product.id, payload, extra),
    onDone: () => { setEditing(false); router.refresh(); },
    successMessage: 'Loan offer updated',
  });

  const submit = () => update.run({
    name: name.trim(),
    description: description.trim(),
    minPrincipal: minimum,
    maxPrincipal: maximum,
    tenorMonths: tenors.split(',').map((value) => Number(value.trim())).filter((value) => value > 0),
    interestRate: String(Number(rate || '0') / 100),
    rateLabel: `${Number(rate || '0')}% per month, flat`,
    repaymentFrequency: frequency,
    processingFeePercent: String(Number(fee || '0') / 100),
    eligibility: eligibility.split('\n').map((value) => value.trim()).filter(Boolean),
    requiredApprovals: approvals.split('\n').map((value) => value.trim()).filter(Boolean),
    status,
  });

  return <>
    <PageHeader
      title={product.name}
      subtitle="Loan offer terms, eligibility and approval settings"
      breadcrumb={<Link href="/loans/offers" className="inline-flex items-center gap-1.5 hover:text-navy-900"><ArrowLeft className="h-3.5 w-3.5" />Loan offers</Link>}
      actions={<>{!editing && <Button variant="secondary" icon={<Edit3 className="h-4 w-4" />} onClick={() => setEditing(true)}>Edit offer</Button>}<LinkButton href={`/loans/quote/${product.id}` as Route} icon={<FileText className="h-4 w-4" />}>Quote a loan</LinkButton></>}
    />

    <div className="grid gap-5 lg:grid-cols-[1.25fr_0.75fr]">
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 p-5 sm:p-6"><div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Offer overview</p><p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">{product.description || 'No description has been added.'}</p></div><Badge tone={product.status === 'ACTIVE' ? 'green' : 'amber'}>{product.status === 'ACTIVE' ? 'Available to members' : 'Paused'}</Badge></div>
        <dl className="grid gap-px bg-slate-200 sm:grid-cols-3"><Metric label="Rate" value={product.rateLabel} /><Metric label="Loan range" value={`${money(product.minPrincipal, product.currencyCode, { decimals: false })} – ${money(product.maxPrincipal, product.currencyCode, { decimals: false })}`} /><Metric label="Available tenors" value={`${product.tenorMonths.join(', ')} months`} /></dl>
      </Card>
      <Card className="p-5 sm:p-6"><p className="text-sm font-semibold text-navy-900">At a glance</p><div className="mt-4 space-y-4"><Summary icon={<Users className="h-4 w-4" />} label="Loans on this offer" value={String(product.loanCount)} /><Summary icon={<CalendarClock className="h-4 w-4" />} label="Repayment frequency" value={product.repaymentFrequency === 'WEEKLY' ? 'Weekly' : 'Monthly'} /><Summary icon={<Percent className="h-4 w-4" />} label="Processing fee" value={`${(Number(product.processingFeePercent) * 100).toFixed(2)}%`} /><Summary icon={<BookOpen className="h-4 w-4" />} label="Loans receivable account" value={product.receivableAccountCode ?? '1100 (standard)'} /></div></Card>
    </div>

    <div className="mt-5 grid gap-5 md:grid-cols-2">
      <RulesCard title="Eligibility" empty="No eligibility rules have been added." rules={product.eligibility} />
      <RulesCard title="Required approvals" empty="No additional approval roles are configured." rules={product.requiredApprovals} />
    </div>

    {editing && <Card className="mt-5">
      <div className="border-b border-slate-100 px-5 py-4 sm:px-6"><h2 className="font-semibold text-navy-900">Edit offer settings</h2><p className="mt-1 text-sm text-slate-500">Changes require the community owner&apos;s approval code. Rates and tenors cannot change while loans are running.</p></div>
      <div className="grid gap-5 p-5 sm:grid-cols-2 sm:p-6">
        <Field label="Offer name" htmlFor="offer-name" required><Input id="offer-name" value={name} onChange={(event) => setName(event.target.value)} /></Field>
        <Field label="Availability" htmlFor="offer-status"><Select id="offer-status" value={status} onChange={(event) => setStatus(event.target.value as LoanProduct['status'])}><option value="ACTIVE">Available to members</option><option value="PAUSED">Paused for new applications</option></Select></Field>
        <Field label="Description" htmlFor="offer-description" optional><Textarea id="offer-description" rows={4} value={description} onChange={(event) => setDescription(event.target.value)} /></Field>
        <div className="grid gap-5 sm:grid-cols-2"><Field label="Minimum loan" htmlFor="offer-min"><AmountInput id="offer-min" value={minimum} onChange={setMinimum} /></Field><Field label="Maximum loan" htmlFor="offer-max"><AmountInput id="offer-max" value={maximum} onChange={setMaximum} /></Field></div>
        <Field label="Available tenors" htmlFor="offer-tenors" hint="Months, separated by commas"><Input id="offer-tenors" value={tenors} onChange={(event) => setTenors(event.target.value)} /></Field>
        <Field label="Repayment frequency" htmlFor="offer-frequency"><Select id="offer-frequency" value={frequency} onChange={(event) => setFrequency(event.target.value as LoanProduct['repaymentFrequency'])}><option value="MONTHLY">Monthly</option><option value="WEEKLY">Weekly</option></Select></Field>
        <Field label="Interest per month" htmlFor="offer-rate"><Input id="offer-rate" type="number" min="0" step="0.1" suffix="%" value={rate} onChange={(event) => setRate(event.target.value)} /></Field>
        <Field label="Processing fee" htmlFor="offer-fee"><Input id="offer-fee" type="number" min="0" step="0.1" suffix="%" value={fee} onChange={(event) => setFee(event.target.value)} /></Field>
        <Field label="Eligibility" htmlFor="offer-eligibility" optional hint="One condition per line"><Textarea id="offer-eligibility" rows={4} value={eligibility} onChange={(event) => setEligibility(event.target.value)} /></Field>
        <Field label="Required approvals" htmlFor="offer-approvals" optional hint="One role or approval per line"><Textarea id="offer-approvals" rows={4} value={approvals} onChange={(event) => setApprovals(event.target.value)} /></Field>
      </div>
      <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50 px-5 py-4 sm:px-6"><Button variant="secondary" disabled={update.pending} onClick={() => setEditing(false)}>Cancel</Button><Button disabled={name.trim().length < 3 || Number(maximum) < Number(minimum)} loading={update.pending} onClick={() => void submit()}>Save changes</Button></div>
    </Card>}
    <MoneyOutOtpDialog gate={update} />
  </>;
}

function Metric({ label, value }: { label: string; value: string }) { return <div className="bg-white p-5"><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-1 text-base font-semibold text-navy-900">{value}</dd></div>; }
function Summary({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) { return <div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-50 text-brand-700">{icon}</span><div><p className="text-xs text-slate-500">{label}</p><p className="text-sm font-semibold text-navy-900">{value}</p></div></div>; }
function RulesCard({ title, empty, rules }: { title: string; empty: string; rules: string[] }) { return <Card className="p-5 sm:p-6"><h2 className="font-semibold text-navy-900">{title}</h2>{rules.length ? <ul className="mt-4 space-y-2">{rules.map((rule) => <li key={rule} className="flex gap-2 text-sm text-slate-600"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />{rule}</li>)}</ul> : <p className="mt-3 text-sm text-slate-500">{empty}</p>}</Card>; }
