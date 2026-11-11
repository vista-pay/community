'use client';

import { useMemo, useState } from 'react';
import { Ban, CheckCircle2, ShieldOff } from 'lucide-react';
import {
  Badge,
  Button,
  Callout,
  Checkbox,
  Field,
  Modal,
  Textarea,
} from '@/components/ui';
import { useMutation, useQuery } from '@/hooks/use-query';
import { useCommunityId } from '@/components/providers/session-provider';
import { useToast } from '@/components/providers/toast-provider';
import { portalApi } from '@/services/portal';
import { date } from '@/lib/format';
import type { MemberSuspension, SuspensionScope, SuspensionScopeOption } from '@/types';

/**
 * Suspending a member, and lifting it again.
 *
 * Two things make this safe to hand to a volunteer secretary. The reason is
 * mandatory, because it is quoted to the member word for word in the app and
 * in the email — a suspension nobody can explain is a dispute. And each
 * checkbox states what it stops *and* what carries on, so "suspend from
 * savings" cannot be mistaken for "take their savings away".
 *
 * The scope list is fetched rather than hard-coded: the same wording has to
 * appear here, in the member's app and in the email, and three copies drift.
 */
export function SuspendMember({
  memberId,
  memberName,
  suspension,
  isStaff,
  options,
  onChanged,
}: {
  memberId: string;
  memberName: string;
  suspension: MemberSuspension | null;
  /** Officers do not consume member services, so there is nothing to pause. */
  isStaff: boolean;
  options: SuspensionScopeOption[];
  onChanged: () => Promise<void> | void;
}) {
  const communityId = useCommunityId();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [lifting, setLifting] = useState(false);

  const [picked, setPicked] = useState<SuspensionScope[]>([]);
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);

  const scopes = options;
  const allPicked = scopes.length > 0 && picked.length === scopes.length;
  const reasonInvalid = reason.trim().length < 5;

  // What the officer is actually changing, said plainly in the footer. An
  // editing officer who has unticked a box is lifting that scope, and the
  // dialog should say so rather than calling everything "suspend".
  const summary = useMemo(() => {
    const before = suspension?.scopes ?? [];
    const added = picked.filter((scope) => !before.includes(scope));
    const removed = before.filter((scope) => !picked.includes(scope));
    return { added, removed, unchanged: !added.length && !removed.length };
  }, [picked, suspension]);

  // The button says what pressing it does. "Suspend from nothing" is what a
  // naive count gives you before anything is ticked, and it reads as an
  // instruction to suspend rather than as a disabled state.
  const confirmLabel = suspension
    ? 'Save changes'
    : picked.length === 0
      ? 'Choose a service first'
      : allPicked
        ? 'Suspend from everything'
        : `Suspend from ${picked.length} service${picked.length === 1 ? '' : 's'}`;

  const save = useMutation(
    () => portalApi.suspendMember(communityId, memberId, { scopes: picked, reason: reason.trim() }),
    {
      onSuccess: async () => {
        toast(
          'Suspension saved',
          'success',
          `${memberName} has been emailed and notified in the app.`,
        );
        setOpen(false);
        await onChanged();
      },
      onError: (message) => toast('Could not save the suspension', 'error', message),
    },
  );

  const lift = useMutation(() => portalApi.liftMemberSuspension(communityId, memberId), {
    onSuccess: async () => {
      toast('Suspension lifted', 'success', `${memberName} can use every service again.`);
      setLifting(false);
      await onChanged();
    },
    onError: (message) => toast('Could not lift the suspension', 'error', message),
  });

  const begin = () => {
    setPicked(suspension?.scopes ?? []);
    setReason(suspension?.reason ?? '');
    setTouched(false);
    save.reset();
    setOpen(true);
  };

  if (isStaff) return null;

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {suspension ? (
          <>
            <Button variant="secondary" onClick={begin}>
              Edit suspension
            </Button>
            <Button variant="primary" loading={lift.pending} onClick={() => setLifting(true)}>
              <CheckCircle2 className="h-4 w-4" /> Lift suspension
            </Button>
          </>
        ) : (
          <Button variant="danger" onClick={begin}>
            <ShieldOff className="h-4 w-4" /> Suspend member
          </Button>
        )}
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        size="lg"
        title={suspension ? `Edit ${memberName}'s suspension` : `Suspend ${memberName}`}
        description="Choose the services to pause. The member keeps access to the community and to everything they already own."
        footer={
          <>
            <Button variant="secondary" disabled={save.pending} onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={save.pending}
              disabled={picked.length === 0 || (suspension ? summary.unchanged && reason.trim() === (suspension.reason ?? '') : false)}
              onClick={() => {
                setTouched(true);
                if (!reasonInvalid && picked.length) void save.run();
              }}
            >
              {confirmLabel}
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          {save.error && <Callout tone="danger">{save.error}</Callout>}

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-navy-900">What is being paused</p>
              <p className="text-[13px] text-slate-500">
                {picked.length === 0
                  ? 'Nothing selected yet.'
                  : allPicked
                    ? 'Everything — a full suspension.'
                    : `${picked.length} of ${scopes.length} services.`}
              </p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setPicked(allPicked ? [] : scopes.map((option) => option.scope))}
            >
              {allPicked ? 'Clear all' : 'Suspend everything'}
            </Button>
          </div>

          <div className="space-y-2">
            {scopes.length === 0 && <p className="text-sm text-slate-500">Loading services…</p>}
            {scopes.map((option) => {
              const checked = picked.includes(option.scope);
              return (
                <div
                  key={option.scope}
                  className={`rounded-xl border px-4 py-3 transition ${
                    checked ? 'border-red-200 bg-red-50/50' : 'border-slate-200 bg-white'
                  }`}
                >
                  <Checkbox
                    id={`scope-${option.scope}`}
                    checked={checked}
                    onChange={(value) =>
                      setPicked((previous) =>
                        value
                          ? [...previous, option.scope]
                          : previous.filter((scope) => scope !== option.scope),
                      )
                    }
                    label={
                      <span className="flex items-center gap-2">
                        {option.label}
                        {suspension?.scopes.includes(option.scope) && (
                          <Badge tone="red">Currently suspended</Badge>
                        )}
                      </span>
                    }
                    description={
                      <>
                        <span className="block">Stops: {option.blocks}.</span>
                        <span className="mt-0.5 block text-slate-400">{option.stillAllowed}</span>
                      </>
                    }
                  />
                </div>
              );
            })}
          </div>

          <Field
            label="Reason"
            htmlFor="suspension-reason"
            required
            hint="Shown to the member word for word, in the app and in the email. Write what you would say to their face."
            error={touched && reasonInvalid ? 'Give a reason of at least 5 characters.' : null}
          >
            <Textarea
              id="suspension-reason"
              rows={3}
              value={reason}
              invalid={touched && reasonInvalid}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Three months of contributions outstanding and no repayment plan agreed."
            />
          </Field>

          {summary.removed.length > 0 && (
            <Callout tone="info" title="This also restores access">
              {summary.removed
                .map((scope) => scopes.find((option) => option.scope === scope)?.label ?? scope)
                .join(', ')}{' '}
              will be available to {memberName} again.
            </Callout>
          )}

          <Callout tone="warning" title="What a suspension never does">
            It does not remove the member, touch their savings or cancel money already collected.
            Anything they owe stays repayable, so they can clear it and come back.
          </Callout>
        </div>
      </Modal>

      <Modal
        open={lifting}
        onClose={() => setLifting(false)}
        size="sm"
        title="Lift this suspension?"
        footer={
          <>
            <Button variant="secondary" disabled={lift.pending} onClick={() => setLifting(false)}>
              Cancel
            </Button>
            <Button loading={lift.pending} onClick={() => void lift.run()}>
              Lift suspension
            </Button>
          </>
        }
      >
        <div className="space-y-3 text-sm leading-relaxed text-slate-600">
          <p>
            {memberName} will be able to use every community service again straight away, and will
            be told so by email and in the app.
          </p>
          {suspension?.reason && (
            <p className="rounded-lg bg-slate-50 px-3 py-2 text-[13px]">
              Suspended {suspension.since ? date(suspension.since, 'long') : ''}:{' '}
              {suspension.reason}
            </p>
          )}
        </div>
      </Modal>
    </>
  );
}

/**
 * The scope catalogue, fetched once per screen.
 *
 * A hook rather than a fetch inside each component: the profile renders both
 * the notice and the dialog, and two copies of this query would be two
 * requests for a five-row list that never changes.
 */
export function useSuspensionScopes() {
  const communityId = useCommunityId();
  const { data } = useQuery<SuspensionScopeOption[]>(
    () => portalApi.suspensionScopes(communityId),
    [communityId],
  );
  return data ?? [];
}

/** The standing notice on a suspended member's profile. */
export function SuspensionNotice({
  suspension,
  options,
}: {
  suspension: MemberSuspension;
  options: SuspensionScopeOption[];
}) {
  const labels = Object.fromEntries(options.map((option) => [option.scope, option.label]));
  return (
    <Callout
      tone="danger"
      title={
        <span className="flex items-center gap-2">
          <Ban className="h-4 w-4" />
          {suspension.isFull
            ? 'Suspended from every community service'
            : `Suspended from ${suspension.scopes.map((scope) => labels[scope] ?? scope).join(', ')}`}
        </span>
      }
    >
      <p>{suspension.reason ?? 'No reason was recorded.'}</p>
      <p className="mt-1 text-[13px] text-red-800/80">
        {suspension.since ? `Since ${date(suspension.since, 'long')}` : 'Date not recorded'}
        {suspension.suspendedBy ? ` · by ${suspension.suspendedBy.name}` : ''}
      </p>
    </Callout>
  );
}
