'use client';

import { useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { AmountInput, Button, Callout, Field, Input, Modal, Select } from '@/components/ui';
import { useMutation } from '@/hooks/use-query';
import { useToast } from '@/components/providers/toast-provider';
import { portalApi } from '@/services/portal';
import { money } from '@/lib/format';
import { compareMoney, subtractMoney, sumMoney } from '@/lib/money';
import type { BookAccount } from '@/types';

interface Line {
  accountCode: string;
  side: 'debit' | 'credit';
  amount: string;
  memo: string;
}

const blankLine = (): Line => ({ accountCode: '', side: 'debit', amount: '', memo: '' });
const today = () => new Date().toISOString().slice(0, 10);

/**
 * Manual journal entry.
 *
 * The balance is shown live and the submit stays disabled until the two sides
 * agree — the server refuses an unbalanced entry anyway, so the only question
 * is whether the officer finds out before or after they press the button.
 */
export function JournalModal(props: {
  open: boolean;
  onClose: () => void;
  accounts: BookAccount[];
  communityId: string;
  onPosted: () => Promise<void>;
}) {
  // The form starts clean every time it opens because it is mounted every
  // time it opens. Clearing it from an effect left the previous entry's
  // lines visible for a frame, which on a journal form is alarming.
  if (!props.open) return null;
  return <JournalForm {...props} />;
}

function JournalForm({
  open,
  onClose,
  accounts,
  communityId,
  onPosted,
}: {
  open: boolean;
  onClose: () => void;
  accounts: BookAccount[];
  communityId: string;
  onPosted: () => Promise<void>;
}) {
  const { toast } = useToast();
  const [entryDate, setEntryDate] = useState(today);
  const [description, setDescription] = useState('');
  const [lines, setLines] = useState<Line[]>([blankLine(), { ...blankLine(), side: 'credit' }]);

  const totals = useMemo(() => {
    const debit = sumMoney(lines.filter((l) => l.side === 'debit').map((l) => l.amount || '0'));
    const credit = sumMoney(lines.filter((l) => l.side === 'credit').map((l) => l.amount || '0'));
    return { debit, credit, difference: subtractMoney(debit, credit) };
  }, [lines]);

  const balanced = compareMoney(totals.debit, totals.credit) === 0;
  const anyAmount = compareMoney(totals.debit, '0') > 0;
  const complete = lines.every((l) => l.accountCode && Number(l.amount) > 0);
  const canPost = balanced && anyAmount && complete && description.trim().length > 2;

  const save = useMutation(
    (post: boolean) =>
      portalApi.createJournal(communityId, {
        entryDate,
        description: description.trim(),
        post,
        lines: lines.map((l) => ({
          accountCode: l.accountCode,
          [l.side]: l.amount,
          memo: l.memo || undefined,
        })) as Array<{ accountCode: string; debit?: string; credit?: string; memo?: string }>,
      }),
    {
      onSuccess: async (entry) => {
        toast(
          entry.status === 'POSTED' ? `Posted ${entry.reference}` : `Draft ${entry.reference} saved`,
          'success',
        );
        onClose();
        await onPosted();
      },
      onError: (message) => toast('Could not save the entry', 'error', message),
    },
  );

  const update = (index: number, patch: Partial<Line>) =>
    setLines((current) => current.map((l, i) => (i === index ? { ...l, ...patch } : l)));

  const active = accounts.filter((a) => a.isActive);

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title="New journal entry"
      description="Debits must equal credits. Posted entries cannot be edited, only reversed."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={save.pending}>
            Cancel
          </Button>
          <Button
            variant="secondary"
            disabled={!complete || !anyAmount || save.pending}
            onClick={() => void save.run(false)}
          >
            Save as draft
          </Button>
          <Button disabled={!canPost} loading={save.pending} onClick={() => void save.run(true)}>
            Post entry
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {save.error && <Callout tone="danger">{save.error}</Callout>}

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Date" htmlFor="je-date" required>
            <Input
              id="je-date"
              type="date"
              value={entryDate}
              onChange={(e) => setEntryDate(e.target.value)}
            />
          </Field>
          <Field label="Description" htmlFor="je-desc" required className="sm:col-span-2">
            <Input
              id="je-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="October dues collected at the general meeting"
            />
          </Field>
        </div>

        <div className="overflow-hidden rounded-lg border border-slate-200">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="th">Account</th>
                <th className="th w-28">Side</th>
                <th className="th w-40 text-right">Amount</th>
                <th className="th">Memo</th>
                <th className="th w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {lines.map((line, i) => (
                <tr key={i}>
                  <td className="px-2 py-2">
                    <Select
                      value={line.accountCode}
                      aria-label={`Account for line ${i + 1}`}
                      onChange={(e) => update(i, { accountCode: e.target.value })}
                    >
                      <option value="">Choose an account…</option>
                      {active.map((a) => (
                        <option key={a.id} value={a.code}>
                          {a.code} — {a.name}
                        </option>
                      ))}
                    </Select>
                  </td>
                  <td className="px-2 py-2">
                    <Select
                      value={line.side}
                      aria-label={`Side for line ${i + 1}`}
                      onChange={(e) => update(i, { side: e.target.value as Line['side'] })}
                    >
                      <option value="debit">Debit</option>
                      <option value="credit">Credit</option>
                    </Select>
                  </td>
                  <td className="px-2 py-2">
                    <AmountInput
                      value={line.amount}
                      onChange={(amount) => update(i, { amount })}
                      id={`je-amount-${i}`}
                    />
                  </td>
                  <td className="px-2 py-2">
                    <Input
                      value={line.memo}
                      aria-label={`Memo for line ${i + 1}`}
                      onChange={(e) => update(i, { memo: e.target.value })}
                      placeholder="Optional"
                    />
                  </td>
                  <td className="px-2 py-2 text-right">
                    <button
                      type="button"
                      aria-label={`Remove line ${i + 1}`}
                      disabled={lines.length <= 2}
                      onClick={() => setLines((c) => c.filter((_, x) => x !== i))}
                      className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-red-600 disabled:opacity-40"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex flex-wrap items-center gap-3 border-t border-slate-200 bg-slate-50 px-3 py-2.5">
            <Button
              size="xs"
              variant="secondary"
              icon={<Plus className="h-3.5 w-3.5" />}
              onClick={() => setLines((c) => [...c, blankLine()])}
            >
              Add line
            </Button>
            <div className="flex-1" />
            <span className="tnum text-[13px] text-slate-600">
              Debits {money(totals.debit)} · Credits {money(totals.credit)}
            </span>
            <span
              className={
                balanced
                  ? 'rounded-md bg-emerald-50 px-2 py-0.5 text-[13px] font-medium text-emerald-700'
                  : 'rounded-md bg-amber-50 px-2 py-0.5 text-[13px] font-medium text-amber-800'
              }
            >
              {balanced ? 'Balanced' : `Out by ${money(totals.difference)}`}
            </span>
          </div>
        </div>

      </div>
    </Modal>
  );
}
