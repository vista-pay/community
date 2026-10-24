import { Suspense } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Logo } from '@/components/layout/Logo';
import { SignInForm } from './sign-in-form';

export const metadata: Metadata = { title: 'Sign in' };

export default function SignInPage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-[#F5F7FB] px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card sm:p-8">
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
    </div>
  );
}
