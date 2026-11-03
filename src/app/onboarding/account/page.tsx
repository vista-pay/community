import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthShell } from '@/components/layout/AuthShell';
import { getAccessToken } from '@/lib/session';
import { OnboardingFlow } from './onboarding-flow';

export const metadata: Metadata = { title: 'Register a community' };

/**
 * Registering a community needs a Rendi account, because `POST /communities`
 * is authenticated. Rather than bouncing a new visitor to sign-in — which is
 * a dead end when they have no account — the flow creates the account first
 * and only skips that part for someone already signed in.
 */
export default async function CommunityRegistrationPage() {
  const signedIn = Boolean(await getAccessToken());

  return (
    <AuthShell
      headline="Bring your cooperative, association or thrift group onto Rendi."
      subhead="Create your account, verify it, and register the community — contributions, services and records follow."
    >
      <div className="w-full max-w-2xl">
        <OnboardingFlow signedIn={signedIn} />

        {!signedIn && (
          <p className="mt-6 text-center text-sm text-slate-600">
            Already have a Rendi account?{' '}
            <Link href="/signin" className="font-medium text-navy-700 hover:underline">
              Sign in
            </Link>
          </p>
        )}
      </div>
    </AuthShell>
  );
}
