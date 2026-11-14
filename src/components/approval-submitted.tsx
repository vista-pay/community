'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import { ArrowRight, Check, Clock, ShieldCheck } from 'lucide-react';
import { Button, Modal } from '@/components/ui';
import { ApiError } from '@/lib/api';
import { money as formatMoney } from '@/lib/format';
import {
  type ApprovalChallenge,
  readApprovalChallenge,
  subscribeApprovalChallenge,
} from '@/lib/approval-challenge';

/**
 * The same challenge, read off a caught error.
 *
 * The API client already publishes it centrally; this is for the one caller
 * that has to branch on it in place — the owner's-code gate, which must not
 * report an approval chain as a failed money-out.
 */
export function approvalChallengeFrom(error: unknown): ApprovalChallenge | null {
  if (!(error instanceof ApiError)) return null;
  return readApprovalChallenge(error.status, error.body);
}

/**
 * Tells the officer who submitted that their action went through — to the
 * other officers.
 *
 * It is not an error, and showing it as one (which is what a bare "Could not
 * complete" toast did) teaches officers that the approval workflow is
 * something going wrong rather than the control their community asked for.
 * What they need is the opposite: confirmation that it is recorded, the
 * reference to quote, and who has it now.
 */
export function ApprovalSubmittedDialog() {
  const [challenge, setChallenge] = useState<ApprovalChallenge | null>(null);

  useEffect(() => subscribeApprovalChallenge(setChallenge), []);

  const close = useCallback(() => setChallenge(null), []);
  if (!challenge) return null;

  const remaining = challenge.stages.filter((s) => s.status !== 'APPROVED').length;

  return (
    <Modal
      open
      onClose={close}
      title={challenge.raised ? 'Sent for approval' : 'Already with your officers'}
      description={
        challenge.raised
          ? 'Your action is recorded. It takes effect once the officers below have approved it.'
          : 'This was submitted earlier and is still working its way through.'
      }
      footer={
        <div className="flex w-full flex-wrap justify-between gap-2">
          <Button variant="secondary" onClick={close}>
            Close
          </Button>
          <Link href={`/approvals?requestId=${challenge.requestId}` as Route} onClick={close}>
            <Button icon={<ArrowRight className="h-4 w-4" />}>Track it in Approvals</Button>
          </Link>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-xl bg-emerald-50 p-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-navy-900">{challenge.title}</p>
            <p className="mt-0.5 text-xs text-slate-600">
              {challenge.operationLabel} · Reference{' '}
              <span className="font-mono font-semibold text-navy-900">{challenge.reference}</span>
              {challenge.amount
                ? ` · ${formatMoney(challenge.amount, challenge.currencyCode ?? 'NGN')}`
                : ''}
            </p>
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold tracking-wide text-slate-500">
            WHO STILL HAS TO APPROVE IT
          </p>
          <ol className="space-y-1.5">
            {challenge.stages.map((stage) => {
              const approved = stage.status === 'APPROVED';
              const now = stage.status === 'PENDING';
              return (
                <li
                  key={stage.position}
                  className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 ${
                    now ? 'bg-amber-50' : approved ? 'bg-slate-50' : ''
                  }`}
                >
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                      approved
                        ? 'bg-emerald-600 text-white'
                        : now
                          ? 'bg-amber-500 text-white'
                          : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {approved ? <Check className="h-3 w-3" /> : now ? <Clock className="h-3 w-3" /> : stage.position}
                  </span>
                  <span className="min-w-0 flex-1 text-sm text-navy-900">
                    {stage.role}
                    {stage.isFinalAuthority && (
                      <span className="ml-1.5 text-xs text-slate-500">· final authorisation</span>
                    )}
                  </span>
                  <span className="shrink-0 text-xs text-slate-500">
                    {approved ? 'Approved' : now ? 'Reviewing now' : 'Then'}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>

        <p className="text-xs leading-relaxed text-slate-500">
          {remaining === 1
            ? 'One more approval and it takes effect.'
            : `${remaining} more approvals and it takes effect.`}{' '}
          Each officer is notified when it reaches them. Nothing is applied — and no money moves —
          until the last one has approved.
        </p>
      </div>
    </Modal>
  );
}
