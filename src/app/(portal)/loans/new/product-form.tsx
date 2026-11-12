'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AmountInput, Button, Callout, Card, Field, Input, PageHeader, Select } from '@/components/ui';
import { useCommunityId } from '@/components/providers/session-provider';
import { portalApi } from '@/services/portal';
import { MoneyOutOtpDialog, useMoneyOutOtp } from '@/components/money-out-otp';
import {
  AccountSelector,
  SYSTEM_COA_CHOICE,
  coaChoicePayload,
  isCoaChoiceComplete,
} from '@/components/accounting/account-selector';
import type { CoaChoice } from '@/types';

export function LoanProductForm() {
  const communityId = useCommunityId(); const router = useRouter();
  const [name, setName] = useState(''); const [min, setMin] = useState(''); const [max, setMax] = useState('');
  const [tenors, setTenors] = useState('6, 12'); const [rate, setRate] = useState('2'); const [fee, setFee] = useState('1');
  const [frequency, setFrequency] = useState('MONTHLY');
  const [ledgerAccount, setLedgerAccount] = useState<CoaChoice>(SYSTEM_COA_CHOICE);
  const payload = () => ({
    name: name.trim(), minPrincipal: min, maxPrincipal: max,
    tenorMonths: tenors.split(',').map((x) => Number(x.trim())).filter((x) => x > 0),
    interestRate: String(Number(rate) / 100), rateLabel: `${rate}% per month, flat`, repaymentFrequency: frequency,
    processingFeePercent: String(Number(fee) / 100),
    ledgerAccount: coaChoicePayload(ledgerAccount),
  });
  const create = useMoneyOutOtp<Record<string, unknown>>({
    perform: (extra, body) => portalApi.createLoanProduct(communityId, body, extra),
    onDone: () => router.push('/loans/offers'),
    successMessage: 'Loan product created',
  });
  const valid =
    name.trim().length > 2 &&
    Number(min) > 0 &&
    Number(max) >= Number(min) &&
    isCoaChoiceComplete(ledgerAccount);
  return <><PageHeader title="Create a loan product" subtitle="Set clear written terms members and the loan committee can rely on." />
    <Card className="mx-auto max-w-3xl"><div className="space-y-7 p-5 sm:p-7">
      <section><p className="text-sm font-semibold text-primary-700">1. Name the product</p><div className="mt-3"><Field label="Product name" htmlFor="name" required><Input id="name" className="h-12 text-base" value={name} onChange={(e) => setName(e.target.value)} placeholder="Member development loan" /></Field></div></section>
      <section className="rounded-xl bg-slate-50 p-4 sm:p-5"><p className="text-sm font-semibold text-primary-700">2. Set the amount and repayment</p><div className="mt-4 grid gap-4 sm:grid-cols-2"><Field label="Minimum loan" htmlFor="min" required><AmountInput id="min" value={min} onChange={setMin} /></Field><Field label="Maximum loan" htmlFor="max" required><AmountInput id="max" value={max} onChange={setMax} /></Field><Field label="Interest per month" htmlFor="rate" required><Input id="rate" type="number" min="0" step="0.1" suffix="%" value={rate} onChange={(e) => setRate(e.target.value)} /></Field><Field label="Processing fee" htmlFor="fee"><Input id="fee" type="number" min="0" step="0.1" suffix="%" value={fee} onChange={(e) => setFee(e.target.value)} /></Field></div><div className="mt-4 grid gap-4 sm:grid-cols-2"><Field label="Available tenors" htmlFor="tenors" hint="Months, separated by commas" required><Input id="tenors" value={tenors} onChange={(e) => setTenors(e.target.value)} /></Field><Field label="Repayment frequency" htmlFor="frequency" required><Select id="frequency" value={frequency} onChange={(e) => setFrequency(e.target.value)}><option value="MONTHLY">Monthly</option><option value="WEEKLY">Weekly</option></Select></Field></div></section>
      <section><p className="text-sm font-semibold text-primary-700">3. Say where it sits in your books</p><div className="mt-3"><AccountSelector selection="LOAN_PRODUCT" value={ledgerAccount} onChange={setLedgerAccount} idPrefix="loan-coa" /></div></section>
      <section><p className="text-sm font-semibold text-primary-700">4. Confirm eligibility policy</p><div className="mt-3"><Callout tone="info" title="Eligibility is controlled in Configuration">The published loan policy is applied automatically when a member requests this product. It checks membership duration, savings, contribution history, active loans, guarantors, KYC and overdue contributions. <Link href="/configuration?tab=policies&area=LOANS" className="font-semibold underline">Review loan eligibility rules</Link>.</Callout></div></section>
      <div className="sticky bottom-0 -mx-5 flex justify-end gap-3 border-t bg-white px-5 py-4 sm:-mx-7 sm:px-7"><Button variant="secondary" onClick={() => router.back()}>Cancel</Button><Button disabled={!valid} loading={create.pending} onClick={() => void create.run(payload())}>Create loan product</Button></div>
    </div></Card><MoneyOutOtpDialog gate={create} /></>;
}
