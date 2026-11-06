'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { ArrowUpRight, HandCoins, Plus } from 'lucide-react';
import {
  Badge,
  Card,
  CardHeader,
  LinkButton,
  PageHeader,
  Stat,
} from '@/components/ui';
import { money } from '@/lib/format';
import { sumMoney } from '@/lib/money';
import type { Loan, LoanProduct } from '@/types';
import { LOAN_SECTIONS } from './sections';

/**
 * The entry point to lending.
 *
 * A hub rather than one long screen: reviewing an application, paying one
 * out, chasing repayment and chasing a guarantor are four different jobs,
 * and they were sharing a single table with a status column.
 */
export function LoansHubClient({
  loans,
  products,
}: {
  loans: Loan[];
  products: LoanProduct[];
}) {
  const counts = useMemo(() => {
    const byStatus = (statuses: string[]) => loans.filter((l) => statuses.includes(l.status));
    const running = byStatus(['DISBURSED', 'REPAYING', 'DEFAULTED']);
    return {
      '/loans/offers': products.length,
      '/loans/requested': byStatus(['SUBMITTED', 'UNDER_REVIEW']).length,
      '/loans/approved': byStatus(['APPROVED']).length,
      '/loans/disbursed': running.length,
      outstanding: sumMoney(running.map((l) => l.outstanding)),
      lent: sumMoney(byStatus(['DISBURSED', 'REPAYING', 'DEFAULTED', 'SETTLED']).map((l) => l.principal)),
    } as Record<string, number | string>;
  }, [loans, products]);

  return (
    <>
      <PageHeader
        title="Loans"
        subtitle="Applications from your members, and the terms you lend on"
        actions={
          <LinkButton href="/loans/new" icon={<Plus className="h-4 w-4" />}>
            New loan offer
          </LinkButton>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat
          label="Awaiting a decision"
          value={Number(counts['/loans/requested'] ?? 0)}
          icon={<HandCoins className="h-4 w-4" />}
          tone={Number(counts['/loans/requested'] ?? 0) ? 'warning' : 'default'}
        />
        <Stat label="Lent to date" value={money(String(counts.lent))} />
        <Stat label="Still outstanding" value={money(String(counts.outstanding))} />
      </div>

      <Card className="mt-6">
        <CardHeader title="The loan book" subtitle="Each stage, with what is waiting there" />
        <div className="grid gap-px bg-slate-200/70 sm:grid-cols-2 lg:grid-cols-3">
          {LOAN_SECTIONS.map((section) => {
            const count = Number(counts[section.href] ?? 0);
            return (
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
                    <span className="text-[14px] font-semibold text-navy-900">
                      {section.label}
                    </span>
                    {count > 0 && (
                      <Badge tone={section.statuses?.includes('SUBMITTED') ? 'amber' : 'navy'}>
                        {count > 99 ? '99+' : count}
                      </Badge>
                    )}
                    <ArrowUpRight className="h-3.5 w-3.5 text-slate-400 transition group-hover:text-brand-600" />
                  </span>
                  <span className="mt-0.5 block text-[12.5px] leading-5 text-slate-500">
                    {section.description}
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
      </Card>
    </>
  );
}
