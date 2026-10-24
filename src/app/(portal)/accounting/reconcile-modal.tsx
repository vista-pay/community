'use client';

import { useState } from 'react';
import { AmountInput, Button, Callout, Field, Input, Modal, Select } from '@/components/ui';
import { useMutation } from '@/hooks/use-query';
import { useToast } from '@/components/providers/toast-provider';
import { portalApi } from '@/services/portal';
import { money } from '@/lib/format';
import { isZeroMoney, subtractMoney } from '@/lib/money';
import type { BookAccount, CashAccount } from '@/types';

/**
 * Bank reconciliation.
 *
 * The difference is shown before anything is saved, and posting an adjustment
 * is an explicit extra choice. An unexplained gap between the bank and the
 * books is a finding for the auditor, not something to sweep into a
 * suspense account automatically.
 */
export function ReconcileModal(props: {
  account: CashAccount | null;
  accounts: BookAccount[];
  communityId: string;
  onClose: () => void;
  onDone: () => Promise<void>;
}) {
  if (!props.account) return null;
  // Keyed on the account so switching between two bank accounts does not
  // carry one statement balance over to the other.
  return <ReconcileForm key={props.account.id} {...props} account={props.account} />;
}

function ReconcileForm({
  account,
  accounts,
  communityId,
  onClose,
  onDone,
}: {
  account: CashAccount;
  accounts: BookAccount[];
  communityId: string;
  onClose: () => void;
  onDone: () => Promise<void>;
}) {
  const { toast } = useToast();
  const [statementBalance, setStatementBalance] = useState(
    account.statementBalance === '0.00' ? '' : account.statementBalance,
  );
  const [statementDate, setStatementDate] = useState(
    account.statementDate
      ? account.statementDate.slice(0, 10)
      : new Date().toISOString().slice(0, 10),
  );
  const [adjustmentAccountCode, setAdjustmentAccountCode] = useState('');

  const difference = subtractMoney(statementBalance || '0', account.bookBalance);
  const matches = isZeroMoney(difference);

  const run = useMutation(
    () =>
      portalApi.reconcile(communityId, account.id, {
        statementBalance: statementBalance || '0',
        statementDate,
        adjustmentAccountCode: adjustmentAccountCode || undefined,
      }),
    {
      onSuccess: async (result) => {
        toast(
          result.reconciled ? 'Reconciled' : 'Statement recorded',
          result.reconciled ? 'success' : 'info',
          result.reconciled
            ? 'The bank and the books agree.'
            : `A difference of ${money(result.difference)} remains.`,
        );
        await onDone();
      },
      onError: (message) => toast('Could not reconcile', 'error', message),
    },
  );

  return (
    <Modal
      open
      onClose={onClose}
      title={`Reconcile ${account.name}`}
      description={`${account.institution} · ${account.maskedNumber}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={run.pending}>
            Cancel
          </Button>
          <Button
            disabled={!statementBalance || run.pending}
            loading={run.pending}
            onClick={() => void run.run()}
          >
            {adjustmentAccountCode ? 'Reconcile and post adjustment' : 'Record statement'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {run.error && <Callout tone="danger">{run.error}</Callout>}

        <div className="rounded-lg bg-slate-50 px-4 py-3">
          <div className="flex items-center justify-between text-[13px]">
            <span className="text-slate-600">Balance per the books</span>
            <span className="tnum font-medium text-navy-900">{money(account.bookBalance)}</span>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Closing balance on the statement" htmlFor="rec-balance" required>
            <AmountInput id="rec-balance" value={statementBalance} onChange={setStatementBalance} />
          </Field>
          <Field label="Statement date" htmlFor="rec-date" required>
            <Input
              id="rec-date"
              type="date"
              value={statementDate}
              onChange={(e) => setStatementDate(e.target.value)}
            />
          </Field>
        </div>

        {statementBalance !== '' && (
          <Callout tone={matches ? 'success' : 'warning'} title={matches ? 'They agree' : 'There is a difference'}>
            {matches ? (
              'The statement matches the books exactly.'
            ) : (
              <>
                The statement is {money(difference)}{' '}
                {difference.startsWith('-') ? 'below' : 'above'} the books. Common causes are an
                uncleared cheque, a bank charge nobody recorded, or a deposit still in transit.
              </>
            )}
          </Callout>
        )}

        {!matches && statementBalance !== '' && (
          <Field
            label="Post the difference to"
            htmlFor="rec-adjust"
            optional
            hint="Leave empty to record the statement and investigate the gap yourself"
          >
            <Select
              id="rec-adjust"
              value={adjustmentAccountCode}
              onChange={(e) => setAdjustmentAccountCode(e.target.value)}
            >
              <option value="">Do not adjust the books</option>
              {accounts
                .filter((a) => a.isActive && (a.type === 'EXPENSE' || a.type === 'INCOME'))
                .map((a) => (
                  <option key={a.id} value={a.code}>
                    {a.code} — {a.name}
                  </option>
                ))}
            </Select>
          </Field>
        )}
      </div>
    </Modal>
  );
}
