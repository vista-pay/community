'use client';

import { useState } from 'react';
import { AmountInput, Button, Callout, Checkbox, Field, Input, Modal, Select, Textarea } from '@/components/ui';
import { useMutation } from '@/hooks/use-query';
import { useToast } from '@/components/providers/toast-provider';
import { portalApi } from '@/services/portal';
import type { BookAccount, CashAccount } from '@/types';

const today = () => new Date().toISOString().slice(0, 10);

/**
 * Raises an expense request. It does not touch the books — the entry is
 * posted when someone else approves it and records payment, which is the
 * separation the two-signature rule exists for.
 */
export function ExpenseModal(props: {
  open: boolean;
  onClose: () => void;
  accounts: BookAccount[];
  cashAccounts: CashAccount[];
  communityId: string;
  onCreated: () => Promise<void>;
  /**
   * Offered beside "Paid from" when the community has registered nothing to
   * pay from. The officer notices the gap here, so this is where the way out
   * of it belongs — sending them off to find another screen is how a form
   * gets abandoned.
   */
  onAddCashAccount?: () => void;
}) {
  if (!props.open) return null;
  return <ExpenseForm {...props} />;
}

function ExpenseForm({
  open,
  onClose,
  accounts,
  cashAccounts,
  communityId,
  onCreated,
  onAddCashAccount,
}: {
  open: boolean;
  onClose: () => void;
  accounts: BookAccount[];
  cashAccounts: CashAccount[];
  communityId: string;
  onCreated: () => Promise<void>;
  onAddCashAccount?: () => void;
}) {
  const { toast } = useToast();
  const [expenseDate, setExpenseDate] = useState(today);
  const [payee, setPayee] = useState('');
  const [accountCode, setAccountCode] = useState('');
  const [amount, setAmount] = useState('');
  const [paidFromId, setPaidFromId] = useState(cashAccounts[0]?.id ?? '');
  const [hasReceipt, setHasReceipt] = useState(false);
  const [note, setNote] = useState('');

  const create = useMutation(
    () =>
      portalApi.createExpense(communityId, {
        expenseDate,
        payee: payee.trim(),
        accountCode,
        amount,
        paidFromId: paidFromId || undefined,
        hasReceipt,
        note: note.trim() || undefined,
      }),
    {
      onSuccess: async () => {
        toast('Expense raised', 'success', 'Another officer has to approve it.');
        onClose();
        await onCreated();
      },
      onError: (message) => toast('Could not raise the expense', 'error', message),
    },
  );

  const expenseAccounts = accounts.filter((a) => a.type === 'EXPENSE' && a.isActive);
  const valid = payee.trim().length > 1 && accountCode && Number(amount) > 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Record an expense"
      description="Raised now, approved by another officer, posted when it is paid."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={create.pending}>
            Cancel
          </Button>
          <Button disabled={!valid} loading={create.pending} onClick={() => void create.run()}>
            Raise expense
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {create.error && <Callout tone="danger">{create.error}</Callout>}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Date" htmlFor="ex-date" required>
            <Input id="ex-date" type="date" value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)} />
          </Field>
          <Field label="Amount" htmlFor="ex-amount" required>
            <AmountInput id="ex-amount" value={amount} onChange={setAmount} />
          </Field>
        </div>

        <Field label="Paid to" htmlFor="ex-payee" required>
          <Input
            id="ex-payee"
            value={payee}
            onChange={(e) => setPayee(e.target.value)}
            placeholder="Ikeja Printing Services"
          />
        </Field>

        <Field label="Expense account" htmlFor="ex-account" required hint="Which line of the books this belongs to">
          <Select id="ex-account" value={accountCode} onChange={(e) => setAccountCode(e.target.value)}>
            <option value="">Choose an account…</option>
            {expenseAccounts.map((a) => (
              <option key={a.id} value={a.code}>
                {a.code} — {a.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="Paid from"
          htmlFor="ex-paid-from"
          hint={
            cashAccounts.length
              ? 'Leave it on "Decide later" if the account is not settled yet'
              : undefined
          }
        >
          <Select id="ex-paid-from" value={paidFromId} onChange={(e) => setPaidFromId(e.target.value)}>
            <option value="">Decide later</option>
            {cashAccounts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} — {c.institution}
              </option>
            ))}
          </Select>
          {cashAccounts.length === 0 && (
            <p className="mt-1.5 text-[13px] text-slate-500">
              No accounts registered, so there is nothing to pay from yet.{' '}
              {onAddCashAccount ? (
                <button
                  type="button"
                  onClick={onAddCashAccount}
                  className="font-semibold text-brand-700 underline underline-offset-2"
                >
                  Add one now
                </button>
              ) : (
                <>Add one under Accounting → Banking.</>
              )}
            </p>
          )}
        </Field>

        <Checkbox
          checked={hasReceipt}
          onChange={setHasReceipt}
          label="A receipt is on file"
          description="Approvers can see whether the spend is evidenced"
        />

        <Field label="Note" htmlFor="ex-note" optional>
          <Textarea id="ex-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}
