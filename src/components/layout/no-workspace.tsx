import Link from 'next/link';
import { Building2 } from 'lucide-react';
import { Logo } from './Logo';

/**
 * Shown when the signed-in account administers no community. The portal is
 * an officer tool, so there is nothing useful to render — saying that once is
 * kinder than a dashboard where every panel fails.
 */
export function NoWorkspace({ email }: { email: string }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-[#F5F7FB] px-4">
      <div className="w-full max-w-md text-center">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-card">
          <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-navy-50 text-navy-600">
            <Building2 className="h-6 w-6" />
          </span>
          <h1 className="text-lg font-semibold text-navy-900">No community to manage</h1>
          <p className="mt-2 text-sm text-slate-500">
            {email} is signed in, but is not an officer of any community. Ask the community owner
            to add you as staff, or register your own.
          </p>
          <div className="mt-6 flex flex-col gap-2">
            <Link
              href="/onboarding/account"
              className="inline-flex h-10 items-center justify-center rounded-lg bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700"
            >
              Register a community
            </Link>
            <form action="/api/auth/logout" method="post">
              <button
                type="submit"
                className="inline-flex h-10 w-full items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-navy-800 hover:bg-slate-50"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
