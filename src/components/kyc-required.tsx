import { ShieldCheck } from 'lucide-react';
import { Card, EmptyState, PageHeader } from '@/components/ui';

/**
 * Full-page stand-in for a portal page the API has locked behind identity
 * verification. Verification itself lives in the Rendi app, not the portal,
 * so all this page can do is say where to go.
 */
export function KycRequiredPage({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <>
      <PageHeader title={title} subtitle={subtitle} />
      <Card>
        <EmptyState
          icon={<ShieldCheck className="h-5 w-5" />}
          title="Verify your identity first"
          body="Ajo moves real money, so it stays locked until your identity is verified. Complete identity verification in the Rendi app, then reload this page."
        />
      </Card>
    </>
  );
}
