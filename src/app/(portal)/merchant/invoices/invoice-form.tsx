'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { useState } from 'react';
import { Plus, Send, Trash2 } from 'lucide-react';
import { Button, Card, Field, Input, PageHeader } from '@/components/ui';
import { useCommunityId } from '@/components/providers/session-provider';
import { useToast } from '@/components/providers/toast-provider';
import { useMutation } from '@/hooks/use-query';
import { money } from '@/lib/format';
import { portalApi } from '@/services/portal';
import type { MerchantInvoice } from '@/types';
import type { CoaChoice } from '@/types';
import { useRouter } from 'next/navigation';
import { AccountSelector, coaChoicePayload, isCoaChoiceComplete, SYSTEM_COA_CHOICE } from '@/components/accounting/account-selector';

type DraftItem = { description: string; quantity: string; unitPrice: string };
const blankItem = (): DraftItem => ({ description: '', quantity: '1', unitPrice: '' });
const today = () => new Date().toISOString().slice(0, 10);
const plusDays = (days: number) => { const d = new Date(); d.setDate(d.getDate() + days); return d.toISOString().slice(0, 10); };

export function InvoiceForm({ invoice, customers }: { invoice?: MerchantInvoice; customers: MerchantInvoice[] }) {
  const router = useRouter();
  const communityId = useCommunityId();
  const { toast } = useToast();
  const [customerName, setCustomerName] = useState(invoice?.customerName ?? '');
  const [customerEmail, setCustomerEmail] = useState(invoice?.customerEmail ?? '');
  const [issueDate, setIssueDate] = useState(invoice?.issueDate.slice(0, 10) ?? today());
  const [dueDate, setDueDate] = useState(invoice?.dueDate.slice(0, 10) ?? plusDays(30));
  const [items, setItems] = useState<DraftItem[]>(invoice ? invoice.items.map((item) => ({ description: item.description, quantity: String(item.quantity), unitPrice: item.unitPrice })) : [blankItem()]);
  const [coaChoice, setCoaChoice] = useState<CoaChoice>(invoice?.coaAccount
    ? { mode: 'EXISTING', accountCode: invoice.coaAccount.code }
    : SYSTEM_COA_CHOICE);

  const save = useMutation(async (sendNow: boolean) => {
    const body = { customerName: customerName.trim(), customerEmail: customerEmail.trim(), currencyCode: 'NGN', issueDate, dueDate, items: items.map((item) => ({ description: item.description.trim(), quantity: Number(item.quantity), unitPrice: item.unitPrice })), coaChoice: coaChoicePayload(coaChoice) };
    const saved = invoice ? await portalApi.updateMerchantInvoice(communityId, invoice.id, body) : await portalApi.createMerchantInvoice(communityId, body);
    if (sendNow) await portalApi.issueMerchantInvoice(communityId, saved.id);
    return { id: saved.id, sent: sendNow };
  }, {
    onSuccess: ({ id, sent }) => { toast(sent ? 'Invoice sent' : 'Draft saved', 'success', sent ? 'The customer was emailed a secure payment link.' : 'You can edit or send this invoice from its detail page.'); router.push(`/merchant/invoices/${id}` as Route); },
    onError: (message) => toast('Could not save invoice', 'error', message),
  });

  const updateItem = (index: number, patch: Partial<DraftItem>) => setItems((all) => all.map((item, i) => i === index ? { ...item, ...patch } : item));
  const total = items.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0), 0);
  const valid = customerName.trim() && /^\S+@\S+\.\S+$/.test(customerEmail) && issueDate && dueDate && dueDate >= issueDate && items.every((item) => item.description.trim() && Number(item.quantity) > 0 && /^\d+(\.\d{1,2})?$/.test(item.unitPrice)) && isCoaChoiceComplete(coaChoice);
  const previousCustomers = Array.from(new Map(customers.map((i) => [i.customerEmail.toLowerCase(), i])).values());
  const chooseCustomer = (email: string) => { const customer = previousCustomers.find((item) => item.customerEmail.toLowerCase() === email.toLowerCase()); if (customer) { setCustomerName(customer.customerName); setCustomerEmail(customer.customerEmail); } };

  return <>
    <PageHeader title={invoice ? `Edit ${invoice.invoiceNumber}` : 'New invoice'} subtitle="Create an invoice now, save it as a draft, or send it directly to the customer." breadcrumb={<Link href="/merchant/invoices" className="hover:text-navy-900">Invoices</Link>} actions={<Link href={(invoice ? `/merchant/invoices/${invoice.id}` : '/merchant/invoices') as Route}><Button variant="secondary">Cancel</Button></Link>} />
    <div className="mx-auto max-w-5xl space-y-5">
      <Card className="p-5 sm:p-6"><div className="grid gap-4 sm:grid-cols-2">
        <Field label="Previous customer" hint="Choose someone you have invoiced before."><select className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-navy-900 focus:border-brand-500 focus:outline-none" defaultValue="" onChange={(e) => chooseCustomer(e.target.value)}><option value="">Select a saved customer</option>{previousCustomers.map((customer) => <option value={customer.customerEmail} key={customer.customerEmail}>{customer.customerName} — {customer.customerEmail}</option>)}</select></Field>
        <div className="hidden sm:block" />
        <Field label="Customer name" required><Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Adaeze Okafor" /></Field>
        <Field label="Customer email" required hint="The secure payment link is sent here."><Input type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} placeholder="adaeze@example.com" /></Field>
        <Field label="Issue date" required><Input type="date" value={issueDate} max={dueDate} onChange={(e) => setIssueDate(e.target.value)} /></Field>
        <Field label="Payment due" required><Input type="date" value={dueDate} min={issueDate} onChange={(e) => setDueDate(e.target.value)} /></Field>
      </div></Card>
      <Card className="overflow-hidden"><div className="border-b border-slate-200 px-5 py-4"><h2 className="font-semibold text-navy-900">Invoice items</h2><p className="mt-0.5 text-sm text-slate-500">VAT is shown at 0% until your community’s VAT configuration is available.</p></div>
        <div className="overflow-x-auto"><div className="min-w-[760px]">
          <div className="grid grid-cols-[minmax(220px,1fr)_80px_130px_90px_130px_42px] gap-2 bg-slate-50 px-5 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500"><span>Description</span><span>Qty</span><span>Price (NGN)</span><span>VAT %</span><span className="text-right">Amount</span><span /></div>
          <div className="divide-y divide-slate-100">{items.map((item, index) => { const amount = (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0); return <div className="grid grid-cols-[minmax(220px,1fr)_80px_130px_90px_130px_42px] items-center gap-2 px-5 py-3" key={index}><Input value={item.description} onChange={(e) => updateItem(index, { description: e.target.value })} placeholder="Item or service" aria-label={`Item ${index + 1} description`} /><Input value={item.quantity} onChange={(e) => updateItem(index, { quantity: e.target.value.replace(/\D/g, '') })} inputMode="numeric" aria-label={`Item ${index + 1} quantity`} /><Input value={item.unitPrice} onChange={(e) => updateItem(index, { unitPrice: e.target.value })} inputMode="decimal" placeholder="0.00" aria-label={`Item ${index + 1} price`} /><span className="px-3 text-sm text-slate-500">0%</span><span className="text-right text-sm font-medium text-navy-900">{money(amount, 'NGN')}</span>{items.length > 1 ? <Button variant="ghost" size="sm" icon={<Trash2 className="h-4 w-4" />} aria-label={`Remove item ${index + 1}`} onClick={() => setItems((all) => all.filter((_, i) => i !== index))} /> : <span />}</div>; })}</div>
        </div></div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-5 py-4"><Button variant="ghost" size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => setItems((all) => [...all, blankItem()])}>Add item</Button><div className="text-right"><p className="text-xs text-slate-500">VAT ₦0.00</p><p className="text-lg font-semibold text-navy-900">Total {money(total, 'NGN')}</p></div></div>
      </Card>
      <AccountSelector
        selection="MERCHANT_MONEY_IN"
        value={coaChoice}
        onChange={setCoaChoice}
        idPrefix="invoice-coa"
      />
      <div className="flex flex-wrap justify-end gap-2"><Button variant="secondary" onClick={() => void save.run(false)} loading={save.pending} disabled={!valid}>Save draft</Button><Button onClick={() => void save.run(true)} loading={save.pending} disabled={!valid} icon={<Send className="h-4 w-4" />}>Send invoice</Button></div>
    </div>
  </>;
}
