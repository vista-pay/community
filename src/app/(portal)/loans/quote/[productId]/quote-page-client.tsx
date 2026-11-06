'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AmountInput, Button, Callout, Card, Field, PageHeader, Select } from '@/components/ui';
import { useCommunityId } from '@/components/providers/session-provider';
import { useMutation } from '@/hooks/use-query';
import { money } from '@/lib/format';
import { portalApi } from '@/services/portal';
import type { LoanProduct, LoanQuote } from '@/types';

export function QuotePageClient({ product }: { product: LoanProduct }) {
  const communityId = useCommunityId(); const router = useRouter(); const [principal, setPrincipal] = useState('');
  const [tenor, setTenor] = useState(product.tenorMonths[0] ?? 6); const [quote, setQuote] = useState<LoanQuote | null>(null);
  const run = useMutation(() => portalApi.quoteLoan(communityId, product.id, { principal, tenorMonths: tenor }), { onSuccess: setQuote });
  return <><PageHeader title="Loan quote" subtitle={`${product.name} · ${product.rateLabel}`} />
    <div className="mx-auto grid max-w-4xl gap-5 lg:grid-cols-5"><Card className="lg:col-span-2"><div className="space-y-5 p-5"><p className="text-sm font-semibold text-primary-700">Choose the request</p>{run.error && <Callout tone="danger">{run.error}</Callout>}<Field label="Loan amount" htmlFor="amount" required><AmountInput id="amount" value={principal} onChange={setPrincipal} /></Field><Field label="Repayment period" htmlFor="tenor" required><Select id="tenor" value={String(tenor)} onChange={(e) => setTenor(Number(e.target.value))}>{product.tenorMonths.map((month) => <option key={month} value={month}>{month} months</option>)}</Select></Field><Button className="w-full" disabled={Number(principal) <= 0} loading={run.pending} onClick={() => void run.run()}>Calculate quote</Button><Button className="w-full" variant="secondary" onClick={() => router.back()}>Back</Button></div></Card>
      <Card className="lg:col-span-3"><div className="p-5"><p className="text-sm font-semibold text-primary-700">Quote summary</p>{quote ? <QuoteSummary quote={quote} /> : <p className="py-16 text-center text-sm text-slate-500">Enter an amount and period to see exactly what the member receives and repays.</p>}</div></Card></div></>;
}
function QuoteSummary({ quote }: { quote: LoanQuote }) { const rows = [['Principal', quote.principal], ['Service charge', quote.serviceCharge], ['Processing fee', quote.processingFee], ['Member receives', quote.netDisbursed], ['Total repayable', quote.totalRepayable], [`${quote.instalments} instalments of`, quote.perInstalment], ['Final instalment', quote.finalInstalment]]; return <div className="mt-5"><dl className="divide-y rounded-xl border border-slate-200">{rows.map(([label, value]) => <div className="flex justify-between gap-4 px-4 py-3" key={label}><dt className="text-sm text-slate-600">{label}</dt><dd className="tnum text-sm font-semibold text-navy-900">{money(value, quote.currencyCode)}</dd></div>)}</dl><p className="mt-4 text-sm text-slate-500">This is illustrative. Final approval remains with the loan committee.</p></div>; }
