'use client';

import { useState } from 'react';
import { FileText, Plus, Send, Trash2 } from 'lucide-react';
import {
  Button,
  Card,
  CardHeader,
  DataTable,
  EmptyState,
  Field,
  Input,
  Modal,
  PageHeader,
  StatusBadge,
} from '@/components/ui';
import { CopyField } from '@/components/CopyField';
import { useCommunityId } from '@/components/providers/session-provider';
import { useToast } from '@/components/providers/toast-provider';
import { useMutation, useQuery } from '@/hooks/use-query';
import { portalApi } from '@/services/portal';
import { date, money } from '@/lib/format';
import type { MerchantInvoice } from '@/types';

interface DraftItem {
  description: string;
  quantity: string;
  unitPrice: string;
}

const emptyItem = (): DraftItem => ({ description: '', quantity: '1', unitPrice: '' });

export function InvoicesClient({ initial }: { initial: MerchantInvoice[] }) {
  const communityId = useCommunityId();
  const { toast } = useToast();
  const { data, refresh } = useQuery<MerchantInvoice[]>(
    () => portalApi.merchantInvoices(communityId),
    [communityId],
    { initial },
  );

  const invoices = data ?? initial;
  const [createOpen, setCreateOpen] = useState(false);
  const [payUrl, setPayUrl] = useState<string | null>(null);

  const issue = useMutation(
    (invoiceId: string) => portalApi.issueMerchantInvoice(communityId, invoiceId),
    {
      onSuccess: async (result) => {
        if (!result) return;
        toast('Invoice issued', 'success', 'Share the link with the customer.');
        setPayUrl(result.paymentUrl);
        await refresh();
      },
      onError: (message) => toast('Could not issue invoice', 'error', message),
    },
  );

  return (
    <>
      <PageHeader
        title="Invoices"
        subtitle="Bills issued in the community's own name — paid into the community wallet"
        breadcrumb={<span>Merchant</span>}
        actions={
          <Button onClick={() => setCreateOpen(true)} icon={<Plus className="h-4 w-4" />}>
            New invoice
          </Button>
        }
      />

      <Card>
        <CardHeader
          title="Issued and draft invoices"
          subtitle="Issuing an invoice mints the single link it can be paid through. A paid invoice never grows a second one."
        />
        {invoices.length === 0 ? (
          <EmptyState
            icon={<FileText className="h-5 w-5" />}
            title="No invoices yet"
            body="Invoice a supplier, a sponsor or a member for something itemised. The customer needs no Rendi account to pay."
            action={
              <Button onClick={() => setCreateOpen(true)} icon={<Plus className="h-4 w-4" />}>
                New invoice
              </Button>
            }
          />
        ) : (
          <DataTable
            rows={invoices}
            rowKey={(i) => i.id}
            columns={[
              {
                key: 'number',
                header: 'Invoice',
                cell: (i) => (
                  <div className="min-w-0">
                    <p className="truncate font-medium text-navy-900">{i.invoiceNumber}</p>
                    <p className="truncate text-xs text-slate-500">
                      {i.items.length} item{i.items.length === 1 ? '' : 's'}
                    </p>
                  </div>
                ),
              },
              {
                key: 'customer',
                header: 'Customer',
                cell: (i) => (
                  <div className="min-w-0">
                    <p className="truncate">{i.customerName}</p>
                    <p className="truncate text-xs text-slate-500">{i.customerEmail}</p>
                  </div>
                ),
              },
              {
                key: 'total',
                header: 'Total',
                align: 'right',
                cell: (i) => money(i.totalAmount, i.currencyCode),
              },
              { key: 'due', header: 'Due', cell: (i) => date(i.dueDate) },
              { key: 'status', header: 'Status', cell: (i) => <StatusBadge status={i.status} /> },
              {
                key: 'actions',
                header: '',
                cell: (i) =>
                  i.status === 'PAID' ? null : (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void issue.run(i.id)}
                      loading={issue.pending}
                      icon={<Send className="h-4 w-4" />}
                    >
                      {i.status === 'DRAFT' ? 'Issue' : 'Get link'}
                    </Button>
                  ),
              },
            ]}
          />
        )}
      </Card>

      <CreateInvoiceModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={async () => {
          setCreateOpen(false);
          await refresh();
        }}
      />

      <Modal
        open={Boolean(payUrl)}
        onClose={() => setPayUrl(null)}
        title="Invoice payment link"
        description="Send this to the customer. It collects once, then stops."
        footer={
          <Button variant="secondary" onClick={() => setPayUrl(null)}>
            Done
          </Button>
        }
      >
        {payUrl && <CopyField value={payUrl} label="Invoice payment URL" />}
      </Modal>
    </>
  );
}

function CreateInvoiceModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void | Promise<void>;
}) {
  const communityId = useCommunityId();
  const { toast } = useToast();
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [items, setItems] = useState<DraftItem[]>([emptyItem()]);

  const create = useMutation(
    () =>
      portalApi.createMerchantInvoice(communityId, {
        customerName: customerName.trim(),
        customerEmail: customerEmail.trim(),
        currencyCode: 'NGN',
        dueDate,
        items: items.map((item) => ({
          description: item.description.trim(),
          quantity: Number(item.quantity) || 1,
          unitPrice: item.unitPrice,
        })),
      }),
    {
      onSuccess: async () => {
        toast('Invoice drafted', 'success', 'Issue it when you are ready to be paid.');
        setCustomerName('');
        setCustomerEmail('');
        setDueDate('');
        setItems([emptyItem()]);
        await onCreated();
      },
      onError: (message) => toast('Could not create invoice', 'error', message),
    },
  );

  const updateItem = (index: number, patch: Partial<DraftItem>) =>
    setItems((current) => current.map((item, i) => (i === index ? { ...item, ...patch } : item)));

  const itemsValid = items.every(
    (item) => item.description.trim() && /^\d+(\.\d{1,2})?$/.test(item.unitPrice),
  );
  const complete =
    customerName.trim() && /\S+@\S+\.\S+/.test(customerEmail) && dueDate && itemsValid;

  const total = items.reduce(
    (sum, item) => sum + (Number(item.unitPrice) || 0) * (Number(item.quantity) || 0),
    0,
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New invoice"
      description="Drafted, not issued — nothing is payable until you issue it."
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => void create.run()} loading={create.pending} disabled={!complete}>
            Save draft
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Customer name" required>
            <Input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Adaeze Okafor"
            />
          </Field>
          <Field label="Customer email" required hint="Where the invoice is sent.">
            <Input
              type="email"
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
              placeholder="adaeze@example.com"
            />
          </Field>
        </div>
        <Field label="Due date" required>
          <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </Field>

        <div>
          <p className="mb-2 text-[13px] font-semibold text-navy-900">Items</p>
          <div className="space-y-2">
            {items.map((item, index) => (
              <div key={index} className="flex items-start gap-2">
                <Input
                  value={item.description}
                  onChange={(e) => updateItem(index, { description: e.target.value })}
                  placeholder="Description"
                  className="flex-1"
                  aria-label={`Item ${index + 1} description`}
                />
                <Input
                  value={item.quantity}
                  onChange={(e) =>
                    updateItem(index, { quantity: e.target.value.replace(/\D/g, '') })
                  }
                  inputMode="numeric"
                  className="w-16 tnum"
                  aria-label={`Item ${index + 1} quantity`}
                />
                <Input
                  value={item.unitPrice}
                  onChange={(e) => updateItem(index, { unitPrice: e.target.value })}
                  inputMode="decimal"
                  placeholder="0.00"
                  className="w-28 tnum"
                  aria-label={`Item ${index + 1} unit price`}
                />
                {items.length > 1 && (
                  <Button
                    variant="ghost"
                    size="md"
                    onClick={() => setItems((c) => c.filter((_, i) => i !== index))}
                    icon={<Trash2 className="h-4 w-4" />}
                    aria-label={`Remove item ${index + 1}`}
                  />
                )}
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setItems((c) => [...c, emptyItem()])}
              icon={<Plus className="h-4 w-4" />}
            >
              Add item
            </Button>
            <p className="text-[13px] text-slate-600">
              Total <span className="tnum font-semibold text-navy-900">{money(total, 'NGN')}</span>
            </p>
          </div>
        </div>
      </div>
    </Modal>
  );
}
