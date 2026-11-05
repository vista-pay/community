import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Page not found',
  description: 'The requested Rendi Community page could not be found.',
};

export default function NotFound() {
  return (
    <main className="relative flex min-h-dvh overflow-hidden bg-[#F5F7FB] px-5 py-6 sm:px-8">
      <div aria-hidden className="absolute -left-32 -top-32 h-80 w-80 rounded-full bg-brand-100/70 blur-3xl" />
      <div aria-hidden className="absolute -bottom-40 -right-28 h-96 w-96 rounded-full bg-gold-100/80 blur-3xl" />

      <div className="relative mx-auto flex w-full max-w-6xl flex-col">
        <header className="flex items-center justify-between">
          <Link href="/dashboard" className="focus-ring flex items-center gap-3 rounded-xl">
            <img src="/rendi-logo.svg" alt="" className="h-10 w-10 rounded-xl bg-white shadow-sm" />
            <div>
              <p className="text-[15px] font-extrabold tracking-tight text-navy-900">RENDI</p>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-brand-700">Community</p>
            </div>
          </Link>
          <span className="rounded-full border border-navy-100 bg-white/80 px-3 py-1.5 text-xs font-semibold text-navy-600 shadow-sm backdrop-blur">
            Error 404
          </span>
        </header>

        <section className="grid flex-1 items-center gap-10 py-14 lg:grid-cols-[1.05fr_.95fr] lg:py-20">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-700">Page not found</p>
            <h1 className="mt-4 text-4xl font-bold leading-[1.08] tracking-[-0.04em] text-navy-900 sm:text-5xl lg:text-6xl">
              This page isn&rsquo;t in your community space.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-slate-600 sm:text-lg">
              The link may be old, incomplete, or the page may have moved. Your community data is safe—choose a familiar place to continue.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/dashboard" className="focus-ring inline-flex h-12 items-center justify-center rounded-xl bg-navy-900 px-6 text-sm font-semibold text-white shadow-pop transition hover:bg-navy-800">
                Return to dashboard <span aria-hidden className="ml-2">→</span>
              </Link>
              <Link href="/members" className="focus-ring inline-flex h-12 items-center justify-center rounded-xl border border-navy-100 bg-white px-6 text-sm font-semibold text-navy-800 shadow-card transition hover:border-navy-200 hover:bg-navy-50">
                View members
              </Link>
            </div>
          </div>

          <div aria-hidden className="relative mx-auto flex aspect-square w-full max-w-[420px] items-center justify-center">
            <div className="absolute inset-7 rounded-full border border-dashed border-brand-300" />
            <div className="absolute inset-16 rounded-full border border-navy-100 bg-white/70 shadow-pop backdrop-blur" />
            <span className="relative text-[112px] font-extrabold leading-none tracking-[-0.08em] text-navy-900 sm:text-[144px]">404</span>
            <span className="absolute left-8 top-20 h-5 w-5 rounded-full bg-gold-400 shadow-lg" />
            <span className="absolute bottom-16 right-10 h-8 w-8 rounded-full bg-brand-500 shadow-lg" />
            <span className="absolute right-4 top-1/3 h-3 w-3 rounded-full bg-navy-400" />
          </div>
        </section>

        <footer className="border-t border-navy-100/80 py-5 text-xs text-slate-500">
          Rendi Community Portal · Securely managing members, money and governance.
        </footer>
      </div>
    </main>
  );
}
