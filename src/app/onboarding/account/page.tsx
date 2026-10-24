import type { Metadata } from 'next';
import Link from 'next/link';
import { Logo } from '@/components/layout/Logo';
import { getAccessToken } from '@/lib/session';
import { OnboardingFlow } from './onboarding-flow';

export const metadata: Metadata = { title: 'Register a community' };

/**
 * Registering a community needs a Vista account, because `POST /communities`
 * is authenticated. Rather than bouncing a new visitor to sign-in — which is
 * a dead end when they have no account — the flow creates the account first
 * and only skips that part for someone already signed in.
 */
export default async function CommunityRegistrationPage() {
  const signedIn = Boolean(await getAccessToken());

  return (
    <main className="min-h-dvh bg-[#F5F7FB] px-4 py-8 sm:py-12">
      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>

        <OnboardingFlow signedIn={signedIn} />

        {!signedIn && (
          <p className="mt-6 text-center text-sm text-slate-600">
            Already have a Vista account?{' '}
            <Link href="/signin" className="font-medium text-navy-700 hover:underline">
              Sign in
            </Link>
          </p>
        )}
      </div>
    </main>
  );
}
