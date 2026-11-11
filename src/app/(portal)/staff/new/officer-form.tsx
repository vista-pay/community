'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, Users, Vote } from 'lucide-react';
import {
  Button,
  Callout,
  Card,
  Field,
  Input,
  PageHeader,
  RadioCard,
} from '@/components/ui';
import { useCommunityId } from '@/components/providers/session-provider';
import { useToast } from '@/components/providers/toast-provider';
import { useMutation, useQuery } from '@/hooks/use-query';
import { portalApi } from '@/services/portal';
import type { MemberRow } from '@/types';

/**
 * Roles come from the API, not a constant in the bundle.
 *
 * They used to come from a hardcoded list that had drifted out of step with
 * what actually existed — three of its six options named roles no server had,
 * so picking them failed on save. Reading the community's own roles means the
 * list cannot drift, and a post the community invented itself appears here
 * without a release.
 */
export function OfficerForm({ members }: { members: MemberRow[] }) {
  const communityId = useCommunityId();
  const router = useRouter();
  const { toast } = useToast();

  const roles = useQuery(() => portalApi.roles(communityId), [communityId]);
  const [email, setEmail] = useState('');
  // Empty until the officer picks. The effective choice is derived below
  // rather than defaulted into state from an effect: the roles arrive after
  // the first render, and writing them back would cost a second one.
  const [picked, setPicked] = useState('');
  const [title, setTitle] = useState('');

  // Plain membership is not an officer role, and the registrar's post belongs
  // to the account the community was registered with — neither is grantable
  // from here.
  const assignable = (roles.data ?? []).filter(
    (r) => r.name !== 'MEMBER' && r.name !== 'REGISTRAR',
  );

  const roleName = picked || assignable[0]?.name || '';

  const known = members.find((m) => m.email.toLowerCase() === email.trim().toLowerCase());
  const chosen = assignable.find((r) => r.name === roleName);
  // An elected post with a holder is a handover, and saying so here stops it
  // being a surprise on the Posts & roles screen afterwards.
  const incumbent = chosen?.isElected ? chosen.holders[0] : undefined;

  const add = useMutation(
    () =>
      portalApi.addStaff(communityId, {
        email: email.trim().toLowerCase(),
        roleName,
        title: title.trim() || undefined,
      }),
    {
      onSuccess: (r) => {
        toast(r.kind === 'INVITATION' ? 'Invitation sent' : 'Officer added', 'success');
        router.push('/staff');
      },
      onError: (m) => toast('Could not add officer', 'error', m),
    },
  );

  return (
    <>
      <PageHeader
        title="Add an officer"
        subtitle="Give a trusted member a clear responsibility. New users receive a secure invitation."
      />
      <Card className="mx-auto max-w-3xl">
        <div className="space-y-6 p-5 sm:p-7">
          {add.error && <Callout tone="danger">{add.error}</Callout>}

          <Field label="Email address" htmlFor="email" required>
            <Input
              id="email"
              className="h-12 text-base"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="treasurer@example.com"
            />
          </Field>

          {known && (
            <Callout tone="info">
              {known.name} is already a member. Their membership remains unchanged; only their
              officer role changes.
            </Callout>
          )}

          <Field
            label="Display title"
            htmlFor="title"
            optional
            hint="Shown instead of the standard role"
          >
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Acting Financial Secretary"
            />
          </Field>

          <div>
            <p className="label">Role</p>
            {roles.loading && !assignable.length ? (
              <p className="mt-2 text-sm text-slate-500">Loading this community’s posts…</p>
            ) : assignable.length === 0 ? (
              <Callout tone="warning" className="mt-2">
                This community has no assignable posts yet. Create one under Staff → Posts &amp;
                roles.
              </Callout>
            ) : (
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                {assignable.map((r) => (
                  <RadioCard
                    key={r.id}
                    selected={roleName === r.name}
                    onSelect={() => setPicked(r.name)}
                    title={r.label}
                    description={r.description ?? undefined}
                    badge={
                      r.isElected ? (
                        <Vote className="h-3.5 w-3.5 text-blue-600" aria-label="Elected post" />
                      ) : (
                        <Users className="h-3.5 w-3.5 text-slate-400" aria-label="Standing role" />
                      )
                    }
                    icon={<ShieldCheck className="h-4 w-4" />}
                  />
                ))}
              </div>
            )}
          </div>

          {incumbent && (
            <Callout tone="warning" title="This is a handover">
              {incumbent.name} holds {chosen?.label} now. Adding this officer moves the post and
              returns {incumbent.name} to plain membership.
            </Callout>
          )}

          <div className="sticky bottom-0 -mx-5 flex justify-end gap-3 border-t bg-white px-5 py-4 sm:-mx-7 sm:px-7">
            <Button variant="secondary" onClick={() => router.back()}>
              Cancel
            </Button>
            <Button
              disabled={!email.includes('@') || !roleName}
              loading={add.pending}
              onClick={() => void add.run()}
            >
              Add or invite officer
            </Button>
          </div>
        </div>
      </Card>
    </>
  );
}
