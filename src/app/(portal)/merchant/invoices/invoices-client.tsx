'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { FileText, Plus } from 'lucide-react';
import { Button, Card, CardHeader, DataTable, EmptyState, PageHeader, StatusBadge } from '@/components/ui';
import { useCommunityId } from '@/components/providers/session-provider';
import { useQuery } from '@/hooks/use-query';
import { portalApi } from '@/services/portal';
import { date, money } from '@/lib/format';
import type { MerchantInvoice } from '@/types';

export function InvoicesClient({ initial }: { initial: MerchantInvoice[] }) {
  const communityId = useCommunityId();
  const { data } = useQuery<MerchantInvoice[]>(
    () => portalApi.merchantInvoices(communityId), [communityId], { initial },
  );
  const invoices = data ?? initial;

  return (
    <>
      <PageHeader
        title="Invoices"
        subtitle="Create, send and track customer invoices paid into the community wallet."
        breadcrumb={<span>Merchant</span>}
        actions={<Link href={'/merchant/invoices/new' as Route}><Button icon={<Plus className="h-4 w-4" />}>New invoice</Button></Link>}
      />
      <Card>
        <CardHeader title="Invoices" subtitle="Drafts stay editable until you send them. Sent invoices use one secure payment link." />
        {invoices.length === 0 ? (
          <EmptyState icon={<FileText className="h-5 w-5" />} title="No invoices yet" body="Create an itemised invoice for a customer, sponsor or member."
            action={<Link href={'/merchant/invoices/new' as Route}><Button icon={<Plus className="h-4 w-4" />}>Create invoice</Button></Link>} />
        ) : (
          <DataTable rows={invoices} rowKey={(i) => i.id} columns={[
            { key: 'number', header: 'Invoice', cell: (i) => <Link href={`/merchant/invoices/${i.id}` as Route} className="font-medium text-brand-700 hover:underline">{i.invoiceNumber}</Link> },
            { key: 'customer', header: 'Customer', cell: (i) => <div><p>{i.customerName}</p><p className="text-xs text-slate-500">{i.customerEmail}</p></div> },
            { key: 'issued', header: 'Issued', cell: (i) => date(i.issueDate) },
            { key: 'due', header: 'Due', cell: (i) => date(i.dueDate) },
            { key: 'total', header: 'Total', align: 'right', cell: (i) => money(i.totalAmount, i.currencyCode) },
            { key: 'status', header: 'Status', cell: (i) => <StatusBadge status={i.status} /> },
            { key: 'actions', header: '', cell: (i) => <Link href={(i.status === 'DRAFT' ? `/merchant/invoices/${i.id}/edit` : `/merchant/invoices/${i.id}`) as Route} className="text-sm font-medium text-brand-700 hover:underline">{i.status === 'DRAFT' ? 'Edit draft' : 'View'}</Link> },
          ]} />
        )}
      </Card>
    </>
  );
}
