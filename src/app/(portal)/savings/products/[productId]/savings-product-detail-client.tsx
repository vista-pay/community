'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, BookOpen, CheckCircle2, Edit3, Lock, PiggyBank, Users } from 'lucide-react';
import { MoneyOutOtpDialog, useMoneyOutOtp } from '@/components/money-out-otp';
import { useCommunityId } from '@/components/providers/session-provider';
import { AmountInput, Badge, Button, Card, DataTable, Field, Input, PageHeader, Select, StatusBadge, Textarea } from '@/components/ui';
import { money } from '@/lib/format';
import { savingsProductName } from '@/lib/savings';
import { portalApi } from '@/services/portal';
import type { SavingsAccountRow, SavingsProduct } from '@/types';

export function SavingsProductDetailClient({ product, accounts }: { product: SavingsProduct; accounts: SavingsAccountRow[] }) {
  const communityId = useCommunityId();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [description, setDescription] = useState(product.description ?? '');
  const [rate, setRate] = useState(String(Number(product.interestRate) * 100));
  const [minimum, setMinimum] = useState(product.minBalance);
  const [policy, setPolicy] = useState(product.withdrawalPolicy);
  const [notice, setNotice] = useState(String(product.noticeDays || 30));
  const [active, setActive] = useState(product.isActive);
  const [termMonths, setTermMonths] = useState(String(product.termMonths || 3));

  const update = useMoneyOutOtp<Record<string, unknown>>({
    perform: (extra, payload) => portalApi.updateSavingsProduct(communityId, product.id, payload, extra),
    onDone: () => {
      setEditing(false);
      router.refresh();
    },
    successMessage: 'Savings product updated',
  });

  const submit = () => update.run({
    description: description.trim(),
    interestRate: String(Number(rate) / 100),
    minBalance: minimum,
    withdrawalPolicy: policy,
    noticeDays: policy === 'NOTICE' ? Number(notice) : 0,
    isActive: active,
    termMonths: Number(termMonths),
  });

  return <>
    <PageHeader
      title={savingsProductName(product.name)}
      subtitle="Savings product settings and member accounts"
      breadcrumb={<Link href="/savings" className="inline-flex items-center gap-1.5 hover:text-navy-900"><ArrowLeft className="h-3.5 w-3.5" />Savings</Link>}
      actions={!editing ? <Button variant="secondary" icon={<Edit3 className="h-4 w-4" />} onClick={() => setEditing(true)}>Edit product</Button> : undefined}
    />

    <div className="grid gap-5 lg:grid-cols-[1.25fr_0.75fr]">
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 p-5 sm:p-6">
          <div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Product overview</p><p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">{product.description || 'No description has been added.'}</p></div>
          <Badge tone={product.isActive ? 'green' : 'amber'}>{product.isActive ? 'Available to members' : 'Paused'}</Badge>
        </div>
        <dl className="grid gap-px bg-slate-200 sm:grid-cols-4">
          <Metric label="Annual interest" value={`${(Number(product.interestRate) * 100).toFixed(2)}%`} />
          <Metric label="Minimum monthly payment" value={money(product.minBalance, product.currencyCode)} />
          <Metric label="Withdrawal access" value={policyLabel(product)} />
          <Metric label="Duration" value={`${product.termMonths} months`} />
        </dl>
      </Card>

      <Card className="p-5 sm:p-6">
        <p className="text-sm font-semibold text-navy-900">At a glance</p>
        <div className="mt-4 space-y-4">
          <Summary icon={<Users className="h-4 w-4" />} label="Member accounts" value={String(accounts.length)} />
          <Summary icon={<PiggyBank className="h-4 w-4" />} label="Combined balance" value={money(accounts.reduce((total, account) => total + Number(account.balance), 0), product.currencyCode)} />
          <Summary icon={product.withdrawalPolicy === 'LOCKED' ? <Lock className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />} label="Withdrawal rule" value={policyLabel(product)} />
          <Summary icon={<BookOpen className="h-4 w-4" />} label="Savings control account" value={product.depositAccountCode ?? '2000 (standard)'} />
        </div>
      </Card>
    </div>

    {editing && <Card className="mt-5">
      <div className="border-b border-slate-100 px-5 py-4 sm:px-6"><h2 className="font-semibold text-navy-900">Edit product settings</h2><p className="mt-1 text-sm text-slate-500">Changes require the community owner&apos;s approval code.</p></div>
      <div className="grid gap-5 p-5 sm:grid-cols-2 sm:p-6">
        <Field label="Description" htmlFor="edit-description" optional><Textarea id="edit-description" rows={4} value={description} onChange={(event) => setDescription(event.target.value)} /></Field>
        <div className="space-y-5"><Field label="Availability" htmlFor="edit-active"><Select id="edit-active" value={active ? 'active' : 'paused'} onChange={(event) => setActive(event.target.value === 'active')}><option value="active">Available to members</option><option value="paused">Paused for new accounts</option></Select></Field><Field label="Interest rate per year" htmlFor="edit-rate"><Input id="edit-rate" type="number" min="0" step="0.01" suffix="%" value={rate} onChange={(event) => setRate(event.target.value)} /></Field></div>
        <Field label="Minimum monthly payment" htmlFor="edit-minimum"><AmountInput id="edit-minimum" value={minimum} onChange={setMinimum} /></Field>
        <Field label="Duration" htmlFor="edit-duration" hint="Cannot change while member accounts are open."><Input id="edit-duration" type="number" min="1" max="120" suffix="months" value={termMonths} onChange={(event) => setTermMonths(event.target.value)} /></Field>
        <Field label="Withdrawal policy" htmlFor="edit-policy"><Select id="edit-policy" value={policy} onChange={(event) => setPolicy(event.target.value as SavingsProduct['withdrawalPolicy'])}><option value="LOCKED">Not permitted</option><option value="NOTICE">After notice</option><option value="ANYTIME">Any time</option></Select></Field>
        {policy === 'NOTICE' && <Field label="Notice period" htmlFor="edit-notice"><Input id="edit-notice" type="number" min="1" max="365" suffix="days" value={notice} onChange={(event) => setNotice(event.target.value)} /></Field>}
      </div>
      <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50 px-5 py-4 sm:px-6"><Button variant="secondary" disabled={update.pending} onClick={() => setEditing(false)}>Cancel</Button><Button loading={update.pending} onClick={() => void submit()}>Save changes</Button></div>
    </Card>}

    <Card className="mt-5">
      <div className="border-b border-slate-100 px-5 py-4 sm:px-6"><h2 className="font-semibold text-navy-900">Accounts using this product</h2><p className="mt-1 text-sm text-slate-500">Members whose savings follow these terms.</p></div>
      <DataTable rows={accounts} rowKey={(account) => account.id} columns={[{ key: 'member', header: 'Member', cell: (account) => <span><span className="block font-medium text-navy-900">{account.memberName}</span><span className="block text-xs text-slate-500">{account.accountNumber}</span></span> }, { key: 'monthly', header: 'Monthly', align: 'right', cell: (account) => money(account.monthlyAmount, product.currencyCode) }, { key: 'progress', header: 'Progress', cell: (account) => `${account.contributionsMade} of ${product.termMonths}` }, { key: 'balance', header: 'Saved', align: 'right', cell: (account) => money(account.balance, product.currencyCode) }, { key: 'status', header: 'Status', cell: (account) => <StatusBadge status={account.status.toLowerCase()} /> }]} />
    </Card>
    <MoneyOutOtpDialog gate={update} />
  </>;
}

function Metric({ label, value }: { label: string; value: string }) { return <div className="bg-white p-5"><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-1 text-lg font-semibold text-navy-900">{value}</dd></div>; }
function Summary({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) { return <div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-50 text-brand-700">{icon}</span><div><p className="text-xs text-slate-500">{label}</p><p className="text-sm font-semibold text-navy-900">{value}</p></div></div>; }
function policyLabel(product: SavingsProduct) { return product.withdrawalPolicy === 'LOCKED' ? 'No withdrawals' : product.withdrawalPolicy === 'NOTICE' ? `${product.noticeDays} days notice` : 'Any time'; }
