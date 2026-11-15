'use client';

import { useMemo, useState } from 'react';
import { Button, Callout, Field, Input, Modal, RadioCard, Select } from '@/components/ui';
import { useMutation } from '@/hooks/use-query';
import { useToast } from '@/components/providers/toast-provider';
import { portalApi } from '@/services/portal';
import type { BookAccount, CashAccountKind } from '@/types';

const KINDS: { value: CashAccountKind; title: string; description: string }[] = [
  {
    value: 'BANK',
    title: 'Bank account',
    description: 'An account at a bank, with statements to reconcile against.',
  },
  {
    value: 'CASH',
    title: 'Cash box',
    description: 'Money held as cash — a tin, a safe, a treasurer’s float.',
  },
  {
    value: 'CLEARING',
    title: 'Clearing account',
    description: 'Money in transit between two places it is counted.',
  },
];

/**
 * Register a bank account or cash box.
 *
 * Two screens pointed at this and neither could reach it: Banking said "add
 * the account your community actually banks with" with nothing to click, and
 * the expense form's "Paid from" could only ever offer "Decide later". The
 * API and the client call both already existed — this is the form that was
 * missing.
 *
 * Only the last four digits of the number are kept. The full number is typed
 * so an officer can confirm they have the right account, and discarded by the
 * API before anything is stored.
 */
export function CashAccountModal({
  open,
  accounts,
  communityId,
  onClose,
  onCreated,
}: {
  open: boolean;
  accounts: BookAccount[];
  communityId: string;
  onClose: () => void;
  onCreated: () => Promise<void>;
}) {
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [institution, setInstitution] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [kind, setKind] = useState<CashAccountKind>('BANK');

  /**
   * Which line of the books this cash sits on. Only asset accounts can hold
   * it, and the seeded chart puts them under "Cash & bank" — offered first,
   * because that is where a bank account belongs in all but unusual books.
   */
  const ledgerOptions = useMemo(() => {
    const assets = accounts.filter((a) => a.isActive && a.type === 'ASSET');
    const cash = assets.filter((a) => /cash|bank/i.test(a.group));
    const rest = assets.filter((a) => !/cash|bank/i.test(a.group));
    return { cash, rest };
  }, [accounts]);

  const [ledgerCode, setLedgerCode] = useState('');
  const effectiveLedgerCode = ledgerCode || ledgerOptions.cash[0]?.code || '';

  const create = useMutation(
    () =>
      portalApi.createCashAccount(communityId, {
        name: name.trim(),
        institution: institution.trim(),
        accountNumber: accountNumber.trim(),
        kind,
        ledgerCode: effectiveLedgerCode,
      }),
    {
      onSuccess: async () => {
        toast(
          'Account added',
          'success',
          'It can now be reconciled, and chosen when an expense is paid.',
        );
        setName('');
        setInstitution('');
        setAccountNumber('');
        setLedgerCode('');
        await onCreated();
        onClose();
      },
      onError: (message) => toast('Could not add that account', 'error', message),
    },
  );

  const isCash = kind === 'CASH';
  // The API requires a number whatever the kind — it is what the masked
  // identifier is cut from — so a cash box gives its reference instead of
  // being allowed through empty and rejected at the server.
  const ready =
    name.trim().length > 1 &&
    institution.trim().length > 1 &&
    accountNumber.trim().length >= (isCash ? 1 : 4) &&
    Boolean(effectiveLedgerCode);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add a bank account or cash box"
      description="Where your community's money actually sits, so it can be reconciled and named when a bill is paid."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={create.pending}>
            Cancel
          </Button>
          <Button disabled={!ready || create.pending} loading={create.pending} onClick={() => void create.run()}>
            Add account
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {create.error && <Callout tone="danger">{create.error}</Callout>}

        {ledgerOptions.cash.length === 0 && ledgerOptions.rest.length === 0 && (
          <Callout tone="warning" title="The chart of accounts has no asset line">
            Cash has to sit somewhere in the books. Open the Chart tab and add an asset account
            first.
          </Callout>
        )}

        <div className="grid gap-2 sm:grid-cols-3">
          {KINDS.map((option) => (
            <RadioCard
              key={option.value}
              selected={kind === option.value}
              onSelect={() => setKind(option.value)}
              title={option.title}
              description={option.description}
            />
          ))}
        </div>

        <Field
          label="What you call it"
          htmlFor="cash-name"
          required
          hint="The name officers will recognise — “Main account”, “Dues collections”."
        >
          <Input
            id="cash-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={isCash ? 'Office cash box' : 'Main account'}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={isCash ? 'Held by' : 'Bank'} htmlFor="cash-institution" required>
            <Input
              id="cash-institution"
              value={institution}
              onChange={(e) => setInstitution(e.target.value)}
              placeholder={isCash ? 'Treasurer' : 'First Bank of Nigeria'}
            />
          </Field>
          <Field
            label={isCash ? 'Reference' : 'Account number'}
            htmlFor="cash-number"
            required
            hint={
              isCash
                ? 'Anything that identifies this box. Only the last four characters are stored.'
                : 'Only the last four digits are stored.'
            }
          >
            <Input
              id="cash-number"
              value={accountNumber}
              inputMode={isCash ? 'text' : 'numeric'}
              autoComplete="off"
              onChange={(e) => setAccountNumber(e.target.value)}
              placeholder={isCash ? 'Safe 2' : '3088201145'}
            />
          </Field>
        </div>

        <Field
          label="Which line of the books"
          htmlFor="cash-ledger"
          required
          hint="Every movement in and out of this account posts here."
        >
          <Select
            id="cash-ledger"
            value={effectiveLedgerCode}
            onChange={(e) => setLedgerCode(e.target.value)}
          >
            {ledgerOptions.cash.length > 0 && (
              <optgroup label="Cash & bank">
                {ledgerOptions.cash.map((a) => (
                  <option key={a.id} value={a.code}>
                    {a.code} — {a.name}
                  </option>
                ))}
              </optgroup>
            )}
            {ledgerOptions.rest.length > 0 && (
              <optgroup label="Other assets">
                {ledgerOptions.rest.map((a) => (
                  <option key={a.id} value={a.code}>
                    {a.code} — {a.name}
                  </option>
                ))}
              </optgroup>
            )}
          </Select>
        </Field>
      </div>
    </Modal>
  );
}
