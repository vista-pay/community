'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button, Callout, Field, Input, PasswordInput } from '@/components/ui';
import { authApi } from '@/lib/api';

export function SignInForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next');
  // Set by /api/auth/expired, so an interrupted session explains itself
  // rather than looking like an unprompted sign-out.
  const expired = params.get('expired') === '1';

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [touched, setTouched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noWorkspace, setNoWorkspace] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setTouched(true);
    setError(null);
    setNoWorkspace(false);
    if (!identifier.trim() || !password) return;

    setLoading(true);
    try {
      const result = await authApi.signIn(identifier.trim(), password);

      // Signing in worked, but this person administers nothing. Saying so
      // beats dropping them on a dashboard that 403s on every call.
      if (result.needsCommunity) {
        setNoWorkspace(true);
        return;
      }

      // A full navigation, not router.push: the session cookie was just set
      // and the server layout has to read it on the next request.
      window.location.href = next && next.startsWith('/') ? next : '/dashboard';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="mt-5 space-y-4" onSubmit={submit} noValidate>
      {expired && !error && (
        <Callout tone="info" title="Your session ended">
          Sign in again to pick up where you left off.
        </Callout>
      )}

      {error && <Callout tone="danger">{error}</Callout>}

      {noWorkspace && (
        <Callout tone="warning" title="No community to manage">
          This account is signed in, but it is not an officer of any community. Ask your
          community&apos;s owner to add you as staff, or{' '}
          <button
            type="button"
            className="font-medium underline"
            onClick={() => router.push('/onboarding/account')}
          >
            register a community
          </button>
          .
        </Callout>
      )}

      <Field
        label="Email or phone number"
        htmlFor="si-id"
        required
        error={touched && !identifier.trim() && 'Enter the email or phone number you registered with.'}
      >
        <Input
          id="si-id"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          invalid={touched && !identifier.trim()}
          autoComplete="username"
          autoFocus
        />
      </Field>

      <Field label="Password" htmlFor="si-pw" required error={touched && !password && 'Enter your password.'}>
        <PasswordInput
          id="si-pw"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          invalid={touched && !password}
          autoComplete="current-password"
        />
      </Field>

      <div className="text-right">
        <Link href="/forgot-password" className="text-sm font-medium text-navy-700 hover:underline">
          Forgot password?
        </Link>
      </div>

      <Button type="submit" variant="blue" block size="lg" loading={loading}>
        Sign in
      </Button>
    </form>
  );
}
