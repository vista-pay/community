'use client';

import Link from 'next/link';
import { ArrowUpRight, Landmark, Scale, TrendingUp } from 'lucide-react';
import { Badge, Card, CardHeader, PageHeader, Stat } from '@/components/ui';
import { money } from '@/lib/format';
import type { Statements } from '@/types';
import { ACCOUNTING_SECTIONS } from './sections';

/**
 * The entry point to the books.
 *
 * A hub rather than the old single dashboard: each area — the chart, the
 * journals, the trial balance — is a job of its own, and stacking them on one
 * page meant none of them had room. The headline figures stay here because
 * "do the books balance" is the question worth answering before an officer
 * picks where to go.
 */
export function AccountingHubClient({ initial }: { initial: Statements }) {
  const sheet = initial.balanceSheet;
  const tb = initial.trialBalance;
  const assets = Number(sheet.assets);
  const liabilities = Number(sheet.liabilities);

  return (
    <>
      <PageHeader
        title="Accounting"
        subtitle="The community's own books. Separate from Rendi's wallet ledger."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Total assets"
          value={money(sheet.assets, 'NGN')}
          icon={<Landmark className="h-4 w-4" />}
          tone={assets < 0 ? 'danger' : 'default'}
          // A negative asset balance is not a rounding artefact — it means
          // money left the books that never entered them.
          hint={assets < 0 ? 'Negative — deposits are missing from the books' : undefined}
        />
        <Stat
          label="Owed to members"
          value={money(sheet.liabilities, 'NGN')}
          icon={<Scale className="h-4 w-4" />}
          tone={liabilities < 0 ? 'danger' : 'default'}
          hint={liabilities < 0 ? 'Negative — more paid out than recorded in' : undefined}
        />
        <Stat
          label="Surplus this period"
          value={money(sheet.surplus, 'NGN')}
          icon={<TrendingUp className="h-4 w-4" />}
          tone={Number(sheet.surplus) < 0 ? 'warning' : 'positive'}
        />
        <Stat
          label="Trial balance"
          value={tb.balanced ? 'Balanced' : 'Out'}
          tone={tb.balanced ? 'positive' : 'danger'}
          // The totals are movement, not value, and saying so here stops the
          // figure reading as "the community has ₦22,200".
          hint={`${money(tb.debit, 'NGN')} of movement each side`}
          footer={
            <Link href="/trial-balance" className="font-semibold text-brand-700">
              View full schedule
            </Link>
          }
        />
      </div>

      {/* A balanced trial balance only proves the entries are internally
          consistent. It says nothing about whether everything that happened
          was recorded, which is a different and more common failure. */}
      {tb.balanced && assets < 0 && (
        <Card className="mb-6 border-amber-300 bg-amber-50">
          <div className="px-5 py-4">
            <p className="text-[13px] font-semibold text-amber-900">
              The books balance but look incomplete
            </p>
            <p className="mt-1 text-[13px] leading-5 text-amber-800">
              Debits equal credits, so every entry is internally consistent — but a negative asset
              position means movements reached the wallet without reaching the books. Check the
              journals for the period.
            </p>
          </div>
        </Card>
      )}

      <Card>
        <CardHeader title="Sections" subtitle="Each part of the books, in its own place" />
        <div className="grid gap-px bg-slate-200/70 sm:grid-cols-2 lg:grid-cols-3">
          {ACCOUNTING_SECTIONS.map((section) => (
            <Link
              key={section.href}
              href={section.href}
              className="group flex items-start gap-3 bg-white p-5 transition hover:bg-slate-50 focus-ring"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-navy-50 text-navy-700 transition group-hover:bg-brand-50 group-hover:text-brand-700">
                <section.icon className="h-[18px] w-[18px]" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span className="text-[14px] font-semibold text-navy-900">{section.label}</span>
                  <ArrowUpRight className="h-3.5 w-3.5 text-slate-400 transition group-hover:text-brand-600" />
                </span>
                <span className="mt-0.5 block text-[12.5px] leading-5 text-slate-500">
                  {section.description}
                </span>
              </span>
            </Link>
          ))}
        </div>
      </Card>

      <p className="mt-4 text-center text-[12px] text-slate-500">
        Automatic postings carry their source — contributions, savings, Ajo, welfare, fines — so
        every figure here traces back to the movement that produced it.{' '}
        <Badge tone="slate">{initial.rows.length} accounts</Badge>
      </p>
    </>
  );
}
