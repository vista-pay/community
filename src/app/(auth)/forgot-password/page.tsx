import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthShell } from '@/components/layout/AuthShell';
import { ResetForm } from './reset-form';

export const metadata: Metadata = { title: 'Reset password' };

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      headline="Run your community's money and membership from one secure place."
      subhead="Dues, savings, services, meetings and members — with officer approvals and a complete audit trail."
    >
      <div className="w-full max-w-md">
        <div className="rounded-[20px] bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,.10)] sm:p-8">
          <h1 className="text-xl font-semibold text-navy-900">Reset your password</h1>
          <p className="mt-1 text-sm text-slate-500">
            We&apos;ll email a one-time code to confirm it&apos;s you before anything changes.
          </p>
          <ResetForm />
        </div>

        <p className="mt-6 text-center text-sm text-slate-600">
          Remembered it?{' '}
          <Link href="/signin" className="font-medium text-navy-700 hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
