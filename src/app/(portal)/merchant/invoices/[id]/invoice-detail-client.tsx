'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { Download, ExternalLink, MessageCircle, Pencil, Send } from 'lucide-react';
import { Button, Card, CardHeader, KV, PageHeader, StatusBadge } from '@/components/ui';
import { CopyField } from '@/components/CopyField';
import { useCommunityId } from '@/components/providers/session-provider';
import { useToast } from '@/components/providers/toast-provider';
import { useMutation } from '@/hooks/use-query';
import { date, money } from '@/lib/format';
import { portalApi } from '@/services/portal';
import type { MerchantInvoiceDetail } from '@/types';
import { useState } from 'react';

export function InvoiceDetailClient({ initial }: { initial: MerchantInvoiceDetail }) {
  const communityId = useCommunityId();
  const { toast } = useToast();
  const [invoice, setInvoice] = useState(initial);
  const send = useMutation(() => portalApi.issueMerchantInvoice(communityId, invoice.id), {
    onSuccess: (result) => { setInvoice((current) => ({ ...current, status: 'SENT', paymentUrl: result.paymentUrl })); toast('Invoice sent', 'success', 'The customer has been emailed the payment link.'); },
    onError: (message) => toast('Could not send invoice', 'error', message),
  });
  const payUrl = invoice.paymentUrl;
  const sendWhatsapp = () => {
    if (!payUrl) return;
    const text = `Hello ${invoice.customerName}, here is your invoice ${invoice.invoiceNumber} for ${money(invoice.totalAmount, invoice.currencyCode)}. Pay securely here: ${payUrl}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
  };
  const downloadPdf = () => { window.print(); };

  return <>
    <PageHeader title={invoice.invoiceNumber} subtitle={`Issued ${date(invoice.issueDate)} · Due ${date(invoice.dueDate)}`} breadcrumb={<Link href="/merchant/invoices" className="hover:text-navy-900">Invoices</Link>} actions={<><StatusBadge status={invoice.status} />{invoice.status === 'DRAFT' && <Link href={`/merchant/invoices/${invoice.id}/edit` as Route}><Button variant="secondary" icon={<Pencil className="h-4 w-4" />}>Edit draft</Button></Link>}{invoice.status === 'DRAFT' && <Button onClick={() => void send.run()} loading={send.pending} icon={<Send className="h-4 w-4" />}>Send invoice</Button>}</>} />
    <div className="mx-auto max-w-5xl space-y-5 print:max-w-none">
      <Card className="p-5 sm:p-6"><div className="flex flex-wrap items-start justify-between gap-5"><div><p className="text-sm text-slate-500">Bill to</p><p className="mt-1 font-semibold text-navy-900">{invoice.customerName}</p><p className="text-sm text-slate-600">{invoice.customerEmail}</p></div><div className="text-right"><p className="text-sm text-slate-500">Amount due</p><p className="mt-1 text-2xl font-semibold text-navy-900">{money(invoice.totalAmount, invoice.currencyCode)}</p><p className="mt-1 text-sm text-slate-500">VAT included: ₦0.00</p></div></div></Card>
      <Card><CardHeader title="Items" subtitle="VAT is fixed at 0% while VAT configuration is being prepared." /><div className="overflow-x-auto"><table className="w-full min-w-[650px] text-sm"><thead className="border-y border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">Description</th><th className="px-5 py-3 text-right">Qty</th><th className="px-5 py-3 text-right">Price (NGN)</th><th className="px-5 py-3 text-right">VAT %</th><th className="px-5 py-3 text-right">Amount</th></tr></thead><tbody>{invoice.items.map((item) => <tr key={item.id} className="border-b border-slate-100 last:border-0"><td className="px-5 py-3 font-medium text-navy-900">{item.description}</td><td className="px-5 py-3 text-right">{item.quantity}</td><td className="px-5 py-3 text-right">{money(item.unitPrice, invoice.currencyCode)}</td><td className="px-5 py-3 text-right">0%</td><td className="px-5 py-3 text-right font-medium">{money(item.totalAmount, invoice.currencyCode)}</td></tr>)}</tbody></table></div><div className="flex justify-end border-t border-slate-200 px-5 py-4"><p className="text-lg font-semibold text-navy-900">Total {money(invoice.totalAmount, invoice.currencyCode)}</p></div></Card>
      <div className="grid gap-5 lg:grid-cols-[1fr_1.25fr]"><Card className="p-5"><h2 className="font-semibold text-navy-900">Invoice details</h2><dl className="mt-4 grid grid-cols-2 gap-4"><KV label="Issue date">{date(invoice.issueDate)}</KV><KV label="Due date">{date(invoice.dueDate)}</KV><KV label="Payment status"><StatusBadge status={invoice.status} /></KV><KV label="Paid on">{invoice.paidAt ? date(invoice.paidAt) : 'Not paid yet'}</KV></dl></Card><Card className="p-5"><h2 className="font-semibold text-navy-900">Payment link</h2>{payUrl ? <><p className="mt-1 text-sm text-slate-500">One secure payment, valid until the due date.</p><div className="mt-4"><CopyField value={payUrl} label="Customer payment URL" /></div><div className="mt-4 flex flex-wrap gap-2 print:hidden"><Button variant="secondary" size="sm" icon={<Download className="h-4 w-4" />} onClick={downloadPdf}>Download PDF</Button><Button variant="secondary" size="sm" icon={<MessageCircle className="h-4 w-4" />} onClick={sendWhatsapp}>WhatsApp customer</Button><a href={payUrl} target="_blank" rel="noreferrer"><Button variant="secondary" size="sm" icon={<ExternalLink className="h-4 w-4" />}>Open link</Button></a></div></> : <p className="mt-2 text-sm text-slate-500">Send this draft to create its one-time payment link and email it to the customer.</p>}</Card></div>
    </div>
  </>;
}
