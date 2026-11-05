'use client';

import { useState } from 'react';
import { Ban, KeyRound, Plus } from 'lucide-react';
import {
  Badge,
  Button,
  Callout,
  Card,
  CardHeader,
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
import type { MerchantApiKey, MerchantApiKeyCreated } from '@/types';

export function ApiKeysClient({ initial }: { initial: MerchantApiKey[] }) {
  const communityId = useCommunityId();
  const { toast } = useToast();
  const { data, refresh } = useQuery<MerchantApiKey[]>(
    () => portalApi.merchantApiKeys(communityId),
    [communityId],
    { initial },
  );

  const keys = data ?? initial;
  const [name, setName] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [secret, setSecret] = useState<MerchantApiKeyCreated | null>(null);
  const [revoking, setRevoking] = useState<MerchantApiKey | null>(null);

  const create = useMutation(
    () => portalApi.createMerchantApiKey(communityId, { name: name.trim() }),
    {
      onSuccess: async (key) => {
        if (!key) return;
        setCreateOpen(false);
        setName('');
        setSecret(key);
        await refresh();
      },
      onError: (message) => toast('Could not create key', 'error', message),
    },
  );

  const revoke = useMutation((keyId: string) => portalApi.revokeMerchantApiKey(communityId, keyId), {
    onSuccess: async () => {
      toast('Key revoked', 'success');
      setRevoking(null);
      await refresh();
    },
    onError: (message) => toast('Could not revoke key', 'error', message),
  });

  return (
    <>
      <PageHeader
        title="API keys"
        subtitle="For the community's own scripts and systems"
        breadcrumb={<span>Merchant</span>}
        actions={
          <Button onClick={() => setCreateOpen(true)} icon={<Plus className="h-4 w-4" />}>
            New key
          </Button>
        }
      />

      {/* Said plainly rather than discovered later: a key that authenticates
          nothing is worse than no key, because the screen implies otherwise. */}
      <Callout tone="info" title="Not yet accepted by the API" className="mb-6">
        Keys are issued and stored hashed, but no Rendi endpoint authenticates with one yet — the
        same is true of business keys today. Create them to plan an integration; they will start
        working when key authentication ships, without needing to be reissued.
      </Callout>

      <Card>
        <CardHeader
          title="Keys"
          subtitle="A secret is shown once, at creation, and never again — only its hash is kept."
        />
        {keys.length === 0 ? (
          <EmptyState
            icon={<KeyRound className="h-5 w-5" />}
            title="No API keys"
            body="Create a key for each system that will talk to Rendi, so one can be revoked without affecting the others."
            action={
              <Button onClick={() => setCreateOpen(true)} icon={<Plus className="h-4 w-4" />}>
                New key
              </Button>
            }
          />
        ) : (
          <DataTable
            rows={keys}
            rowKey={(k) => k.id}
            columns={[
              { key: 'name', header: 'Name', cell: (k) => k.name },
              {
                key: 'prefix',
                header: 'Key',
                cell: (k) => <span className="font-mono text-[13px]">{k.keyPrefix}…</span>,
              },
              {
                key: 'status',
                header: 'Status',
                cell: (k) =>
                  k.isActive ? (
                    <Badge tone="green" dot>
                      Active
                    </Badge>
                  ) : (
                    <Badge tone="slate">Revoked</Badge>
                  ),
              },
              {
                key: 'used',
                header: 'Last used',
                cell: (k) =>
                  k.lastUsedAt ? date(k.lastUsedAt) : <span className="text-slate-500">Never</span>,
              },
              { key: 'created', header: 'Created', cell: (k) => date(k.createdAt) },
              {
                key: 'actions',
                header: '',
                cell: (k) =>
                  k.isActive ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setRevoking(k)}
                      icon={<Ban className="h-4 w-4" />}
                    >
                      Revoke
                    </Button>
                  ) : null,
              },
            ]}
          />
        )}
      </Card>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="New API key"
        description="Name it after the system that will use it, so you know what you are revoking later."
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => void create.run()}
              loading={create.pending}
              disabled={name.trim().length < 2}
            >
              Create key
            </Button>
          </>
        }
      >
        <Field label="Name" required>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Dues reconciliation script"
          />
        </Field>
      </Modal>

      <Modal
        open={Boolean(secret)}
        onClose={() => setSecret(null)}
        title="Copy your key now"
        description="This is the only time it is shown. If it is lost, revoke it and create another."
        footer={
          <Button onClick={() => setSecret(null)}>I have copied it</Button>
        }
      >
        {secret && <CopyField value={secret.secret} label="API key secret" />}
      </Modal>

      <ConfirmDialog
        open={Boolean(revoking)}
        onClose={() => setRevoking(null)}
        title="Revoke this key?"
        body={
          revoking
            ? `“${revoking.name}” stops working immediately. The record is kept so its history stays readable.`
            : ''
        }
        confirmLabel="Revoke"
        tone="danger"
        loading={revoke.pending}
        onConfirm={() => {
          if (revoking) void revoke.run(revoking.id);
        }}
      />
    </>
  );
}
