'use client';

import { useState, type FormEvent, type ReactNode } from 'react';
import { Building2, Check, MailCheck, ShieldCheck, UserRound } from 'lucide-react';
import { Button, Callout, Field, Input, PasswordInput, Segmented } from '@/components/ui';
import { post } from '@/lib/api';
import { cn } from '@/lib/format';

type Step = 'details' | 'verify';

const STEPS: Array<{ key: Step; label: string }> = [
  { key: 'details', label: 'Community details' },
  { key: 'verify', label: 'Verify email' },
];

const COUNTRIES = [
  { value: 'NGA', label: 'Nigeria' },
  { value: 'GHA', label: 'Ghana' },
  { value: 'KEN', label: 'Kenya' },
];

/**
 * Community registration.
 *
 *   1. Community + administrator details   POST /community-onboarding/register
 *   2. Confirm the code                    POST /auth/verify-otp (session starts)
 *   3. Verification profile                a modal in the portal, not here
 *
 * The account created in step 1 is the *organisation's*, not a person's: it
 * signs in with the community's official email, and that address — with the
 * official phone — is reserved platform-wide. The administrator's own email
 * and phone are recorded as a contact and claim nothing, so the same person
 * can still open an ordinary personal Rendi account afterwards.
 *
 * Someone already signed in skips straight to the details form, posting to
 * the authenticated `POST /communities` instead: they have an account, they
 * just do not have a community.
 */
export function OnboardingFlow({ signedIn }: { signedIn: boolean }) {
  const [step, setStep] = useState<Step>('details');
  const [officialEmail, setOfficialEmail] = useState('');

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card">
      {!signedIn && <Steps current={step} />}

      {step === 'details' && (
        <DetailsStep
          signedIn={signedIn}
          onRegistered={(email) => {
            setOfficialEmail(email);
            setStep('verify');
          }}
        />
      )}

      {step === 'verify' && <VerifyStep identifier={officialEmail} />}
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

// ──────────────────────── 1. Community + administrator ────────────────────────

const emailBad = (v: string) => !/^\S+@\S+\.\S+$/.test(v.trim());
const phoneBad = (v: string) => v.trim().replace(/\D/g, '').length < 10;

function DetailsStep({
  signedIn,
  onRegistered,
}: {
  signedIn: boolean;
  onRegistered: (officialEmail: string) => void;
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [country, setCountry] = useState('NGA');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');

  const [registrarName, setRegistrarName] = useState('');
  const [registrarEmail, setRegistrarEmail] = useState('');
  const [registrarPhone, setRegistrarPhone] = useState('');

  const [touched, setTouched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nameBad = name.trim().length < 3;
  const registrarNameBad = registrarName.trim().length < 3;
  // Mirrors the API's own rule, so a weak password is caught here rather than
  // coming back as a validation error after the round trip.
  const passwordBad =
    password.length < 8 ||
    !/[a-z]/.test(password) ||
    !/[A-Z]/.test(password) ||
    !/[\d\W]/.test(password);
  const mismatch = confirm !== password;

  // The same address on both halves of the form is the one mistake this flow
  // has to catch before the API does, because the consequence is permanent:
  // the official address is reserved, and the person who used their own would
  // never be able to open a personal account on it.
  const sameAsOfficial =
    !emailBad(email) && email.trim().toLowerCase() === registrarEmail.trim().toLowerCase();

  const valid =
    !nameBad &&
    !emailBad(email) &&
    !phoneBad(phone) &&
    !registrarNameBad &&
    !emailBad(registrarEmail) &&
    !phoneBad(registrarPhone) &&
    !sameAsOfficial &&
    (signedIn || (!passwordBad && !mismatch));

  async function submit(event: FormEvent) {
    event.preventDefault();
    setTouched(true);
    setError(null);
    if (!valid || loading) return;

    const payload = {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim(),
      country,
      registrarName: registrarName.trim(),
      registrarEmail: registrarEmail.trim().toLowerCase(),
      registrarPhone: registrarPhone.trim(),
    };

    setLoading(true);
    try {
      if (signedIn) {
        // Already has an account, so the authenticated endpoint applies and
        // there is no email to verify — straight into the portal, where the
        // verification modal takes over.
        await post('/communities', payload);
        // A full load, not router.push: the community cookie is set on a
        // fetch response and the portal shell is a server component that has
        // to read it on a fresh request.
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.href = '/dashboard';
        return;
      }

      const res = await fetch('/api/community-onboarding/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, password }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.message ?? 'Could not register this community.');
      onRegistered(payload.email);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not register this community.');
      setLoading(false);
    }
  }

  return (
    <>
      <Header
        icon={<Building2 className="h-5 w-5" />}
        title="Register your community"
        body="Two things: the community itself, and who is registering it. Rendi reviews every registration before a community can collect contributions."
      />

      <form className="space-y-7 px-6 py-6 sm:px-8" onSubmit={submit} noValidate>
        {error && <Callout tone="danger">{error}</Callout>}

        <fieldset className="space-y-5">
          <SectionLabel
            icon={<Building2 className="h-3.5 w-3.5" />}
            title="Community details"
            body="These belong to the organisation, and the official email is what you will sign in with."
          />

          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              className="sm:col-span-2"
              label="Community name"
              htmlFor="cm-name"
              required
              error={touched && nameBad && 'Enter at least 3 characters.'}
            >
              <Input
                id="cm-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                invalid={touched && nameBad}
                placeholder="Ikeja Traders Cooperative Society"
                autoFocus
              />
            </Field>

            <Field
              label="Official email"
              htmlFor="cm-email"
              required
              hint="The community's own address, not a personal one"
              error={touched && emailBad(email) && 'Enter a valid email address.'}
            >
              <Input
                id="cm-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                invalid={touched && emailBad(email)}
                autoComplete="email"
                placeholder="admin@cooperative.ng"
              />
            </Field>

            <Field
              label="Official phone"
              htmlFor="cm-phone"
              required
              error={touched && phoneBad(phone) && 'Enter a valid phone number.'}
            >
              <Input
                id="cm-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                invalid={touched && phoneBad(phone)}
                placeholder="+234 801 234 5678"
              />
            </Field>

            <Field className="sm:col-span-2" label="Country" htmlFor="cm-country" required>
              <Segmented
                label="Country"
                value={country}
                onChange={setCountry}
                options={COUNTRIES}
              />
            </Field>

            {!signedIn && (
              <>
                <Field
                  label="Password"
                  htmlFor="cm-pw"
                  required
                  hint="At least 8 characters, with upper and lower case and a number or symbol"
                  error={touched && passwordBad && 'That password does not meet the requirements.'}
                >
                  <PasswordInput
                    id="cm-pw"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    invalid={touched && passwordBad}
                    autoComplete="new-password"
                  />
                </Field>

                <Field
                  label="Confirm password"
                  htmlFor="cm-pw2"
                  required
                  error={touched && mismatch && 'The two passwords do not match.'}
                >
                  <PasswordInput
                    id="cm-pw2"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    invalid={touched && mismatch}
                    autoComplete="new-password"
                  />
                </Field>
              </>
            )}
          </div>
        </fieldset>

        <fieldset className="space-y-5 border-t border-slate-200 pt-6">
          <SectionLabel
            icon={<UserRound className="h-3.5 w-3.5" />}
            title="Administrator (registrar)"
            body="You, the person registering. These stay yours — you can still open a personal Rendi account with this email and phone."
          />

          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              className="sm:col-span-2"
              label="Full name"
              htmlFor="rg-name"
              required
              error={touched && registrarNameBad && 'Enter your full name.'}
            >
              <Input
                id="rg-name"
                value={registrarName}
                onChange={(e) => setRegistrarName(e.target.value)}
                invalid={touched && registrarNameBad}
                autoComplete="name"
                placeholder="Adaeze Okonkwo"
              />
            </Field>

            <Field
              label="Email"
              htmlFor="rg-email"
              required
              error={
                touched &&
                ((emailBad(registrarEmail) && 'Enter a valid email address.') ||
                  (sameAsOfficial &&
                    'Use a different address from the official one — that address becomes the community’s and cannot also be yours.'))
              }
            >
              <Input
                id="rg-email"
                type="email"
                value={registrarEmail}
                onChange={(e) => setRegistrarEmail(e.target.value)}
                invalid={touched && (emailBad(registrarEmail) || sameAsOfficial)}
                placeholder="you@example.com"
              />
            </Field>

            <Field
              label="Phone"
              htmlFor="rg-phone"
              required
              error={touched && phoneBad(registrarPhone) && 'Enter a valid phone number.'}
            >
              <Input
                id="rg-phone"
                type="tel"
                value={registrarPhone}
                onChange={(e) => setRegistrarPhone(e.target.value)}
                invalid={touched && phoneBad(registrarPhone)}
                placeholder="+234 809 999 9999"
              />
            </Field>
          </div>
        </fieldset>

        <Callout tone="info" title="What happens next">
          <span className="inline-flex items-start gap-1.5">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            {signedIn
              ? 'You will be asked for a few more details about the community, then Rendi reviews the registration. Collections, payouts and lending stay restricted until it passes.'
              : 'Confirm the code sent to the official email, then answer a few questions about the community. Rendi reviews it from there.'}
          </span>
        </Callout>

        <div className="flex justify-end border-t border-slate-200 pt-5">
          <Button type="submit" variant="blue" size="lg" loading={loading}>
            {signedIn ? 'Register community' : 'Create community account'}
          </Button>
        </div>
      </form>
    </>
  );
}

// ───────────────────────────── 2. Verify ─────────────────────────────

function VerifyStep({ identifier }: { identifier: string }) {
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
        setLoading(false);
        return;
      }

      // A full load, not router.push: the session cookies were set on a fetch
      // response, and the portal shell is a server component that has to read
      // them on a fresh request. The verification modal waits on the other
      // side — the registration is not finished until it is answered.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = '/dashboard';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That code did not work.');
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
        title="Confirm the official email"
        body={`We sent a six-digit code to ${identifier}. Enter it to activate the community account.`}
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

function SectionLabel({ icon, title, body }: { icon: ReactNode; title: string; body: string }) {
  return (
    <div>
      <legend className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wide text-navy-900">
        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-navy-50 text-navy-700">
          {icon}
        </span>
        {title}
      </legend>
      <p className="mt-1.5 text-[13px] leading-relaxed text-slate-500">{body}</p>
    </div>
  );
}

function Header({ icon, title, body }: { icon: ReactNode; title: string; body: string }) {
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
