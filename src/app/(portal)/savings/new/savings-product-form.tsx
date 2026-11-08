'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CheckCircle2, Lock, PiggyBank, ShieldCheck } from 'lucide-react';
import { AmountInput, Badge, Button, Card, Field, Input, PageHeader, Select, Textarea } from '@/components/ui';
import { MoneyOutOtpDialog, useMoneyOutOtp } from '@/components/money-out-otp';
import { useCommunityId } from '@/components/providers/session-provider';
import { money } from '@/lib/format';
import { portalApi } from '@/services/portal';

type SavingsProductPayload = {
  name: string;
  description?: string;
  interestRate: string;
  minBalance: string;
  withdrawalPolicy: string;
  noticeDays: number;
  termMonths: number;
};

export function SavingsProductForm() {
  const communityId = useCommunityId();
  const router = useRouter();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [rate, setRate] = useState('');
  const [minimum, setMinimum] = useState('');
  const [policy, setPolicy] = useState('LOCKED');
  const [notice, setNotice] = useState('30');
  const [termMonths, setTermMonths] = useState('3');

  const create = useMoneyOutOtp<SavingsProductPayload>({
    perform: (extra, payload) => portalApi.createSavingsProduct(communityId, payload, extra),
    onDone: () => router.push('/savings'),
    successMessage: 'Savings product created',
  });

  const submit = () => create.run({
    name: name.trim(),
    description: description.trim() || undefined,
    interestRate: String(Number(rate || '0') / 100),
    minBalance: minimum || '0',
    withdrawalPolicy: policy,
    noticeDays: policy === 'NOTICE' ? Number(notice) : 0,
    termMonths: Number(termMonths),
  });

  const withdrawalLabel = policy === 'LOCKED' ? 'No withdrawals' : policy === 'NOTICE' ? `${notice || 0} days notice` : 'Any time';

  return <>
    <PageHeader title={name.trim() || 'New savings product'} subtitle="Savings product setup" breadcrumb={<Link href="/savings" className="inline-flex items-center gap-1.5 hover:text-navy-900"><ArrowLeft className="h-3.5 w-3.5" />Savings</Link>} />

    <div className="grid gap-5 lg:grid-cols-[1.25fr_0.75fr]">
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 p-5 sm:p-6">
          <div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Product preview</p><p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">{description.trim() || 'Add a short description so members understand what this savings product is for.'}</p></div>
          <Badge tone="navy">Draft</Badge>
        </div>
        <dl className="grid gap-px bg-slate-200 sm:grid-cols-4">
          <Metric label="Annual interest" value={`${Number(rate || 0).toFixed(2)}%`} />
          <Metric label="Minimum monthly payment" value={money(minimum || '0')} />
          <Metric label="Withdrawal access" value={withdrawalLabel} />
          <Metric label="Duration" value={`${termMonths || 0} months`} />
        </dl>
      </Card>

      <Card className="p-5 sm:p-6">
        <p className="text-sm font-semibold text-navy-900">At a glance</p>
        <div className="mt-4 space-y-4">
          <Summary icon={<PiggyBank className="h-4 w-4" />} label="Member accounts" value="0 until published" />
          <Summary icon={policy === 'LOCKED' ? <Lock className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />} label="Withdrawal rule" value={withdrawalLabel} />
          <Summary icon={<ShieldCheck className="h-4 w-4" />} label="Approval" value="Owner code required" />
        </div>
      </Card>
    </div>

    <Card className="mt-5">
      <div className="border-b border-slate-100 px-5 py-4 sm:px-6"><h2 className="font-semibold text-navy-900">Product settings</h2><p className="mt-1 text-sm text-slate-500">Define the terms members will see before opening an account.</p></div>
      <div className="grid gap-5 p-5 sm:grid-cols-2 sm:p-6">
        <Field label="Product name" htmlFor="name" required><Input id="name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Ordinary savings" /></Field>
        <Field label="Interest rate per year" htmlFor="rate"><Input id="rate" type="number" min="0" step="0.01" suffix="%" value={rate} onChange={(event) => setRate(event.target.value)} placeholder="e.g. 5" /></Field>
        <Field label="Duration" htmlFor="term-months" required hint="The return is prorated for this fixed term."><Input id="term-months" type="number" min="1" max="120" suffix="months" value={termMonths} onChange={(event) => setTermMonths(event.target.value)} /></Field>
        <Field label="Description" htmlFor="description" optional hint="This appears when members choose a product."><Textarea id="description" rows={4} value={description} onChange={(event) => setDescription(event.target.value)} /></Field>
        <div className="space-y-5"><Field label="Minimum monthly payment" htmlFor="minimum"><AmountInput id="minimum" value={minimum} onChange={setMinimum} placeholder="e.g. 5,000" /></Field><Field label="Withdrawal policy" htmlFor="policy" required><Select id="policy" value={policy} onChange={(event) => setPolicy(event.target.value)}><option value="LOCKED">Not permitted</option><option value="NOTICE">After notice</option><option value="ANYTIME">Any time</option></Select></Field></div>
        {policy === 'NOTICE' && <Field label="Notice period" htmlFor="notice" required><Input id="notice" type="number" min="1" max="365" suffix="days" value={notice} onChange={(event) => setNotice(event.target.value)} /></Field>}
      </div>
      <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50 px-5 py-4 sm:px-6"><Button variant="secondary" disabled={create.pending} onClick={() => router.back()}>Cancel</Button><Button disabled={name.trim().length < 2 || Number(termMonths) < 1} loading={create.pending} onClick={() => void submit()}>Create savings product</Button></div>
    </Card>
    <MoneyOutOtpDialog gate={create} />
  </>;
}

function Metric({ label, value }: { label: string; value: string }) { return <div className="bg-white p-5"><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-1 text-lg font-semibold text-navy-900">{value}</dd></div>; }
function Summary({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) { return <div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-50 text-brand-700">{icon}</span><div><p className="text-xs text-slate-500">{label}</p><p className="text-sm font-semibold text-navy-900">{value}</p></div></div>; }
