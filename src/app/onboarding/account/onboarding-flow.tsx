'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, Check, CheckCircle2, MailCheck, ShieldCheck, UserPlus } from 'lucide-react';
import {
  Button,
  Callout,
  Field,
  Input,
  PasswordInput,
  Segmented,
  Textarea,
} from '@/components/ui';
import { post } from '@/lib/api';
import { cn } from '@/lib/format';

type Step = 'account' | 'verify' | 'community' | 'done';

const STEPS: Array<{ key: Step; label: string }> = [
  { key: 'account', label: 'Your account' },
  { key: 'verify', label: 'Verify' },
  { key: 'community', label: 'Community' },
];

/**
 * Three steps, in the order the API requires them:
 *
 *   1. Create the Vista account        POST /auth/register   (no session yet)
 *   2. Confirm the code                POST /auth/verify-otp (session starts)
 *   3. Register the community          POST /communities     (authenticated)
 *
 * Someone already signed in starts at step 3 — they have an account, they
 * just do not have a community.
 */
export function OnboardingFlow({ signedIn }: { signedIn: boolean }) {
  const [step, setStep] = useState<Step>(signedIn ? 'community' : 'account');
  const [identifier, setIdentifier] = useState('');
  const [createdName, setCreatedName] = useState('');

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card">
      {step !== 'done' && !signedIn && <Steps current={step} />}

      {step === 'account' && (
        <AccountStep
          onRegistered={(email) => {
            setIdentifier(email);
            setStep('verify');
          }}
        />
      )}

      {step === 'verify' && (
        <VerifyStep identifier={identifier} onVerified={() => setStep('community')} />
      )}

      {step === 'community' && (
        <CommunityStep
          onCreated={(name) => {
            setCreatedName(name);
            setStep('done');
          }}
        />
      )}

      {step === 'done' && <DoneStep name={createdName} />}
    </section>
  );
}

function Steps({ current }: { current: Step }) {
  const index = STEPS.findIndex((s) => s.key === current);

  return (
    <ol className="flex items-center gap-2 border-b border-slate-200 bg-slate-50/60 px-6 py-3">
      {STEPS.map((s, i) => {
        const done = i < index;
        const active = i === index;
        return (
          <li key={s.key} className="flex flex-1 items-center gap-2">
            <span
              className={cn(
                'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold',
                done
                  ? 'bg-navy-600 text-white'
                  : active
                    ? 'bg-navy-900 text-white'
                    : 'bg-slate-200 text-slate-500',
              )}
            >
              {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </span>
            <span
              className={cn(
                'truncate text-[13px]',
                active ? 'font-medium text-navy-900' : 'text-slate-500',
              )}
            >
              {s.label}
            </span>
            {i < STEPS.length - 1 && <span className="h-px flex-1 bg-slate-200" aria-hidden />}
          </li>
        );
      })}
    </ol>
  );
}

// ───────────────────────────── 1. Account ─────────────────────────────

function AccountStep({ onRegistered }: { onRegistered: (identifier: string) => void }) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [touched, setTouched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const emailInvalid = !/^\S+@\S+\.\S+$/.test(email.trim());
  const phoneInvalid = phone.trim().replace(/\D/g, '').length < 10;
  // Mirrors the API's own rule, so a weak password is caught here rather than
  // coming back as a validation error after the round trip.
  const passwordInvalid =
    password.length < 8 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) ||
    !/[\d\W]/.test(password);
  const mismatch = confirm !== password;
  const valid =
    firstName.trim() && lastName.trim() && !emailInvalid && !phoneInvalid && !passwordInvalid && !mismatch;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setTouched(true);
    setError(null);
    if (!valid || loading) return;

    setLoading(true);
    try {
      const result = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim(),
          password,
        }),
      });
      const json = await result.json().catch(() => ({}));
      if (!result.ok) throw new Error(json?.message ?? 'Could not create the account.');
      onRegistered(email.trim().toLowerCase());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the account.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Header
        icon={<UserPlus className="h-5 w-5" />}
        title="Create your Vista account"
        body="This is the account that will own the community. You will be its first officer."
      />

      <form className="space-y-5 px-6 py-6 sm:px-8" onSubmit={submit} noValidate>
        {error && <Callout tone="danger">{error}</Callout>}

        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            label="First name"
            htmlFor="ob-first"
            required
            error={touched && !firstName.trim() && 'Enter your first name.'}
          >
            <Input
              id="ob-first"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              invalid={touched && !firstName.trim()}
              autoComplete="given-name"
              autoFocus
            />
          </Field>

          <Field
            label="Last name"
            htmlFor="ob-last"
            required
            error={touched && !lastName.trim() && 'Enter your last name.'}
          >
            <Input
              id="ob-last"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              invalid={touched && !lastName.trim()}
              autoComplete="family-name"
            />
          </Field>

          <Field
            label="Email"
            htmlFor="ob-email"
            required
            error={touched && emailInvalid && 'Enter a valid email address.'}
          >
            <Input
              id="ob-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              invalid={touched && emailInvalid}
              autoComplete="email"
              placeholder="you@example.com"
            />
          </Field>

          <Field
            label="Phone"
            htmlFor="ob-phone"
            required
            error={touched && phoneInvalid && 'Enter a valid phone number.'}
          >
            <Input
              id="ob-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              invalid={touched && phoneInvalid}
              autoComplete="tel"
              placeholder="+234 801 234 5678"
            />
          </Field>

          <Field
            label="Password"
            htmlFor="ob-pw"
            required
            hint="At least 8 characters, with upper and lower case and a number or symbol"
            error={touched && passwordInvalid && 'That password does not meet the requirements.'}
          >
            <PasswordInput
              id="ob-pw"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              invalid={touched && passwordInvalid}
              autoComplete="new-password"
            />
          </Field>

          <Field
            label="Confirm password"
            htmlFor="ob-pw2"
            required
            error={touched && mismatch && 'The two passwords do not match.'}
          >
            <PasswordInput
              id="ob-pw2"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              invalid={touched && mismatch}
              autoComplete="new-password"
            />
          </Field>
        </div>

        <div className="flex justify-end border-t border-slate-200 pt-5">
          <Button type="submit" variant="blue" size="lg" loading={loading}>
            Create account
          </Button>
        </div>
      </form>
    </>
  );
}

// ───────────────────────────── 2. Verify ─────────────────────────────

function VerifyStep({
  identifier,
  onVerified,
}: {
  identifier: string;
  onVerified: () => void;
}) {
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (otp.length !== 6 || loading) return;

    setLoading(true);
    try {
      const res = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, otp }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.message ?? 'That code did not work.');

      if (!json.session) {
        // Already-active account: there is no session to continue with.
        setError(json.message ?? 'Please sign in instead.');
        return;
      }
      onVerified();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That code did not work.');
    } finally {
      setLoading(false);
    }
  }

  async function resend() {
    setResending(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/resend-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.message ?? 'Could not send another code.');
      setNotice(`A new code is on its way to ${identifier}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send another code.');
    } finally {
      setResending(false);
    }
  }

  return (
    <>
      <Header
        icon={<MailCheck className="h-5 w-5" />}
        title="Confirm your email"
        body={`We sent a six-digit code to ${identifier}. Enter it to activate your account.`}
      />

      <form className="space-y-5 px-6 py-6 sm:px-8" onSubmit={submit} noValidate>
        {error && <Callout tone="danger">{error}</Callout>}
        {notice && <Callout tone="info">{notice}</Callout>}

        <Field label="Verification code" htmlFor="ob-otp" required>
          <Input
            id="ob-otp"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="000000"
            className="tnum text-center text-lg tracking-[0.4em]"
            autoFocus
          />
        </Field>

        <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:items-center">
          <Button variant="ghost" onClick={resend} loading={resending} disabled={loading}>
            Send another code
          </Button>
          <div className="sm:flex-1" />
          <Button type="submit" size="lg" loading={loading} disabled={otp.length !== 6}>
            Verify and continue
          </Button>
        </div>
      </form>
    </>
  );
}

// ───────────────────────────── 3. Community ─────────────────────────────

function CommunityStep({ onCreated }: { onCreated: (name: string) => void }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [address, setAddress] = useState('');
  const [country, setCountry] = useState('NGA');
  const [touched, setTouched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nameInvalid = name.trim().length < 3;
  const emailInvalid = !/^\S+@\S+\.\S+$/.test(email.trim());
  const phoneInvalid = phone.trim().replace(/\D/g, '').length < 10;
  const valid = !nameInvalid && !emailInvalid && !phoneInvalid;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setTouched(true);
    setError(null);
    if (!valid || loading) return;

    setLoading(true);
    try {
      await post('/communities', {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        country,
        registrationNumber: registrationNumber.trim() || undefined,
        address: address.trim() || undefined,
      });
      onCreated(name.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not register this community.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Header
        icon={<Building2 className="h-5 w-5" />}
        title="Register your community"
        body="Vista reviews every registration before a community can collect contributions or appear in discovery."
      />

      <form className="space-y-5 px-6 py-6 sm:px-8" onSubmit={submit} noValidate>
        {error && <Callout tone="danger">{error}</Callout>}

        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            className="sm:col-span-2"
            label="Community name"
            htmlFor="cm-name"
            required
            error={touched && nameInvalid && 'Enter at least 3 characters.'}
          >
            <Input
              id="cm-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              invalid={touched && nameInvalid}
              placeholder="Ikeja Traders Cooperative Society"
              autoFocus
            />
          </Field>

          <Field
            label="Official email"
            htmlFor="cm-email"
            required
            hint="The community's own address, not your personal one"
            error={touched && emailInvalid && 'Enter a valid email address.'}
          >
            <Input
              id="cm-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              invalid={touched && emailInvalid}
              placeholder="admin@cooperative.ng"
            />
          </Field>

          <Field
            label="Official phone"
            htmlFor="cm-phone"
            required
            error={touched && phoneInvalid && 'Enter a valid phone number.'}
          >
            <Input
              id="cm-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              invalid={touched && phoneInvalid}
              placeholder="+234 801 234 5678"
            />
          </Field>

          <Field label="Country" htmlFor="cm-country" required>
            <Segmented
              label="Country"
              value={country}
              onChange={setCountry}
              options={[
                { value: 'NGA', label: 'Nigeria' },
                { value: 'GHA', label: 'Ghana' },
                { value: 'KEN', label: 'Kenya' },
              ]}
            />
          </Field>

          <Field
            label="Registration number"
            htmlFor="cm-reg"
            optional
            hint="CAC or state cooperative registration"
          >
            <Input
              id="cm-reg"
              value={registrationNumber}
              onChange={(e) => setRegistrationNumber(e.target.value.toUpperCase())}
              placeholder="RC1234567"
            />
          </Field>

          <Field className="sm:col-span-2" label="Registered address" htmlFor="cm-address" optional>
            <Textarea
              id="cm-address"
              rows={2}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Street, city and state"
            />
          </Field>
        </div>

        <Callout tone="info" title="Verification protects members">
          <span className="inline-flex items-start gap-1.5">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            Collections, payouts, lending and your public listing stay restricted until Vista
            completes its review. Everything else in the portal works straight away.
          </span>
        </Callout>

        <div className="flex justify-end border-t border-slate-200 pt-5">
          <Button type="submit" size="lg" loading={loading}>
            Register community
          </Button>
        </div>
      </form>
    </>
  );
}

function DoneStep({ name }: { name: string }) {
  const router = useRouter();

  return (
    <div className="px-6 py-10 text-center sm:px-10">
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
        <CheckCircle2 className="h-7 w-7" aria-hidden />
      </span>
      <h1 className="mt-5 text-2xl font-semibold text-navy-900">Registration submitted</h1>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-600">
        {name} is pending Vista verification. Open the workspace now to add officers, set up your
        books and invite members — you can track the verification status from Settings.
      </p>
      <Button
        className="mt-6"
        size="lg"
        onClick={() => {
          // A full load, not router.push: the session and community cookies
          // were set on a fetch response, and the portal shell is a server
          // component that has to read them on a fresh request.
          // eslint-disable-next-line @next/next/no-location-assign-relative-destination
          window.location.href = '/dashboard';
        }}
      >
        Open community portal
      </Button>
      <button
        type="button"
        onClick={() => router.refresh()}
        className="mt-3 block w-full text-[13px] text-slate-500 hover:text-navy-900"
      >
        Register another community
      </button>
    </div>
  );
}

function Header({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="border-b border-slate-200 px-6 py-6 sm:px-8">
      <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-navy-50 text-navy-700">
        {icon}
      </span>
      <h1 className="text-2xl font-semibold text-navy-900">{title}</h1>
      <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{body}</p>
    </div>
  );
}
