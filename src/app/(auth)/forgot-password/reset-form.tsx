'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { Button, Callout, Field, Input, PasswordInput } from '@/components/ui';

type Step = 'request' | 'verify' | 'done';

async function postJson(path: string, body: unknown) {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.message ?? 'Request failed');
  return json;
}

export function ResetForm() {
  const [step, setStep] = useState<Step>('request');
  const [identifier, setIdentifier] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [touched, setTouched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function requestCode(e: FormEvent) {
    e.preventDefault();
    setTouched(true);
    setError(null);
    if (!identifier.trim()) return;
    setLoading(true);
    try {
      await postJson('/api/auth/forgot-password', { identifier: identifier.trim() });
      setTouched(false);
      setStep('verify');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send a reset code');
    } finally {
      setLoading(false);
    }
  }

  async function completeReset(e: FormEvent) {
    e.preventDefault();
    setTouched(true);
    setError(null);
    if (!/^\d{6}$/.test(otp.trim()) || password.length < 8 || password !== confirm) return;
    setLoading(true);
    try {
      await postJson('/api/auth/reset-password', {
        identifier: identifier.trim(),
        otp: otp.trim(),
        newPassword: password,
      });
      setStep('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Password reset failed');
    } finally {
      setLoading(false);
    }
  }

  if (step === 'done') {
    return (
      <div className="mt-5 space-y-4">
        <Callout tone="info" title="Password updated">
          Every signed-in session was closed. Sign in with your new password.
        </Callout>
        <Link
          href="/signin"
          className="block w-full rounded-lg bg-navy-700 py-3 text-center text-sm font-semibold text-white hover:bg-navy-800"
        >
          Back to sign in
        </Link>
      </div>
    );
  }

  if (step === 'verify') {
    return (
      <form className="mt-5 space-y-4" onSubmit={completeReset} noValidate>
        <Callout tone="info">
          If an account matches <b>{identifier.trim()}</b>, a 6-digit code is on its way. It
          expires in 10 minutes.
        </Callout>
        {error && <Callout tone="danger">{error}</Callout>}

        <Field
          label="Reset code"
          htmlFor="fp-otp"
          required
          error={touched && !/^\d{6}$/.test(otp.trim()) && 'Enter the 6-digit code from the email.'}
        >
          <Input
            id="fp-otp"
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            inputMode="numeric"
            maxLength={6}
            autoComplete="one-time-code"
            autoFocus
          />
        </Field>

        <Field
          label="New password"
          htmlFor="fp-pw"
          required
          error={touched && password.length < 8 && 'At least 8 characters, with upper and lower case.'}
        >
          <PasswordInput
            id="fp-pw"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
          />
        </Field>

        <Field
          label="Confirm new password"
          htmlFor="fp-pw2"
          required
          error={touched && password !== confirm && 'Passwords do not match.'}
        >
          <PasswordInput
            id="fp-pw2"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
          />
        </Field>

        <Button type="submit" variant="blue" block size="lg" loading={loading}>
          Set new password
        </Button>
        <button
          type="button"
          className="block w-full text-center text-sm text-slate-500 hover:underline"
          onClick={() => { setStep('request'); setOtp(''); setError(null); setTouched(false); }}
        >
          Use a different email or phone
        </button>
      </form>
    );
  }

  return (
    <form className="mt-5 space-y-4" onSubmit={requestCode} noValidate>
      {error && <Callout tone="danger">{error}</Callout>}
      <Field
        label="Email or phone number"
        htmlFor="fp-id"
        required
        error={touched && !identifier.trim() && 'Enter the email or phone number you registered with.'}
      >
        <Input
          id="fp-id"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          invalid={touched && !identifier.trim()}
          autoComplete="username"
          autoFocus
        />
      </Field>
      <Button type="submit" variant="blue" block size="lg" loading={loading}>
        Send reset code
      </Button>
    </form>
  );
}
