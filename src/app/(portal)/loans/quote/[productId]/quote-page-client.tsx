'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Download, Mail } from 'lucide-react';
import { AmountInput, Button, Callout, Card, Field, Modal, PageHeader, Select } from '@/components/ui';
import { useCommunityId } from '@/components/providers/session-provider';
import { useToast } from '@/components/providers/toast-provider';
import { useMutation } from '@/hooks/use-query';
import { date, money } from '@/lib/format';
import { portalApi } from '@/services/portal';
import type { LoanProduct, LoanQuote, MemberRow } from '@/types';

export function QuotePageClient({ product, members }: { product: LoanProduct; members: MemberRow[] }) {
  const communityId = useCommunityId();
  const router = useRouter();
  const { toast } = useToast();
  const [principal, setPrincipal] = useState('');
  const [tenor, setTenor] = useState(product.tenorMonths[0] ?? 6);
  const [quote, setQuote] = useState<LoanQuote | null>(null);
  const [emailOpen, setEmailOpen] = useState(false);
  const [recipientType, setRecipientType] = useState<'MEMBER' | 'ALL'>('MEMBER');
  const [memberId, setMemberId] = useState(members[0]?.id ?? '');

  const request = { principal, tenorMonths: tenor };
  const run = useMutation(() => portalApi.quoteLoan(communityId, product.id, request), { onSuccess: setQuote });
  const download = useMutation(() => portalApi.downloadLoanQuote(communityId, product.id, request), {
    onSuccess: ({ blob, filename }) => {
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      anchor.click();
      URL.revokeObjectURL(url);
      toast('Quote downloaded', 'success');
    },
    onError: (message) => toast('Could not download quote', 'error', message),
  });
  const email = useMutation(
    () => portalApi.emailLoanQuote(communityId, product.id, {
      ...request,
      recipientType,
      memberId: recipientType === 'MEMBER' ? memberId : undefined,
    }),
    {
      onSuccess: ({ sent, recipientCount }) => {
        setEmailOpen(false);
        toast('Quote emailed', 'success', `Delivered to ${sent} of ${recipientCount} recipient${recipientCount === 1 ? '' : 's'}.`);
      },
      onError: (message) => toast('Could not email quote', 'error', message),
    },
  );

  return <>
    <PageHeader title="Loan quote" subtitle={`${product.name} · ${product.rateLabel}`} />
    <div className="mx-auto grid max-w-4xl gap-5 lg:grid-cols-5">
      <Card className="lg:col-span-2">
        <div className="space-y-5 p-5">
          <p className="text-sm font-semibold text-primary-700">Choose the request</p>
          {run.error && <Callout tone="danger">{run.error}</Callout>}
          <Field label="Loan amount" htmlFor="amount" required><AmountInput id="amount" value={principal} onChange={setPrincipal} /></Field>
          <Field label="Repayment period" htmlFor="tenor" required>
            <Select id="tenor" value={String(tenor)} onChange={(event) => setTenor(Number(event.target.value))}>
              {product.tenorMonths.map((month) => <option key={month} value={month}>{month} months</option>)}
            </Select>
          </Field>
          <Button className="w-full" disabled={Number(principal) <= 0} loading={run.pending} onClick={() => void run.run()}>Calculate quote</Button>
          <Button className="w-full" variant="secondary" onClick={() => router.back()}>Back</Button>
        </div>
      </Card>
      <Card className="lg:col-span-3">
        <div className="p-5">
          <p className="text-sm font-semibold text-primary-700">Quote summary</p>
          {quote ? <QuoteSummary quote={quote} onDownload={() => void download.run()} downloading={download.pending} onEmail={() => setEmailOpen(true)} /> : <p className="py-16 text-center text-sm text-slate-500">Enter an amount and period to see exactly what the member receives and repays.</p>}
        </div>
      </Card>
    </div>
    <Modal
      open={emailOpen}
      onClose={() => setEmailOpen(false)}
      title="Email loan quote"
      description="The PDF quote will be attached to each recipient's email."
      footer={<><Button variant="secondary" onClick={() => setEmailOpen(false)} disabled={email.pending}>Cancel</Button><Button icon={<Mail className="h-4 w-4" />} loading={email.pending} disabled={recipientType === 'MEMBER' && !memberId} onClick={() => void email.run()}>Send quote</Button></>}
    >
      <div className="space-y-4">
        <Field label="Recipients" htmlFor="recipient-type">
          <Select id="recipient-type" value={recipientType} onChange={(event) => setRecipientType(event.target.value as 'MEMBER' | 'ALL')}>
            <option value="MEMBER">A particular member</option>
            <option value="ALL">All active members ({members.length})</option>
          </Select>
        </Field>
        {recipientType === 'MEMBER' && <Field label="Member" htmlFor="member-id" required>
          <Select id="member-id" value={memberId} onChange={(event) => setMemberId(event.target.value)}>
            {members.length === 0 && <option value="">No active members</option>}
            {members.map((member) => <option key={member.id} value={member.id}>{member.name} · {member.email}</option>)}
          </Select>
        </Field>}
        {recipientType === 'ALL' && <Callout tone="warning">This will email the quote to all {members.length} active members.</Callout>}
      </div>
    </Modal>
  </>;
}

function QuoteSummary({ quote, onDownload, downloading, onEmail }: { quote: LoanQuote; onDownload: () => void; downloading: boolean; onEmail: () => void }) {
  const rows = [['Principal', quote.principal], ['Service charge', quote.serviceCharge], ['Processing fee', quote.processingFee], ['Member receives', quote.netDisbursed], ['Total repayable', quote.totalRepayable], [`${quote.instalments} instalments of`, quote.perInstalment], ['Final instalment', quote.finalInstalment]];
  return <div className="mt-5">
    <dl className="divide-y rounded-xl border border-slate-200">{rows.map(([label, value]) => <div className="flex justify-between gap-4 px-4 py-3" key={label}><dt className="text-sm text-slate-600">{label}</dt><dd className="tnum text-sm font-semibold text-navy-900">{money(value, quote.currencyCode)}</dd></div>)}</dl>

    {/* The instalment dates, the same ones that go into the PDF. An officer
        reading a quote to a member over the phone needs the schedule, not
        just the total — "₦28,000 a month" is only half the answer. */}
    {quote.schedule.length > 0 && (
      <details className="mt-4 rounded-xl border border-slate-200">
        <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-navy-900">
          Repayment schedule · {quote.schedule.length}{' '}
          {quote.repaymentFrequency === 'WEEKLY' ? 'weekly' : 'monthly'} instalments
        </summary>
        <div className="max-h-72 overflow-y-auto border-t border-slate-100">
          <table className="w-full">
            <thead className="sticky top-0 bg-slate-50">
              <tr>
                <th scope="col" className="th">#</th>
                <th scope="col" className="th">Due</th>
                <th scope="col" className="th text-right">Payment</th>
                <th scope="col" className="th text-right">Balance after</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {quote.schedule.map((row) => (
                <tr key={row.number}>
                  <td className="td py-2 text-slate-500">{row.number}</td>
                  <td className="td py-2">{date(row.dueDate)}</td>
                  <td className="td tnum py-2 text-right font-medium text-navy-900">{money(row.amount, quote.currencyCode)}</td>
                  <td className="td tnum py-2 text-right text-slate-500">{money(row.balanceAfter, quote.currencyCode)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    )}

    <p className="mt-4 text-sm text-slate-500">This is illustrative, and the dates run from today — the binding schedule is set at disbursement. Final approval remains with the loan committee.</p>
    <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-100 pt-5">
      <Button variant="secondary" icon={<Download className="h-4 w-4" />} loading={downloading} onClick={onDownload}>Download PDF</Button>
      <Button icon={<Mail className="h-4 w-4" />} onClick={onEmail}>Email quote</Button>
    </div>
  </div>;
}
