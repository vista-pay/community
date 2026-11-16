'use client';

import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Building2, Check, CreditCard, MailCheck, ShieldCheck, UserRound } from 'lucide-react';
import { Button, Callout, Field, Input, PasswordInput, Segmented } from '@/components/ui';
import { post } from '@/lib/api';
import { cn } from '@/lib/format';

type Step = 'community' | 'registrar' | 'plan' | 'verify';

const COUNTRIES = [
  { value: 'NGA', label: 'Nigeria' },
  { value: 'GHA', label: 'Ghana' },
  { value: 'KEN', label: 'Kenya' },
];

/** Registration is live in Nigeria; the others are on the roadmap. */
const COMING_SOON: Record<string, string> = {
  GHA: 'Ghana',
  KEN: 'Kenya',
};

/** What the registration plan chooser needs — a slice of the public plan list. */
type OnboardingPlan = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  monthlyPrice: string;
  currencyCode: string;
  trialDays: number;
  maxMembers: number | null;
  maxAjoGroups: number | null;
  isNegotiated: boolean;
};

const planPrice = (plan: OnboardingPlan) =>
  Number(plan.monthlyPrice) === 0
    ? 'Free'
    : `₦${Number(plan.monthlyPrice).toLocaleString()}/month`;

const emailBad = (v: string) => !/^\S+@\S+\.\S+$/.test(v.trim());
const phoneBad = (v: string) => v.trim().replace(/\D/g, '').length < 10;

/**
 * Community registration, one decision per screen.
 *
 *   1. The community itself          (name, contacts, country, password)
 *   2. The administrator (registrar)
 *   3. The plan                      POST /community-onboarding/register
 *   4. Confirm the official email    POST /auth/verify-otp (session starts)
 *
 * Nothing is sent until step 3's Continue — the earlier steps only validate —
 * so Back never loses anything and abandoning the form costs nothing.
 *
 * The account created is the *organisation's*, not a person's: it signs in
 * with the community's official email, and that address — with the official
 * phone — is reserved platform-wide. The administrator's own email and phone
 * are recorded as a contact and claim nothing.
 *
 * Someone already signed in walks the same three steps but posts to the
 * authenticated `POST /communities` and skips the verify step: they have an
 * account, they just do not have a community.
 */
export function OnboardingFlow({ signedIn }: { signedIn: boolean }) {
  const [step, setStep] = useState<Step>('community');
  const [touched, setTouched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Step 1 · the community ──
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [country, setCountry] = useState('NGA');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');

  // ── Step 2 · the administrator ──
  const [registrarName, setRegistrarName] = useState('');
  const [registrarEmail, setRegistrarEmail] = useState('');
  const [registrarPhone, setRegistrarPhone] = useState('');

  // ── Step 3 · the plan ──
  // Defaults to the base plan, and a failed load simply hides the cards — the
  // API enrols on the base plan when no choice is sent, so registration never
  // blocks on the price list.
  const [plans, setPlans] = useState<OnboardingPlan[]>([]);
  const [planId, setPlanId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/community-onboarding/plans')
      .then((res) => (res.ok ? res.json() : []))
      .then((list: OnboardingPlan[]) => {
        if (cancelled || !Array.isArray(list)) return;
        setPlans(list);
        const base = list.filter((plan) => !plan.isNegotiated)[0];
        if (base) setPlanId((current) => current ?? base.id);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Validation, per step ──
  const nameBad = name.trim().length < 3;
  // Mirrors the API's own rule, so a weak password is caught here rather than
  // coming back as a validation error after the round trip.
  const passwordBad =
    password.length < 8 ||
    !/[a-z]/.test(password) ||
    !/[A-Z]/.test(password) ||
    !/[\d\W]/.test(password);
  const mismatch = confirm !== password;
  const comingSoon = COMING_SOON[country];

  const communityValid =
    !nameBad &&
    !emailBad(email) &&
    !phoneBad(phone) &&
    !comingSoon &&
    (signedIn || (!passwordBad && !mismatch));

  const registrarNameBad = registrarName.trim().length < 3;
  // The same address on both halves is the one mistake this flow has to catch
  // before the API does, because the consequence is permanent: the official
  // address is reserved, and the person who used their own would never be
  // able to open a personal account on it.
  const sameAsOfficial =
    !emailBad(email) && email.trim().toLowerCase() === registrarEmail.trim().toLowerCase();
  const registrarValid =
    !registrarNameBad && !emailBad(registrarEmail) && !phoneBad(registrarPhone) && !sameAsOfficial;

  const steps: Array<{ key: Step; label: string }> = [
    { key: 'community', label: 'Your community' },
    { key: 'registrar', label: 'Administrator' },
    { key: 'plan', label: 'Choose a plan' },
    ...(signedIn ? [] : [{ key: 'verify' as Step, label: 'Confirm email' }]),
  ];

  function advance(to: Step, valid: boolean) {
    setTouched(true);
    if (!valid) return;
    setTouched(false);
    setError(null);
    setStep(to);
  }

  async function submit() {
    setTouched(true);
    if (loading) return;

    const payload = {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim(),
      country,
      registrarName: registrarName.trim(),
      registrarEmail: registrarEmail.trim().toLowerCase(),
      registrarPhone: registrarPhone.trim(),
      ...(planId ? { planId } : {}),
    };

    setLoading(true);
    setError(null);
    try {
      if (signedIn) {
        // Already has an account, so the authenticated endpoint applies and
        // there is no email to verify — straight into the portal, where the
        // verification modal takes over. A full load, not router.push: the
        // community cookie is set on a fetch response and the portal shell is
        // a server component that has to read it on a fresh request.
        await post('/communities', payload);
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
      setTouched(false);
      setStep('verify');
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not register this community.');
      setLoading(false);
    }
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card">
      <Steps steps={steps} current={step} />

      {step === 'community' && (
        <StepFrame
          icon={<Building2 className="h-5 w-5" />}
          title="Register your community"
          body="These details belong to the organisation — the official email is what you will sign in with."
          onNext={() => advance('registrar', communityValid)}
          error={error}
        >
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
              <Segmented label="Country" value={country} onChange={setCountry} options={COUNTRIES} />
            </Field>

            {comingSoon && (
              <div className="sm:col-span-2">
                <Callout tone="warning" title={`Coming soon to ${comingSoon}`}>
                  Rendi Communities is not live in {comingSoon} yet — registration is currently
                  open to communities in Nigeria. Leave your community&rsquo;s details at{' '}
                  <a className="font-medium underline" href="mailto:hello@rendi.app">
                    hello@rendi.app
                  </a>{' '}
                  and we will write the moment it opens.
                </Callout>
              </div>
            )}

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
        </StepFrame>
      )}

      {step === 'registrar' && (
        <StepFrame
          icon={<UserRound className="h-5 w-5" />}
          title="Administrator (registrar)"
          body="You, the person registering. These stay yours — you can still open a personal Rendi account with this email and phone."
          onBack={() => setStep('community')}
          onNext={() => advance('plan', registrarValid)}
          error={error}
        >
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
                autoFocus
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
        </StepFrame>
      )}

      {step === 'plan' && (
        <StepFrame
          icon={<CreditCard className="h-5 w-5" />}
          title="Choose a plan"
          body="Every community is on a plan. Start free and upgrade any time from the Billing page."
          onBack={() => setStep('registrar')}
          onNext={() => void submit()}
          nextLabel={signedIn ? 'Register community' : 'Create community account'}
          nextLoading={loading}
          error={error}
        >
          {plans.length === 0 ? (
            <p className="text-sm text-slate-500">
              The price list did not load — no matter: you start on the base plan and can change it
              any time from the Billing page.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {plans.map((plan) =>
                plan.isNegotiated ? (
                  <div
                    key={plan.id}
                    className="rounded-2xl border border-dashed border-slate-200 p-4 text-left"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-navy-900">{plan.name}</p>
                      <span className="text-xs font-semibold text-slate-500">Custom</span>
                    </div>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      Priced for your cooperative and agreed with Rendi — ask about it from the
                      Billing page once you are set up.
                    </p>
                  </div>
                ) : (
                  <button
                    key={plan.id}
                    type="button"
                    onClick={() => setPlanId(plan.id)}
                    className={cn(
                      'rounded-2xl border p-4 text-left transition',
                      planId === plan.id
                        ? 'border-blue-600 bg-blue-50/50 ring-1 ring-blue-600'
                        : 'border-slate-200 hover:border-slate-300',
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-navy-900">{plan.name}</p>
                      <span
                        className={cn(
                          'text-xs font-semibold',
                          planId === plan.id ? 'text-blue-700' : 'text-slate-500',
                        )}
                      >
                        {planPrice(plan)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      {plan.maxMembers ? `Up to ${plan.maxMembers} members` : 'Unlimited members'}
                      {' · '}
                      {plan.maxAjoGroups
                        ? `${plan.maxAjoGroups} Ajo group${plan.maxAjoGroups === 1 ? '' : 's'}`
                        : 'Unlimited Ajo groups'}
                      {plan.trialDays > 0 ? ` · ${plan.trialDays}-day free trial` : ''}
                    </p>
                  </button>
                ),
              )}
            </div>
          )}

          <Callout tone="info" title="What happens next">
            <span className="inline-flex items-start gap-1.5">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              {signedIn
                ? 'You will be asked for a few more details about the community, then Rendi reviews the registration. Collections, payouts and lending stay restricted until it passes.'
                : 'Confirm the code sent to the official email, then answer a few questions about the community. Rendi reviews it from there.'}
            </span>
          </Callout>
        </StepFrame>
      )}

      {step === 'verify' && <VerifyStep identifier={email.trim().toLowerCase()} />}
    </section>
  );
}

function Steps({ steps, current }: { steps: Array<{ key: Step; label: string }>; current: Step }) {
  const index = steps.findIndex((s) => s.key === current);

  return (
    <ol className="flex items-center gap-2 border-b border-slate-200 bg-slate-50/60 px-6 py-3">
      {steps.map((s, i) => {
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
            {i < steps.length - 1 && <span className="h-px flex-1 bg-slate-200" aria-hidden />}
          </li>
        );
      })}
    </ol>
  );
}

/**
 * One screen of the wizard: heading, the fields, and a Back / Continue rail.
 * A form so Enter advances, exactly as it would submit a single-page form.
 */
function StepFrame({
  icon,
  title,
  body,
  children,
  onBack,
  onNext,
  nextLabel = 'Continue',
  nextLoading = false,
  error,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  children: ReactNode;
  onBack?: () => void;
  onNext: () => void;
  nextLabel?: string;
  nextLoading?: boolean;
  error: string | null;
}) {
  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    onNext();
  }

  return (
    <>
      <div className="border-b border-slate-200 px-6 py-6 sm:px-8">
        <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-navy-50 text-navy-700">
          {icon}
        </span>
        <h1 className="text-2xl font-semibold text-navy-900">{title}</h1>
        <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{body}</p>
      </div>

      <form className="space-y-6 px-6 py-6 sm:px-8" onSubmit={handleSubmit} noValidate>
        {error && <Callout tone="danger">{error}</Callout>}

        {children}

        <div className="flex items-center justify-between border-t border-slate-200 pt-5">
          {onBack ? (
            <Button variant="ghost" onClick={onBack} disabled={nextLoading}>
              Back
            </Button>
          ) : (
            <span />
          )}
          <Button type="submit" variant="blue" size="lg" loading={nextLoading}>
            {nextLabel}
          </Button>
        </div>
      </form>
    </>
  );
}

// ───────────────────────── 4. Confirm the official email ─────────────────────────

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
      <div className="border-b border-slate-200 px-6 py-6 sm:px-8">
        <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-navy-50 text-navy-700">
          <MailCheck className="h-5 w-5" />
        </span>
        <h1 className="text-2xl font-semibold text-navy-900">Confirm the official email</h1>
        <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
          We sent a six-digit code to {identifier}. Enter it to activate the community account.
        </p>
      </div>

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
