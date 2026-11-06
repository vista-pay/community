'use client';

import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { Badge, Card, CardHeader, PageHeader } from '@/components/ui';
import type { DashboardData } from '@/types';
import { MEMBER_SECTIONS } from './sections';

/**
 * The entry point to membership.
 *
 * A hub rather than the member list: adding people, reviewing who is waiting
 * and browsing everyone are three different jobs, and the list had quietly
 * become the only one with a home.
 */
export function MembersHubClient({
  counts,
}: {
  counts: DashboardData['navigationCounts'] | null;
}) {
  return (
    <>
      <PageHeader
        title="Members"
        subtitle="Who belongs to this community, who is waiting, and how to add more"
      />

      <Card>
        <CardHeader title="What would you like to do?" />
        <div className="grid gap-px bg-slate-200/70 sm:grid-cols-2 lg:grid-cols-3">
          {MEMBER_SECTIONS.map((section) => {
            const count = section.countKey ? (counts?.[section.countKey] ?? 0) : 0;
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
                    {count > 0 && <Badge tone="amber">{count > 99 ? '99+' : count}</Badge>}
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
