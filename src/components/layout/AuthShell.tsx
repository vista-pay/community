/**
 * Split-panel chrome for sign-in and community registration — the same
 * visual system as the Rendi admin and business consoles' auth screens.
 */
export function AuthShell({
  headline,
  subhead,
  children,
}: {
  headline: string;
  subhead: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh bg-white">
      <section className="relative hidden w-[43%] min-w-[480px] flex-col overflow-hidden bg-[#101828] px-16 py-16 text-white lg:flex">
        <div className="relative z-10 flex items-center gap-3">
          <img src="/rendi-logo.svg" alt="Rendi" className="h-10 w-10 rounded-[11px] bg-white" />
          <span className="text-[21px] font-extrabold tracking-tight">RENDI</span>
          <span className="rounded-md bg-[#2563EB] px-1.5 py-0.5 text-[10px] font-bold">COMMUNITY</span>
        </div>
        <div className="relative z-10 my-auto max-w-[460px]">
          <h1 className="text-[28px] font-semibold leading-[1.32] tracking-[-0.02em] text-[#F8FAFC]">{headline}</h1>
          <p className="mt-5 text-[16px] leading-[1.75] text-[#94A3B8]">{subhead}</p>
        </div>
        <div className="relative z-10 flex max-w-[462px] items-start gap-3.5 rounded-xl bg-white/[0.08] px-5 py-4 text-[13px] leading-[1.4] text-white/80">
          <svg className="mt-0.5 h-5 w-5 shrink-0 text-[#3B82F6]" viewBox="0 0 20 20" fill="none"><path d="M10 2.2 4 4.6v4.2c0 4 2.6 6.9 6 8.4 3.4-1.5 6-4.4 6-8.4V4.6L10 2.2Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/><path d="m7.4 9.8 1.8 1.8 3.4-3.6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          <p>Bank-grade security for your community&rsquo;s money. All activity is monitored and logged.</p>
        </div>
        <div
          aria-hidden
          className="pointer-events-none absolute rounded-full"
          style={{ right: -260, bottom: -110, width: 520, height: 520, border: "70px solid #111F3D" }}
        />
      </section>
      <section className="flex flex-1 items-center justify-center overflow-y-auto bg-[#F8FAFC] px-4 py-10 sm:px-8">
        {children}
      </section>
    </div>
  );
}
