'use client';

import { useState } from 'react';
import { KeyRound, Laptop, Lock, ShieldCheck } from 'lucide-react';
import {
  Badge,
  Button,
  Callout,
  Card,
  CardHeader,
  Field,
  Input,
  Spinner,
  Toggle,
} from '@/components/ui';
import { useMutation, useQuery } from '@/hooks/use-query';
import { useToast } from '@/components/providers/toast-provider';
import { portalApi } from '@/services/portal';
import { date as formatDate } from '@/lib/format';
import type { AccountSecurity } from '@/types';

/**
 * The signed-in officer's own account security — not the community's.
 *
 * It lives in Settings because that is where an officer looks for it, but
 * nothing here is community-scoped: an officer of three communities has one
 * password and one transaction PIN, and changing it changes it everywhere.
 *
 * The transaction PIN is the reason this screen had to exist. Every approval
 * decision and every payout is confirmed with it, so an officer who has never
 * set one cannot do the job they were given a post for — and until now there
 * was nowhere in the portal to set it.
 */
export function SecurityPanel() {
  const { toast } = useToast();
  const security = useQuery(() => portalApi.accountSecurity(), []);
  const sessions = useQuery(() => portalApi.accountSessions(), []);

  if (security.loading && !security.data) {
    return (
      <div className="py-16 text-center">
        <Spinner />
      </div>
    );
  }

  if (!security.data) {
    return (
      <Callout tone="danger" title="Could not load your security settings">
        {security.error ?? 'Try again in a moment.'}
      </Callout>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <PinCard security={security.data} onDone={security.refresh} toast={toast} />
      <PasswordCard toast={toast} />
      <SignInCard security={security.data} onDone={security.refresh} toast={toast} />
      <SessionsCard
        sessions={sessions.data?.sessions ?? []}
        loading={sessions.loading}
        onDone={sessions.refresh}
        toast={toast}
      />
    </div>
  );
}

/** Set a first transaction PIN, or change one. */
function PinCard({
  security,
  onDone,
  toast,
}: {
  security: AccountSecurity;
  onDone: () => Promise<void>;
  toast: ReturnType<typeof useToast>['toast'];
}) {
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [password, setPassword] = useState('');

  const save = useMutation(
    () =>
      portalApi.setTransactionPin({
        pin,
        // Only demanded when replacing one. A first PIN is set on the
        // strength of the session the officer is already signed in with.
        ...(security.hasPin ? { password } : {}),
      }),
    {
      onSuccess: async () => {
        toast(
          security.hasPin ? 'Transaction PIN changed' : 'Transaction PIN set',
          'success',
          'Use it to confirm approvals and payouts.',
        );
        setPin('');
        setConfirm('');
        setPassword('');
        await onDone();
      },
      onError: (message) => toast('Could not set your PIN', 'error', message),
    },
  );

  const digitsOnly = /^\d{4}$/.test(pin);
  const matches = pin === confirm;
  const ready = digitsOnly && matches && (!security.hasPin || password.length > 0);

  return (
    <Card>
      <CardHeader
        title="Transaction PIN"
        subtitle="Four digits. Confirms every approval you give and every payment you release."
        action={
          <Badge tone={security.hasPin ? 'green' : 'amber'}>
            {security.hasPin ? 'Set' : 'Not set'}
          </Badge>
        }
      />
      <div className="space-y-4 px-5 py-4">
        {!security.hasPin && (
          <Callout tone="warning" title="You have no PIN yet">
            Approvals and payouts ask for it, so you cannot act on either until one is set.
          </Callout>
        )}
        {security.hasPin && security.pinChangedAt && (
          <p className="text-[13px] text-slate-500">
            Last changed {formatDate(security.pinChangedAt, 'long')}. If that was not you, change
            it now and then change your password.
          </p>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={security.hasPin ? 'New PIN' : 'Choose a PIN'} htmlFor="sec-pin" required>
            <Input
              id="sec-pin"
              type="password"
              inputMode="numeric"
              autoComplete="off"
              maxLength={4}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
            />
          </Field>
          <Field
            label="Repeat it"
            htmlFor="sec-pin-confirm"
            required
            error={confirm && !matches ? 'The two do not match' : undefined}
          >
            <Input
              id="sec-pin-confirm"
              type="password"
              inputMode="numeric"
              autoComplete="off"
              maxLength={4}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value.replace(/\D/g, ''))}
            />
          </Field>
        </div>

        {security.hasPin && (
          <Field
            label="Your password"
            htmlFor="sec-pin-password"
            required
            hint="Proves it is you changing it, not someone at your open laptop."
          >
            <Input
              id="sec-pin-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
        )}

        <Button
          icon={<KeyRound className="h-4 w-4" />}
          loading={save.pending}
          disabled={!ready}
          onClick={() => void save.run()}
        >
          {security.hasPin ? 'Change PIN' : 'Set PIN'}
        </Button>
      </div>
    </Card>
  );
}

function PasswordCard({ toast }: { toast: ReturnType<typeof useToast>['toast'] }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');

  const save = useMutation(
    () => portalApi.changePassword({ currentPassword: current, newPassword: next }),
    {
      onSuccess: () => {
        toast(
          'Password changed',
          'success',
          'Every other device has been signed out. You will be asked to sign in again shortly.',
        );
        setCurrent('');
        setNext('');
        setConfirm('');
      },
      onError: (message) => toast('Could not change your password', 'error', message),
    },
  );

  const matches = next === confirm;
  const ready = current.length > 0 && next.length >= 8 && matches;

  return (
    <Card>
      <CardHeader
        title="Password"
        subtitle="Signs you in to the portal. Changing it signs out every other device."
      />
      <div className="space-y-4 px-5 py-4">
        <Field label="Current password" htmlFor="sec-current" required>
          <Input
            id="sec-current"
            type="password"
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
          />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label="New password"
            htmlFor="sec-next"
            required
            hint="At least 8 characters."
          >
            <Input
              id="sec-next"
              type="password"
              autoComplete="new-password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
            />
          </Field>
          <Field
            label="Repeat it"
            htmlFor="sec-next-confirm"
            required
            error={confirm && !matches ? 'The two do not match' : undefined}
          >
            <Input
              id="sec-next-confirm"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </Field>
        </div>
        <Button
          icon={<Lock className="h-4 w-4" />}
          loading={save.pending}
          disabled={!ready}
          onClick={() => void save.run()}
        >
          Change password
        </Button>
      </div>
    </Card>
  );
}

/**
 * Sign-in protection.
 *
 * Deliberately named for what it does rather than badged as "two-factor
 * authentication": what the platform has today is a challenge on an
 * unrecognised device, not an authenticator app. Calling it 2FA would tell an
 * officer their account is protected in a way it is not.
 */
function SignInCard({
  security,
  onDone,
  toast,
}: {
  security: AccountSecurity;
  onDone: () => Promise<void>;
  toast: ReturnType<typeof useToast>['toast'];
}) {
  const save = useMutation(
    (confirmNewDevices: boolean) => portalApi.updateAccountSecurity({ confirmNewDevices }),
    {
      onSuccess: async () => {
        toast('Saved', 'success');
        await onDone();
      },
      onError: (message) => toast('Could not save that', 'error', message),
    },
  );

  return (
    <Card>
      <CardHeader
        title="Sign-in protection"
        subtitle="Extra checks when your account is used somewhere new."
      />
      <div className="space-y-4 px-5 py-4">
        <Toggle
          checked={security.confirmNewDevices}
          disabled={save.pending}
          label="Confirm sign-in from a device I have not used before"
          onChange={(next) => void save.run(next)}
        />
        <p className="text-[13px] leading-relaxed text-slate-500">
          A one-time code is sent before a new device can be used. An authenticator app is not
          supported yet — until it is, this and your transaction PIN are what stand between a
          stolen password and your community&apos;s money.
        </p>
        <div className="flex items-start gap-2.5 rounded-xl bg-slate-50 p-3">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
          <p className="text-[13px] text-slate-600">
            Approvals are confirmed with your PIN whatever this is set to — an approval has to be
            your own act.
          </p>
        </div>
      </div>
    </Card>
  );
}

function SessionsCard({
  sessions,
  loading,
  onDone,
  toast,
}: {
  sessions: { id: string; deviceName: string | null; os: string | null; lastActiveAt: string; isCurrent: boolean }[];
  loading: boolean;
  onDone: () => Promise<void>;
  toast: ReturnType<typeof useToast>['toast'];
}) {
  const revoke = useMutation(() => portalApi.revokeOtherSessions(), {
    onSuccess: async (result) => {
      toast(
        'Signed out everywhere else',
        'success',
        `${(result as { revoked: number } | null)?.revoked ?? 0} device(s) will have to sign in again.`,
      );
      await onDone();
    },
    onError: (message) => toast('Could not sign those out', 'error', message),
  });

  return (
    <Card>
      <CardHeader
        title="Where you are signed in"
        subtitle="Every device holding a live session for your account."
        action={
          sessions.length > 1 ? (
            <Button
              variant="secondary"
              size="sm"
              loading={revoke.pending}
              onClick={() => void revoke.run()}
            >
              Sign out the others
            </Button>
          ) : undefined
        }
      />
      <div className="px-5 py-4">
        {loading && sessions.length === 0 ? (
          <Spinner />
        ) : sessions.length === 0 ? (
          <p className="text-[13px] text-slate-500">
            No devices recorded yet. Sessions appear here once you sign in from the Rendi app.
          </p>
        ) : (
          <ul className="space-y-2">
            {sessions.map((session) => (
              <li
                key={session.id}
                className="flex items-center gap-3 rounded-xl border border-slate-200 p-3"
              >
                <Laptop className="h-4 w-4 shrink-0 text-slate-400" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-navy-900">
                    {session.deviceName ?? 'Unnamed device'}
                    {session.os ? ` · ${session.os}` : ''}
                  </p>
                  <p className="text-xs text-slate-500">
                    Last active {formatDate(session.lastActiveAt, 'datetime')}
                  </p>
                </div>
                {session.isCurrent && <Badge tone="green">This device</Badge>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
