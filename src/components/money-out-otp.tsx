'use client';

import { useCallback, useRef, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { Button, Callout, Field, Input, Modal } from '@/components/ui';
import { ApiError } from '@/lib/api';
import { useToast } from '@/components/providers/toast-provider';
import { money } from '@/lib/format';

/** Discriminator the API sets on the 428 that asks for the owner's code. */
const MONEY_OUT_OTP_REQUIRED = 'MONEY_OUT_OTP_REQUIRED';

export interface MoneyOutChallenge {
  challengeId: string;
  action: string;
  amount: string;
  currencyCode: string;
  /** Masked, e.g. `o***r@unity.coop`. */
  sentTo: string;
  channel: 'EMAIL' | 'PHONE';
  expiresAt: string;
  /** Development only — the API omits this in production. */
  debugOtp?: string;
}

/** Extra fields the gate needs folded into whatever request is being made. */
export interface MoneyOutExtra {
  otp?: string;
  resend?: boolean;
}

const ACTION_LABELS: Record<string, string> = {
  LOAN_DISBURSEMENT: 'Disburse this loan',
  SAVINGS_WITHDRAWAL: 'Release this savings withdrawal',
  WELFARE_DISBURSEMENT: 'Pay this welfare request',
  CONTRIBUTION_PAYOUT: 'Release this contribution payout',
  WALLET_WITHDRAWAL: 'Send this withdrawal to a bank account',
};

/** Reads the challenge out of an error, or null if it is a different error. */
function challengeFrom(error: unknown): MoneyOutChallenge | null {
  if (!(error instanceof ApiError) || error.status !== 428) return null;
  const body = error.body as { code?: string; errors?: MoneyOutChallenge } | null;
  if (body?.code !== MONEY_OUT_OTP_REQUIRED || !body.errors?.challengeId) return null;
  return body.errors;
}

export interface MoneyOutGate<P = void> {
  challenge: MoneyOutChallenge | null;
  pending: boolean;
  /**
   * Attempt the action. Opens the dialog if the owner's code is needed.
   *
   * Whatever is passed here is remembered and handed back to `perform` on the
   * retry, so a list can gate per-row without the screen holding "which row"
   * in state — which it would have to set and then read in the same tick.
   */
  run: (payload: P) => Promise<void>;
  confirm: (otp: string) => Promise<void>;
  resend: () => Promise<void>;
  cancel: () => void;
}

/**
 * Gate any action that takes money out of the community behind the owner's
 * one-time code.
 *
 * The API drives this, not the UI: the first call is made without a code, and
 * only if it comes back 428 is the dialog opened. That ordering matters —
 * which operations need approval is a server decision, so a screen cannot
 * forget to ask, and a new gated path needs no change here.
 *
 * `perform` receives the extra fields to fold into its request body:
 *
 *   const gate = useMoneyOutOtp({
 *     perform: (extra) => portalApi.decideSavingsWithdrawal(cid, id, true, note, extra),
 *     onDone: refresh,
 *   });
 *
 * Then render one <MoneyOutOtpDialog gate={gate} /> per screen.
 */
export function useMoneyOutOtp<P = void>({
  perform,
  onDone,
  successMessage = 'Done — the money is on its way',
}: {
  perform: (extra: MoneyOutExtra, payload: P) => Promise<unknown>;
  onDone?: () => void | Promise<void>;
  successMessage?: string;
}): MoneyOutGate<P> {
  const { toast } = useToast();
  const [challenge, setChallenge] = useState<MoneyOutChallenge | null>(null);
  const [pending, setPending] = useState(false);
  // Held in a ref, not state: confirm() runs from the dialog after a render,
  // and a state write from run() would not be readable in the same tick.
  const payloadRef = useRef<P>(undefined as P);

  const attempt = useCallback(
    async (extra: MoneyOutExtra) => {
      setPending(true);
      try {
        await perform(extra, payloadRef.current);
        setChallenge(null);
        toast(successMessage, 'success');
        await onDone?.();
      } catch (error) {
        const next = challengeFrom(error);
        if (next) {
          // Not a failure: the server is asking for the owner's approval.
          setChallenge(next);
          return;
        }
        toast(
          'Could not complete',
          'error',
          error instanceof Error ? error.message : 'Something went wrong',
        );
      } finally {
        setPending(false);
      }
    },
    [perform, onDone, successMessage, toast],
  );

  return {
    challenge,
    pending,
    run: useCallback(
      (payload: P) => {
        payloadRef.current = payload;
        return attempt({});
      },
      [attempt],
    ),
    confirm: useCallback((otp: string) => attempt({ otp }), [attempt]),
    resend: useCallback(() => attempt({ resend: true }), [attempt]),
    cancel: useCallback(() => setChallenge(null), []),
  };
}

/**
 * The code-entry dialog. Says what is being approved and for how much, so an
 * officer reading the code off the owner's phone knows what they are
 * releasing — an OTP prompt with no amount on it teaches people to approve
 * anything.
 */
/** The dialog never touches the payload, so it accepts a gate of any shape. */
type AnyMoneyOutGate = Omit<MoneyOutGate<never>, 'run'>;

export function MoneyOutOtpDialog({ gate }: { gate: AnyMoneyOutGate }) {
  const [code, setCode] = useState('');
  const challenge = gate.challenge;

  const close = () => {
    setCode('');
    gate.cancel();
  };

  const submit = async () => {
    await gate.confirm(code);
    setCode('');
  };

  return (
    <Modal
      open={Boolean(challenge)}
      onClose={close}
      title={
        <span className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-brand-600" />
          Owner approval required
        </span>
      }
      description="Money leaving the community needs a code from the community owner."
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={gate.pending}>
            Cancel
          </Button>
          <Button
            onClick={() => void submit()}
            loading={gate.pending}
            disabled={!/^\d{6}$/.test(code)}
          >
            Approve
          </Button>
        </>
      }
    >
      {challenge && (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-[13px] font-semibold text-navy-900">
              {ACTION_LABELS[challenge.action] ?? 'Release this payment'}
            </p>
            <p className="tnum mt-1 text-[22px] font-bold tracking-tight text-navy-900">
              {money(challenge.amount, challenge.currencyCode)}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Code sent to the community owner at{' '}
              <span className="font-medium text-slate-700">{challenge.sentTo}</span>
            </p>
          </div>

          <Field label="Approval code" required>
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="000000"
              className="tnum text-center text-lg tracking-[0.4em]"
              aria-label="Six-digit approval code"
            />
          </Field>

          {/* Local stacks have no live email provider, so the API returns the
              code outside production. It is never present in production. */}
          {challenge.debugOtp && (
            <Callout tone="warning" title="Development only">
              The code is <span className="tnum font-bold">{challenge.debugOtp}</span>. This is
              shown because no email provider is configured locally.
            </Callout>
          )}

          <button
            type="button"
            onClick={() => void gate.resend()}
            disabled={gate.pending}
            className="text-[13px] font-semibold text-brand-700 underline-offset-4 hover:underline disabled:opacity-50"
          >
            Send the owner a new code
          </button>
        </div>
      )}
    </Modal>
  );
}
