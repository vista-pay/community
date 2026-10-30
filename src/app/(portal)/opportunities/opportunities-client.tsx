'use client';

import { useState } from 'react';
import { Plus, Sparkles } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Select,
  Textarea,
} from '@/components/ui';
import { useMutation, useQuery } from '@/hooks/use-query';
import { useCommunityId } from '@/components/providers/session-provider';
import { useToast } from '@/components/providers/toast-provider';
import { portalApi } from '@/services/portal';
import { date } from '@/lib/format';
import type { Opportunity } from '@/types';

/**
 * What members see on their Opportunities screen comes from here — training
 * programmes and negotiated partner offers, published and retired by the
 * community itself.
 */
export function OpportunitiesClient({ initial }: { initial: Opportunity[] }) {
  const communityId = useCommunityId();
  const { toast } = useToast();
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<'PROGRAMME' | 'PARTNER_OFFER'>('PROGRAMME');
  const [category, setCategory] = useState('');
  const [howToApply, setHowToApply] = useState('');
  const [description, setDescription] = useState('');
  const [detail, setDetail] = useState('');
  const [closesAt, setClosesAt] = useState('');

  const { data, refresh } = useQuery<Opportunity[]>(
    () => portalApi.opportunities(communityId),
    [communityId],
    { initial },
  );
  const rows = data ?? initial;

  const save = useMutation(
    () =>
      portalApi.upsertOpportunity(communityId, {
        title: title.trim(),
        kind,
        category: category.trim() || null,
        description: description.trim(),
        detail: detail.trim() || null,
        howToApply: howToApply.trim() || null,
        closesAt: closesAt || null,
      }),
    {
      onSuccess: async () => {
        toast('Published', 'success', 'Members see it in their app immediately.');
        setCreating(false);
        setTitle('');
        setCategory('');
        setDescription('');
        setDetail('');
        setHowToApply('');
        setClosesAt('');
        await refresh();
      },
      onError: (message) => toast('Could not publish', 'error', message),
    },
  );

  const toggle = useMutation(
    (opp: Opportunity) =>
      portalApi.upsertOpportunity(communityId, { id: opp.id, isActive: !opp.isActive }),
    {
      onSuccess: async () => {
        toast('Updated', 'info');
        await refresh();
      },
      onError: (message) => toast('Could not update', 'error', message),
    },
  );

  return (
    <>
      <PageHeader
        title="Opportunities"
        subtitle="Programmes and partner offers shown on your members' Opportunities screen"
        actions={
          <Button icon={<Plus className="h-4 w-4" />} onClick={() => setCreating((v) => !v)}>
            New opportunity
          </Button>
        }
      />

      {creating && (
        <Card className="mb-6">
          <CardHeader title="Publish an opportunity" />
          <div className="space-y-4 px-5 py-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Title" htmlFor="op-title" required>
                <Input
                  id="op-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="SME growth training — Ikeja cohort"
                />
              </Field>
              <Field
                label="Category"
                htmlFor="op-category"
                optional
                hint="Education, Health, Business… shown with the sub-category below"
              >
                <Input
                  id="op-category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="e.g. Education"
                />
              </Field>
              <Field label="Sub-category" htmlFor="op-kind">
                <Select id="op-kind" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
                  <option value="PROGRAMME">Programme</option>
                  <option value="PARTNER_OFFER">Partner offer</option>
                </Select>
              </Field>
            </div>
            <Field label="Description" htmlFor="op-desc" required>
              <Textarea
                id="op-desc"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What it is, who it's for, how to take part"
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Detail line" htmlFor="op-detail" optional hint="e.g. 6 weekly sessions · free for members · 40 places">
                <Input id="op-detail" value={detail} onChange={(e) => setDetail(e.target.value)} />
              </Field>
              <Field
                label="How to register"
                htmlFor="op-apply"
                optional
                hint="Exactly what a member should do — steps, documents, who to contact"
              >
                <Textarea
                  id="op-apply"
                  rows={3}
                  value={howToApply}
                  onChange={(e) => setHowToApply(e.target.value)}
                  placeholder={'1. Tap Register in the app\n2. Bring your member card to the office\n3. ...'}
                />
              </Field>
              <Field label="Closes" htmlFor="op-closes" optional>
                <Input id="op-closes" type="date" value={closesAt} onChange={(e) => setClosesAt(e.target.value)} />
              </Field>
            </div>
            <Button
              disabled={!title.trim() || !description.trim()}
              loading={save.pending}
              onClick={() => void save.run()}
            >
              Publish
            </Button>
          </div>
        </Card>
      )}

      <div className="space-y-3">
        {rows.length === 0 && (
          <Card>
            <EmptyState
              icon={<Sparkles className="h-5 w-5" />}
              title="Nothing published yet"
              body="Opportunities you publish here appear on every member's Opportunities screen."
            />
          </Card>
        )}
        {rows.map((o) => (
          <Card key={o.id}>
            <div className="flex flex-col justify-between gap-3 px-5 py-4 sm:flex-row sm:items-center">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-navy-900">{o.title}</p>
                  <Badge tone={o.kind === 'PROGRAMME' ? 'navy' : 'slate'}>
                    {o.kind === 'PROGRAMME' ? 'Programme' : 'Partner offer'}
                  </Badge>
                  <Badge tone={o.isActive ? 'green' : 'slate'}>{o.isActive ? 'Live' : 'Retired'}</Badge>
                </div>
                <p className="mt-1 text-[13px] text-slate-600">{o.description}</p>
                <p className="mt-0.5 text-xs text-slate-400">
                  {o.detail ? `${o.detail} · ` : ''}
                  {o.closesAt ? `Closes ${date(o.closesAt)}` : 'No closing date'}
                </p>
              </div>
              <Button variant="secondary" loading={toggle.pending} onClick={() => void toggle.run(o)}>
                {o.isActive ? 'Retire' : 'Republish'}
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}
