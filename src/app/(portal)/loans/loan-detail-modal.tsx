'use client';

import {
  Badge,
  Button,
  Callout,
  Modal,
  StatusBadge,
} from '@/components/ui';
import { Send, ShieldCheck } from 'lucide-react';
import { useMutation, useQuery } from '@/hooks/use-query';
import { useToast } from '@/components/providers/toast-provider';
import { portalApi } from '@/services/portal';
import { date, humanise, money } from '@/lib/format';
import type { Loan, LoanApplicationDetail } from '@/types';

/** The application as the committee should read it: the person, the ask,
 * who stands behind it. */
export function LoanDetailModal({
  loan,
  onClose,
  onDecide,
  onDisburse,
}: {
  loan: Loan;
  onClose: () => void;
  onDecide: (approve: boolean) => void;
  onDisburse: () => void;
}) {
  const { data, error, refresh } = useQuery<LoanApplicationDetail>(
    () => portalApi.loanDetail(loan.id),
    [loan.id],
  );
  const d = data;
  const { toast } = useToast();

  // Recording the answer an external guarantor gave off-platform (a call, a
  // signed form). Platform guarantors normally answer in their own app, but
  // the officer path also unblocks one who cannot.
  const guarantorReview = useMutation(
    (guarantorId: string, confirm: boolean) => portalApi.reviewGuarantor(loan.id, guarantorId, confirm),
    {
      onSuccess: async () => {
        toast('Guarantor answer recorded', 'success');
        await refresh();
      },
      onError: (message) => toast('Could not record the answer', 'error', message),
    },
  );

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={`Loan application — ${loan.loanReference}`}
      description={d?.purpose ?? loan.purpose ?? undefined}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          {['SUBMITTED', 'UNDER_REVIEW'].includes(loan.status) && (
            <>
              <Button variant="danger" onClick={() => onDecide(false)}>
                Reject
              </Button>
              <Button onClick={() => onDecide(true)}>Approve</Button>
            </>
          )}
          {loan.status === 'APPROVED' && (
            <Button icon={<Send className="h-4 w-4" />} onClick={onDisburse}>
              Disburse
            </Button>
          )}
        </>
      }
    >
      {error ? (
        <Callout tone="danger">{error}</Callout>
      ) : !d ? (
        <p className="py-8 text-center text-sm text-slate-500">Loading application…</p>
      ) : (
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Borrower
              </p>
              <p className="mt-1 text-sm font-semibold text-navy-900">{d.borrower?.name ?? '—'}</p>
              <p className="text-xs text-slate-500">{d.borrower?.email}</p>
              <p className="text-xs text-slate-500">{d.borrower?.phone}</p>
              {d.borrower && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <Badge
                    tone={
                      d.borrower.kycStatus === 'APPROVED' || d.borrower.kycStatus === 'VERIFIED'
                        ? 'green'
                        : d.borrower.kycStatus === 'REJECTED'
                          ? 'red'
                          : 'amber'
                    }
                  >
                    <ShieldCheck className="mr-1 inline h-3 w-3" />
                    {humanise(d.borrower.kycTier)} · {humanise(d.borrower.kycStatus)}
                  </Badge>
                  <Badge tone={d.borrower.membershipStatus === 'ACTIVE' ? 'green' : 'slate'}>
                    {humanise(d.borrower.membershipStatus)} member
                  </Badge>
                </div>
              )}
              {d.borrower?.memberSince && (
                <p className="mt-2 text-xs text-slate-500">
                  Member since {date(d.borrower.memberSince)}
                </p>
              )}
            </div>
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Status
              </p>
              <div className="mt-1">
                <StatusBadge status={d.status.toLowerCase()} />
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Applied {date(d.createdAt)}
                {d.approvedAt ? ` · approved ${date(d.approvedAt)}` : ''}
                {d.termsAcceptedAt ? ` · terms accepted ${date(d.termsAcceptedAt)}` : ''}
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Request
              </p>
              <p className="mt-1 text-sm font-medium text-navy-900">
                {d.purpose || 'No purpose supplied'}
              </p>
              <p className="mt-2 text-xs text-slate-500">
                {d.productName ? `${d.productName} · ` : ''}{d.termDays} days
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Member position
              </p>
              <p className="mt-1 text-sm font-semibold text-navy-900">
                {d.borrower?.savingsBalance == null
                  ? 'Savings not available'
                  : money(d.borrower.savingsBalance, d.currencyCode)}
              </p>
              <p className="text-xs text-slate-500">Community savings balance</p>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200">
            <dl className="divide-y divide-slate-100">
              <DetailRow label="Principal" value={money(d.principal, d.currencyCode)} />
              <DetailRow label="Interest" value={money(d.interestAmount, d.currencyCode)} />
              <DetailRow label="Processing fee" value={money(d.processingFee, d.currencyCode)} />
              <DetailRow label="Member receives" value={money(d.netDisbursed, d.currencyCode)} />
              <DetailRow
                label="Repayment"
                value={
                  d.schedule.length
                    ? `${d.schedule.length} × ${money(d.schedule[0].amount, d.currencyCode)} from ${date(d.schedule[0].dueDate)}`
                    : `${d.termDays} days`
                }
              />
              <DetailRow label="Total repayable" value={money(d.totalRepayable, d.currencyCode)} strong />
            </dl>
          </div>

          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Guarantors ({d.guarantors.length})
            </p>
            {d.guarantors.length === 0 && (
              <p className="text-sm text-slate-500">No guarantors were named.</p>
            )}
            <div className="space-y-2">
              {d.guarantors.map((g) => (
                <div
                  key={g.id}
                  className="flex flex-col gap-3 rounded-xl border border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-navy-900 sm:truncate">
                      {g.name}
                      {g.external && <span className="ml-1.5 text-xs text-slate-400">external</span>}
                    </p>
                    <p className="break-words text-xs text-slate-500">
                      {[g.email, g.phone].filter(Boolean).join(' · ') || 'Member of this community'}
                    </p>
                    {g.kycTier && (
                      <p className="mt-1 text-xs text-slate-500">
                        Identity: {humanise(g.kycTier)} · {humanise(g.kycStatus ?? 'NOT_STARTED')}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
                    <Badge tone={g.status === 'CONFIRMED' ? 'green' : g.status === 'DECLINED' ? 'red' : 'amber'}>
                      {humanise(g.status)}
                    </Badge>
                    {g.status === 'PENDING' && (
                      <>
                        <button
                          type="button"
                          disabled={guarantorReview.pending}
                          onClick={() => guarantorReview.run(g.id, true)}
                          className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-40"
                        >
                          Confirm
                        </button>
                        <button
                          type="button"
                          disabled={guarantorReview.pending}
                          onClick={() => guarantorReview.run(g.id, false)}
                          className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-40"
                        >
                          Decline
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}

function DetailRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5">
      <dt className="text-[13px] text-slate-500">{label}</dt>
      <dd className={`tnum text-[13px] ${strong ? 'font-bold text-navy-900' : 'font-medium text-navy-900'}`}>
        {value}
      </dd>
    </div>
  );
}

