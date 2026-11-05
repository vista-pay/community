'use client';

import { useState } from 'react';
import { Plus, Trash2, Webhook } from 'lucide-react';
import {
  Badge,
  Button,
  Callout,
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
} from '@/components/ui';
import { CopyField } from '@/components/CopyField';
import { useCommunityId } from '@/components/providers/session-provider';
import { useToast } from '@/components/providers/toast-provider';
import { useMutation, useQuery } from '@/hooks/use-query';
import { portalApi } from '@/services/portal';
import { date } from '@/lib/format';
import type { MerchantWebhook, MerchantWebhookCreated } from '@/types';

/** The events a community merchant can subscribe to. */
const EVENTS = [
  { value: 'payment_link.paid', label: 'Payment link paid' },
  { value: 'invoice.paid', label: 'Invoice paid' },
  { value: 'wallet.credited', label: 'Wallet credited' },
  { value: 'wallet.debited', label: 'Wallet debited' },
] as const;

export function WebhooksClient({ initial }: { initial: MerchantWebhook[] }) {
  const communityId = useCommunityId();
  const { toast } = useToast();
  const { data, refresh } = useQuery<MerchantWebhook[]>(
    () => portalApi.merchantWebhooks(communityId),
    [communityId],
    { initial },
  );

  const endpoints = data ?? initial;
  const [createOpen, setCreateOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [selected, setSelected] = useState<string[]>(['payment_link.paid']);
  const [secret, setSecret] = useState<MerchantWebhookCreated | null>(null);
  const [removing, setRemoving] = useState<MerchantWebhook | null>(null);

  const create = useMutation(
    () => portalApi.createMerchantWebhook(communityId, { url: url.trim(), events: selected }),
    {
      onSuccess: async (endpoint) => {
        if (!endpoint) return;
        setCreateOpen(false);
        setUrl('');
        setSecret(endpoint);
        await refresh();
      },
      onError: (message) => toast('Could not add endpoint', 'error', message),
    },
  );

  const remove = useMutation(
    (endpointId: string) => portalApi.removeMerchantWebhook(communityId, endpointId),
    {
      onSuccess: async () => {
        toast('Endpoint removed', 'success');
        setRemoving(null);
        await refresh();
      },
      onError: (message) => toast('Could not remove endpoint', 'error', message),
    },
  );

  const toggleEvent = (value: string, on: boolean) =>
    setSelected((current) =>
      on ? [...current, value] : current.filter((event) => event !== value),
    );

  return (
    <>
      <PageHeader
        title="Webhooks"
        subtitle="Tell the community's own systems when money moves"
        breadcrumb={<span>Merchant</span>}
        actions={
          <Button onClick={() => setCreateOpen(true)} icon={<Plus className="h-4 w-4" />}>
            Add endpoint
          </Button>
        }
      />

      {/* Same honesty as the API keys page: registering an endpoint today
          records it, and nothing delivers to it yet. */}
      <Callout tone="info" title="Not yet delivering" className="mb-6">
        Endpoints are recorded with a signing secret, but Rendi does not dispatch to them yet —
        business endpoints are in the same state. Register yours now to settle on a URL and events;
        delivery begins when the dispatcher ships, with no change needed here.
      </Callout>

      <Card>
        <CardHeader
          title="Endpoints"
          subtitle="Each endpoint gets its own signing secret, shown once. Verify it on every request you receive."
        />
        {endpoints.length === 0 ? (
          <EmptyState
            icon={<Webhook className="h-5 w-5" />}
            title="No endpoints"
            body="Add an HTTPS URL the community controls, and choose which events it should hear about."
            action={
              <Button onClick={() => setCreateOpen(true)} icon={<Plus className="h-4 w-4" />}>
                Add endpoint
              </Button>
            }
          />
        ) : (
          <DataTable
            rows={endpoints}
            rowKey={(e) => e.id}
            columns={[
              {
                key: 'url',
                header: 'URL',
                cell: (e) => <span className="break-all font-mono text-[13px]">{e.url}</span>,
              },
              {
                key: 'events',
                header: 'Events',
                cell: (e) => (
                  <div className="flex flex-wrap gap-1">
                    {(Array.isArray(e.events) ? e.events : []).map((event) => (
                      <Badge key={event} tone="slate">
                        {event}
                      </Badge>
                    ))}
                  </div>
                ),
              },
              { key: 'added', header: 'Added', cell: (e) => date(e.createdAt) },
              {
                key: 'actions',
                header: '',
                cell: (e) => (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setRemoving(e)}
                    icon={<Trash2 className="h-4 w-4" />}
                    aria-label={`Remove ${e.url}`}
                  />
                ),
              },
            ]}
          />
        )}
      </Card>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Add a webhook endpoint"
        description="Must be HTTPS — a signing secret over plain HTTP is a secret in the clear."
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => void create.run()}
              loading={create.pending}
              disabled={!url.trim().startsWith('https://') || selected.length === 0}
            >
              Add endpoint
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Endpoint URL" required>
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.coop/rendi/webhook"
              className="font-mono text-[13px]"
            />
          </Field>
          <div>
            <p className="mb-2 text-[13px] font-semibold text-navy-900">Events</p>
            <div className="space-y-2">
              {EVENTS.map((event) => (
                <Checkbox
                  key={event.value}
                  checked={selected.includes(event.value)}
                  onChange={(on) => toggleEvent(event.value, on)}
                  label={event.label}
                  description={event.value}
                />
              ))}
            </div>
          </div>
        </div>
      </Modal>

      <Modal
        open={Boolean(secret)}
        onClose={() => setSecret(null)}
        title="Copy your signing secret now"
        description="This is the only time it is shown. Use it to verify that a request really came from Rendi."
        footer={<Button onClick={() => setSecret(null)}>I have copied it</Button>}
      >
        {secret && <CopyField value={secret.signingSecret} label="Webhook signing secret" />}
      </Modal>

      <ConfirmDialog
        open={Boolean(removing)}
        onClose={() => setRemoving(null)}
        title="Remove this endpoint?"
        body={removing ? `${removing.url} will stop being called.` : ''}
        confirmLabel="Remove"
        tone="danger"
        loading={remove.pending}
        onConfirm={() => {
          if (removing) void remove.run(removing.id);
        }}
      />
    </>
  );
}
