'use client';

import { useState } from 'react';
import { ExternalLink, Link2, Plus, Power, Trash2 } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  Checkbox,
  ConfirmDialog,
  DataTable,
  EmptyState,
  Field,
  Input,
  Modal,
  PageHeader,
  Textarea,
} from '@/components/ui';
import { CopyField } from '@/components/CopyField';
import { useCommunityId } from '@/components/providers/session-provider';
import { useToast } from '@/components/providers/toast-provider';
import { useMutation, useQuery } from '@/hooks/use-query';
import { portalApi } from '@/services/portal';
import { date, money } from '@/lib/format';
import type { MerchantPaymentLink } from '@/types';

export function PaymentLinksClient({ initial }: { initial: MerchantPaymentLink[] }) {
  const communityId = useCommunityId();
  const { toast } = useToast();
  const { data, refresh } = useQuery<MerchantPaymentLink[]>(
    () => portalApi.merchantPaymentLinks(communityId),
    [communityId],
    { initial },
  );

  const links = data ?? initial;
  const [createOpen, setCreateOpen] = useState(false);
  const [created, setCreated] = useState<MerchantPaymentLink | null>(null);
  const [deleting, setDeleting] = useState<MerchantPaymentLink | null>(null);

  const toggle = useMutation(
    (link: MerchantPaymentLink) =>
      portalApi.updateMerchantPaymentLink(communityId, link.id, { isActive: !link.isActive }),
    {
      onSuccess: async () => {
        toast('Link updated', 'success');
        await refresh();
      },
      onError: (message) => toast('Could not update link', 'error', message),
    },
  );

  const remove = useMutation(
    (linkId: string) => portalApi.deleteMerchantPaymentLink(communityId, linkId),
    {
      onSuccess: async () => {
        toast('Link deleted', 'success');
        setDeleting(null);
        await refresh();
      },
      onError: (message) => toast('Could not delete link', 'error', message),
    },
  );

  return (
    <>
      <PageHeader
        title="Payment links"
        subtitle="Shareable requests that credit the community wallet — levies, dues, donations, event fees"
        breadcrumb={<span>Merchant</span>}
        actions={
          <Button onClick={() => setCreateOpen(true)} icon={<Plus className="h-4 w-4" />}>
            New link
          </Button>
        }
      />

      <Card>
        <CardHeader
          title="Links"
          subtitle="Money paid through any of these lands in the community wallet, where loans, welfare and payouts draw from."
        />
        {links.length === 0 ? (
          <EmptyState
            icon={<Link2 className="h-5 w-5" />}
            title="No payment links yet"
            body="A payment link lets anyone pay the community by card or transfer without needing an account."
            action={
              <Button onClick={() => setCreateOpen(true)} icon={<Plus className="h-4 w-4" />}>
                New link
              </Button>
            }
          />
        ) : (
          <DataTable
            rows={links}
            rowKey={(l) => l.id}
            columns={[
              {
                key: 'title',
                header: 'Link',
                cell: (l) => (
                  <div className="min-w-0">
                    <p className="truncate font-medium text-navy-900">{l.title}</p>
                    {l.description && (
                      <p className="truncate text-xs text-slate-500">{l.description}</p>
                    )}
                  </div>
                ),
              },
              {
                key: 'amount',
                header: 'Amount',
                align: 'right',
                cell: (l) =>
                  l.amount ? (
                    money(l.amount, l.currencyCode)
                  ) : (
                    <span className="text-slate-500">Payer chooses</span>
                  ),
              },
              {
                key: 'uses',
                header: 'Paid',
                align: 'right',
                cell: (l) => (
                  <span className="tnum">
                    {l.currentUses}
                    {l.maxUses ? ` / ${l.maxUses}` : ''}
                  </span>
                ),
              },
              {
                key: 'status',
                header: 'Status',
                cell: (l) =>
                  l.isActive ? (
                    <Badge tone="green" dot>
                      Active
                    </Badge>
                  ) : (
                    <Badge tone="slate">Disabled</Badge>
                  ),
              },
              { key: 'created', header: 'Created', cell: (l) => date(l.createdAt) },
              {
                key: 'actions',
                header: '',
                cell: (l) => (
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setCreated(l)}
                      icon={<ExternalLink className="h-4 w-4" />}
                      aria-label={`Share ${l.title}`}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void toggle.run(l)}
                      loading={toggle.pending}
                      icon={<Power className="h-4 w-4" />}
                      aria-label={l.isActive ? `Disable ${l.title}` : `Enable ${l.title}`}
                    />
                    {/* Deleting is refused server-side once a link has been
                        paid, so receipts keep pointing at their source. */}
                    {l.currentUses === 0 && l.pendingUses === 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleting(l)}
                        icon={<Trash2 className="h-4 w-4" />}
                        aria-label={`Delete ${l.title}`}
                      />
                    )}
                  </div>
                ),
              },
            ]}
          />
        )}
      </Card>

      <CreateLinkModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={async (link) => {
          setCreateOpen(false);
          setCreated(link);
          await refresh();
        }}
      />

      <Modal
        open={Boolean(created)}
        onClose={() => setCreated(null)}
        title="Share this link"
        description="Anyone with the link can pay. Money lands in the community wallet."
        footer={
          <Button variant="secondary" onClick={() => setCreated(null)}>
            Done
          </Button>
        }
      >
        {created && <CopyField value={created.shareableUrl} label="Payment link URL" />}
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        title="Delete this payment link?"
        body={deleting ? `“${deleting.title}” has never been paid, so nothing is lost.` : ''}
        confirmLabel="Delete"
        tone="danger"
        loading={remove.pending}
        onConfirm={() => {
          if (deleting) void remove.run(deleting.id);
        }}
      />
    </>
  );
}

function CreateLinkModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (link: MerchantPaymentLink) => void | Promise<void>;
}) {
  const communityId = useCommunityId();
  const { toast } = useToast();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [fixed, setFixed] = useState(true);
  const [maxUses, setMaxUses] = useState('');

  const create = useMutation(
    () =>
      portalApi.createMerchantPaymentLink(communityId, {
        title: title.trim(),
        description: description.trim() || undefined,
        // An open-amount link must not carry an amount, or the payer is
        // quoted a figure the server then ignores.
        amount: fixed ? amount : undefined,
        currencyCode: 'NGN',
        isFixedAmount: fixed,
        maxUses: maxUses ? Number(maxUses) : undefined,
      }),
    {
      onSuccess: async (link) => {
        if (!link) return;
        toast('Payment link created', 'success');
        setTitle('');
        setDescription('');
        setAmount('');
        setMaxUses('');
        await onCreated(link);
      },
      onError: (message) => toast('Could not create link', 'error', message),
    },
  );

  const amountValid = !fixed || /^\d+(\.\d{1,2})?$/.test(amount);
  const complete = title.trim().length >= 2 && amountValid && (!fixed || amount);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New payment link"
      description="What is being collected, and how much."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => void create.run()} loading={create.pending} disabled={!complete}>
            Create link
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="What is this for" required>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="October levy"
          />
        </Field>
        <Field label="Description" optional>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Shown to whoever opens the link"
            rows={2}
          />
        </Field>
        <Checkbox
          checked={fixed}
          onChange={setFixed}
          label="Fixed amount"
          description="Uncheck to let the payer enter their own amount — useful for donations."
        />
        {fixed && (
          <Field
            label="Amount (NGN)"
            required
            error={amount && !amountValid ? 'Enter an amount like 5000 or 5000.00' : undefined}
          >
            <Input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="decimal"
              placeholder="5000.00"
              className="tnum"
            />
          </Field>
        )}
        <Field
          label="Maximum payments"
          optional
          hint="Leave blank for unlimited. Set to 1 for a one-off bill."
        >
          <Input
            value={maxUses}
            onChange={(e) => setMaxUses(e.target.value.replace(/\D/g, ''))}
            inputMode="numeric"
            placeholder="Unlimited"
          />
        </Field>
      </div>
    </Modal>
  );
}
