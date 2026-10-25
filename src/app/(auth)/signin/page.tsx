import { Suspense } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthShell } from '@/components/layout/AuthShell';
import { SignInForm } from './sign-in-form';

export const metadata: Metadata = { title: 'Sign in' };

export default function SignInPage() {
  return (
    <AuthShell
      headline="Run your community's money and membership from one secure place."
      subhead="Dues, savings, services, meetings and members — with officer approvals and a complete audit trail."
    >
      <div className="w-full max-w-md">
        <div className="rounded-[20px] bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,.10)] sm:p-8">
          <h1 className="text-xl font-semibold text-navy-900">Sign in</h1>
          <p className="mt-1 text-sm text-slate-500">
            Use the Rendi account you registered your community with.
          </p>
          <Suspense fallback={<div className="mt-5 h-64 animate-pulse rounded-lg bg-slate-100" />}>
            <SignInForm />
          </Suspense>
        </div>

        <p className="mt-6 text-center text-sm text-slate-600">
          New to Rendi?{' '}
          <Link href="/onboarding/account" className="font-medium text-navy-700 hover:underline">
            Register a community
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
