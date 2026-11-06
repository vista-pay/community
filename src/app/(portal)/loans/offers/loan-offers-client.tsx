'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { Package, Plus } from 'lucide-react';
import {
  Badge,
  Card,
  CardHeader,
  EmptyState,
  KV,
  LinkButton,
  PageHeader,
  StatusBadge,
} from '@/components/ui';
import { useQuery } from '@/hooks/use-query';
import { useCommunityId } from '@/components/providers/session-provider';
import { portalApi } from '@/services/portal';
import { money } from '@/lib/format';
import type { LoanProduct } from '@/types';

/** Stable empty result: `?? []` inline re-renders the grid on every poll. */
const NONE: never[] = [];

/**
 * The offers a community lends on.
 *
 * An offer exists so an application is judged against written terms rather
 * than whatever rate the officer of the day thinks is fair — which is also
 * why terms freeze once loans are running on one.
 */
export function LoanOffersClient({ initial }: { initial: LoanProduct[] }) {
  const communityId = useCommunityId();
  const { data } = useQuery<LoanProduct[]>(
    () => portalApi.loanProducts(communityId),
    [communityId],
    { initial },
  );
  const products = data ?? NONE;

  return (
    <>
      <PageHeader
        title="Loan offers"
        subtitle="Rate, amounts, tenors and who has to approve"
        breadcrumb={
          <Link href={'/loans' as Route} className="hover:text-navy-700">
            Loans
          </Link>
        }
        actions={
          <LinkButton href={'/loans/new' as Route} icon={<Plus className="h-4 w-4" />}>
            New offer
          </LinkButton>
        }
      />

      <div className="grid gap-4 md:grid-cols-2">
        {products.length === 0 ? (
          <Card className="md:col-span-2">
            <EmptyState
              icon={<Package className="h-5 w-5" />}
              title="No loan offers yet"
              body="An offer fixes the rate, the tenors and who has to approve, so applications are judged against written terms."
              action={<LinkButton href={'/loans/new' as Route}>Create an offer</LinkButton>}
            />
          </Card>
        ) : (
          products.map((p) => (
            <Card key={p.id}>
              <CardHeader
                title={p.name}
                subtitle={p.description ?? undefined}
                action={<StatusBadge status={p.status.toLowerCase()} />}
              />
              <dl className="grid grid-cols-2 gap-4 px-5 py-4 sm:grid-cols-4">
                <KV label="Rate">{p.rateLabel}</KV>
                <KV label="Amount">
                  {money(p.minPrincipal, p.currencyCode, { decimals: false })} –{' '}
                  {money(p.maxPrincipal, p.currencyCode, { decimals: false })}
                </KV>
                <KV label="Tenors">{p.tenorMonths.join(', ')} months</KV>
                <KV label="Loans">{p.loanCount}</KV>
              </dl>
              {p.eligibility.length > 0 && (
                <ul className="flex flex-wrap gap-1.5 px-5 pb-4">
                  {p.eligibility.map((e) => (
                    <li key={e}>
                      <Badge tone="slate">{e}</Badge>
                    </li>
                  ))}
                </ul>
              )}
              <div className="border-t border-slate-100 px-5 py-3">
                <LinkButton size="sm" variant="secondary" href={`/loans/quote/${p.id}` as Route}>
                  Quote a loan
                </LinkButton>
              </div>
            </Card>
          ))
        )}
      </div>
    </>
  );
}
