'use client';

import { HeartHandshake, Sparkles } from 'lucide-react';
import {
  Badge,
  Card,
  CardHeader,
  DataTable,
  EmptyState,
  PageHeader,
  StatusBadge,
} from '@/components/ui';
import { useQuery } from '@/hooks/use-query';
import { useCommunityId } from '@/components/providers/session-provider';
import { portalApi } from '@/services/portal';
import { date } from '@/lib/format';
import type { ServiceCatalogItem, ServiceRequest } from '@/types';

export function ServicesClient({
  requests: initialRequests,
  catalog,
}: {
  requests: ServiceRequest[];
  catalog: ServiceCatalogItem[];
}) {
  const communityId = useCommunityId();
  const requests = useQuery(() => portalApi.serviceRequests(communityId), [communityId], {
    initial: initialRequests,
  });

  return (
    <>
      <PageHeader
        title="Services"
        subtitle="Welfare and support members can request from the Rendi app"
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Requests"
            subtitle="Decisions are made by a Rendi administrator where a fee is charged"
          />
          <DataTable
            rows={requests.data ?? []}
            rowKey={(r) => r.id}
            loading={requests.loading}
            columns={[
              { key: 'service', header: 'Service', cell: (r) => r.service.name },
              {
                key: 'code',
                header: 'Code',
                hideOnMobile: true,
                cell: (r) => <span className="font-mono text-xs text-slate-500">{r.service.code}</span>,
              },
              { key: 'status', header: 'Status', cell: (r) => <StatusBadge status={r.status.toLowerCase()} /> },
              {
                key: 'created',
                header: 'Requested',
                align: 'right',
                cell: (r) => <span className="text-slate-500">{date(r.createdAt)}</span>,
              },
            ]}
            empty={
              <EmptyState
                icon={<HeartHandshake className="h-5 w-5" />}
                title="No service requests"
                body="Members request welfare and support from the community page in the app."
              />
            }
          />
        </Card>

        <Card className="h-fit">
          <CardHeader title="What members can request" subtitle="The Rendi services catalogue" />
          {catalog.length === 0 ? (
            <EmptyState compact title="Catalogue unavailable" body="No services are published yet." />
          ) : (
            <ul className="divide-y divide-slate-100">
              {catalog.map((s) => (
                <li key={s.id} className="px-5 py-3">
                  <div className="flex items-start gap-2">
                    <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-navy-900">{s.name}</p>
                      {s.description && (
                        <p className="mt-0.5 text-xs text-slate-500">{s.description}</p>
                      )}
                      {s.requiresApproval && (
                        <Badge tone="amber" className="mt-1.5">
                          Approval required
                        </Badge>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
