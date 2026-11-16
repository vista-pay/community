'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, Users } from 'lucide-react';
import {
  Button,
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  PageHeader,
  Tabs,
} from '@/components/ui';
import { useMutation, useQuery } from '@/hooks/use-query';
import { useCommunityId } from '@/components/providers/session-provider';
import { useToast } from '@/components/providers/toast-provider';
import { portalApi } from '@/services/portal';
import type { MerchantBeneficiary, WalletData } from '@/types';
import { BeneficiaryRow, SendPayout } from './send-payout';

type Tab = 'send' | 'payees';

/**
 * Sending money out, and the address book it draws on.
 *
 * Settlement used to sit here as a third tab. It is a standing instruction
 * about money already collected rather than an errand, carries its own numbers
 * and its own owner approval, and was reached by link often enough to deserve
 * somewhere to be reached — so it has its own screen.
 */
export function PayoutsClient() {
  const communityId = useCommunityId();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get('tab');
  // ?tab=settlement used to land here. Settlement is its own screen now, so an
  // old link falls back to Send money rather than opening a tab that is gone.
  const [tab, setTab] = useState<Tab>(requestedTab === 'payees' ? 'payees' : 'send');

  const { data: payees, refresh: refreshPayees } = useQuery<MerchantBeneficiary[]>(
    () => portalApi.merchantBeneficiaries(communityId),
    [communityId],
  );
  const {
    data: wallet,
    error: walletError,
    loading: walletLoading,
    refresh: refreshWallet,
  } = useQuery<WalletData>(() => portalApi.wallet(communityId), [communityId]);

  const beneficiaries = payees ?? [];
  const ngnAccount =
    wallet?.wallet?.accounts.find((a) => a.currencyCode === 'NGN') ?? wallet?.wallet?.accounts[0];

  const toggleFavourite = useMutation(
    (payee: MerchantBeneficiary) =>
      portalApi.updateMerchantBeneficiary(communityId, payee.id, {
        isFavourite: !payee.isFavourite,
      }),
    {
      onSuccess: refreshPayees,
      onError: (message) => toast('Could not update that payee', 'error', message),
    },
  );
  const removePayee = useMutation(
    (payee: MerchantBeneficiary) => portalApi.removeMerchantBeneficiary(communityId, payee.id),
    {
      onSuccess: async () => {
        toast('Payee removed', 'success');
        await refreshPayees();
      },
      onError: (message) => toast('Could not remove that payee', 'error', message),
    },
  );

  return (
    <>
      <PageHeader
        title="Payouts & payees"
        subtitle="Send money out, and keep an address book of who you send it to"
        breadcrumb={
          <Link href="/merchant" className="inline-flex items-center gap-1.5 hover:text-navy-900">
            <ArrowLeft className="h-3.5 w-3.5" />
            Merchant account
          </Link>
        }
      />

      {!wallet && !walletLoading && (
        <ErrorState
          title="The merchant wallet could not be loaded"
          body={
            walletError ??
            'The server did not answer, so there is no balance to send from yet.'
          }
          onRetry={() => void refreshWallet()}
        />
      )}

      <Tabs
        className="mb-6"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'send', label: 'Send money' },
          { value: 'payees', label: 'Payees', count: beneficiaries.length },
        ]}
      />

      {tab === 'send' && (
        <SendPayout
          beneficiaries={beneficiaries}
          availableBalance={ngnAccount?.available ?? null}
          currencyCode={ngnAccount?.currencyCode ?? 'NGN'}
          onSent={async () => {
            await Promise.all([refreshWallet(), refreshPayees()]);
          }}
        />
      )}

      {tab === 'payees' && (
        <Card>
          <CardHeader
            title="Saved payees"
            subtitle="Favourites first, then whoever was paid most recently. Saved against the community, not the officer who added them."
          />
          {beneficiaries.length === 0 ? (
            <EmptyState
              icon={<Users className="h-5 w-5" />}
              title="No saved payees"
              body="Tick “save this payee” when you send a payment, and they appear here for next time."
              action={<Button onClick={() => setTab('send')}>Send a payment</Button>}
            />
          ) : (
            <div className="divide-y divide-slate-100">
              {beneficiaries.map((payee) => (
                <BeneficiaryRow
                  key={payee.id}
                  payee={payee}
                  busy={toggleFavourite.pending || removePayee.pending}
                  onToggleFavourite={() => void toggleFavourite.run(payee)}
                  onRemove={() => void removePayee.run(payee)}
                />
              ))}
            </div>
          )}
        </Card>
      )}

    </>
  );
}
