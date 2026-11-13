'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ArrowUpRight, BadgeCheck, Landmark, Star, UserRound } from 'lucide-react';
import {
  AmountInput,
  Button,
  Callout,
  Card,
  CardHeader,
  Checkbox,
  Field,
  Input,
  Segmented,
  Select,
  Textarea,
} from '@/components/ui';
import { MoneyOutOtpDialog, useMoneyOutOtp } from '@/components/money-out-otp';
import { useQuery } from '@/hooks/use-query';
import { useDebounced } from '@/hooks/use-debounced';
import { useCommunityId } from '@/components/providers/session-provider';
import { useToast } from '@/components/providers/toast-provider';
import { portalApi } from '@/services/portal';
import { money } from '@/lib/format';
import {
  AccountSelector,
  coaChoicePayload,
  isCoaChoiceComplete,
  SYSTEM_COA_CHOICE,
} from '@/components/accounting/account-selector';
import type {
  BankOption,
  CoaChoice,
  Expense,
  MerchantBeneficiary,
  MerchantPayoutQuote,
  MerchantPayoutRequest,
} from '@/types';

type Kind = 'BANK' | 'VISTA';

/**
 * Send money out of the merchant account.
 *
 * Three things the form will not let an officer skip, each for a reason that
 * has cost a cooperative money somewhere:
 *
 *   * **A stated reason.** Required by the API too. A transfer out with no
 *     purpose recorded is the one an audit cannot explain, and "ask the
 *     treasurer" stops working the moment the treasurer changes.
 *   * **A confirmed name.** The account name is resolved from the bank, or the
 *     Rendi account from its tag, and shown before the owner's code is
 *     entered. A mistyped digit otherwise pays a stranger.
 *   * **The owner's approval.** Not asked for here — the API returns 428 and
 *     the gate opens the dialog. Which actions need approval is a server
 *     decision, so this screen cannot forget to ask.
 */
export function SendPayout({
  beneficiaries,
  availableBalance,
  currencyCode,
  onSent,
}: {
  beneficiaries: MerchantBeneficiary[];
  availableBalance: string | null;
  currencyCode: string;
  onSent: () => void | Promise<void>;
}) {
  const communityId = useCommunityId();
  const { toast } = useToast();
  const searchParams = useSearchParams();

  const [kind, setKind] = useState<Kind>('BANK');
  const [beneficiaryId, setBeneficiaryId] = useState('');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [expenseId, setExpenseId] = useState(searchParams.get('expenseId') ?? '');
  const [savePayee, setSavePayee] = useState(false);
  const [payeeLabel, setPayeeLabel] = useState('');
  // Which account the payment is charged to. SYSTEM means the general
  // expense account the posting rules name, which is right for most payments.
  const [coaChoice, setCoaChoice] = useState<CoaChoice>(SYSTEM_COA_CHOICE);

  // Bank destination.
  //
  // Keyed on code *and* name rather than code alone: the provider's list has
  // five codes shared by two entries, and three of those pairs are different
  // banks (Stellas MFB / YCT MFB, Goodnews / Prospa Capital, Kolomoni /
  // KONGAPAY). With the code as the option value, picking either one selects
  // the first — so the officer sees and records a bank they did not choose.
  // Composite rather than a list index, which would shift if the provider
  // reorders between fetches.
  const [bankKey, setBankKey] = useState('');
  const [accountNumber, setAccountNumber] = useState('');

  // Rendi destination
  const [identifier, setIdentifier] = useState('');

  const { data: banks } = useQuery<BankOption[]>(() => portalApi.bankList(), []);
  // Approved but unpaid: the only expenses a payout can legitimately settle.
  const { data: expenses } = useQuery<Expense[]>(
    () => portalApi.expenses(communityId, 'APPROVED'),
    [communityId],
  );

  const bankKeyOf = (option: BankOption) => `${option.bankCode}::${option.bankName}`;
  const bank = banks?.find((option) => bankKeyOf(option) === bankKey) ?? null;
  // The bill this payment settles, if any. It already names its account.
  const selectedExpense = expenses?.find((e) => e.id === expenseId) ?? null;
  const bankCode = bank?.bankCode ?? '';

  const debouncedAccountNumber = useDebounced(accountNumber, 500);
  const debouncedIdentifier = useDebounced(identifier, 500);

  /**
   * The confirmed name of whoever is about to be paid.
   *
   * Resolved as soon as the destination is complete, rather than on blur: an
   * officer who pastes an account number and goes straight for the amount
   * never blurs the field, and would reach the owner's code prompt with no
   * name on screen to check.
   *
   * Each lookup echoes back the inputs it was made for, and the answer is only
   * read when they still match what is on screen. Without that, changing the
   * bank leaves the previous bank's account name sitting under the new one
   * while the next request is in flight — the one moment a stale name is
   * actively dangerous.
   */
  const bankLookupReady = kind === 'BANK' && debouncedAccountNumber.length === 10 && !!bankCode;
  const bankLookup = useQuery(
    async () => ({
      accountNumber: debouncedAccountNumber,
      bankCode,
      ...(await portalApi.resolveBankAccount({
        accountNumber: debouncedAccountNumber,
        bankCode,
      })),
    }),
    [debouncedAccountNumber, bankCode],
    { enabled: bankLookupReady },
  );
  const bankMatch =
    bankLookupReady &&
    bankLookup.data?.accountNumber === debouncedAccountNumber &&
    bankLookup.data?.bankCode === bankCode
      ? bankLookup.data
      : null;
  const accountName = bankMatch?.accountName ?? '';

  const rendiLookupReady = kind === 'VISTA' && debouncedIdentifier.trim().length >= 3;
  const rendiLookup = useQuery(
    async () => ({
      identifier: debouncedIdentifier.trim(),
      ...(await portalApi.resolveMerchantRecipient(communityId, debouncedIdentifier.trim())),
    }),
    [communityId, debouncedIdentifier],
    { enabled: rendiLookupReady },
  );
  const recipient =
    rendiLookupReady && rendiLookup.data?.identifier === debouncedIdentifier.trim()
      ? rendiLookup.data
      : null;

  const resolving =
    (bankLookupReady && !bankMatch && !bankLookup.error) ||
    (rendiLookupReady && !recipient && !rendiLookup.error);
  const resolveError = kind === 'BANK' ? bankLookup.error : rendiLookup.error;

  /**
   * Picking a saved payee fills the destination.
   *
   * The name is deliberately not copied across: it is re-confirmed from the
   * bank like any other, so a payee saved under a nickname — or one whose
   * account has since changed hands — cannot present a name the bank would
   * not agree with.
   */
  function pickBeneficiary(id: string) {
    setBeneficiaryId(id);
    const payee = beneficiaries.find((b) => b.id === id);
    if (!payee) return;
    setKind(payee.type);
    if (payee.type === 'BANK') {
      setAccountNumber(payee.accountNumber ?? '');
      // By name as well as code, so a payee saved against one of a shared-code
      // pair comes back as that bank rather than its twin. Falls back to the
      // code alone if the provider has since renamed the entry.
      const saved =
        banks?.find((b) => b.bankCode === payee.bankCode && b.bankName === payee.bankName) ??
        banks?.find((b) => b.bankCode === payee.bankCode);
      setBankKey(saved ? bankKeyOf(saved) : '');
    } else {
      setIdentifier(payee.vistaTag ?? '');
    }
  }

  const request: MerchantPayoutRequest = {
    type: kind,
    amount,
    currencyCode,
    reason: reason.trim(),
    ...(kind === 'BANK'
      ? {
          bankCode,
          bankName: bank?.bankName,
          accountNumber,
          accountName,
        }
      : {
          recipientUserId: recipient?.userId,
          recipientIdentifier: recipient ? undefined : identifier.trim(),
        }),
    expenseId: expenseId || undefined,
    beneficiaryId: beneficiaryId || undefined,
    coaChoice: coaChoicePayload(coaChoice),
  };

  const destinationReady =
    kind === 'BANK'
      ? Boolean(bankCode && accountNumber.length === 10 && accountName)
      : Boolean(recipient);
  const amountValid = Number(amount) > 0;
  const reasonValid = reason.trim().length >= 4;
  const ready =
    destinationReady && amountValid && reasonValid && !resolving && isCoaChoiceComplete(coaChoice);

  const overBalance =
    availableBalance !== null && amountValid && Number(amount) > Number(availableBalance);

  const [quote, setQuote] = useState<MerchantPayoutQuote | null>(null);
  const [quoting, setQuoting] = useState(false);

  async function getQuote() {
    setQuoting(true);
    try {
      setQuote(await portalApi.quoteMerchantPayout(communityId, request));
    } catch (error) {
      toast(
        'Could not price that',
        'error',
        error instanceof Error ? error.message : 'Try again',
      );
    } finally {
      setQuoting(false);
    }
  }

  function clearForm() {
    setAmount('');
    setReason('');
    setExpenseId('');
    setQuote(null);
    setCoaChoice(SYSTEM_COA_CHOICE);
    setBeneficiaryId('');
    setAccountNumber('');
    setBankKey('');
    setIdentifier('');
    setSavePayee(false);
    setPayeeLabel('');
  }

  const gate = useMoneyOutOtp({
    perform: async (extra) => {
      const result = await portalApi.sendMerchantPayout(communityId, request, extra);
      // Saved only after the money actually moved. Saving first would leave a
      // payee behind from a transfer the owner declined to approve.
      if (savePayee) {
        await portalApi
          .saveMerchantBeneficiary(communityId, {
            type: kind,
            displayName: payeeLabel.trim() || (kind === 'BANK' ? accountName : recipient!.name),
            ...(kind === 'BANK'
              ? { bankCode, bankName: bank?.bankName, accountNumber, accountName }
              : { recipientUserId: recipient!.userId, vistaTag: identifier.trim() || undefined }),
          })
          .catch(() => toast('Payment sent, but the payee was not saved', 'info'));
      }
      return result;
    },
    onDone: async () => {
      clearForm();
      await onSent();
    },
    successMessage: 'Sent — the payment is on its way',
  });

  return (
    <>
      <Card>
        <CardHeader
          title="Send money out"
          subtitle="From the merchant Wallet to a bank account, or to another Rendi user"
        />

        <div className="space-y-5 p-5">
          <Segmented
            label="Where the money is going"
            value={kind}
            onChange={(next) => {
              setKind(next);
              setQuote(null);
              setBeneficiaryId('');
            }}
            options={[
              {
                value: 'BANK',
                label: (
                  <span className="inline-flex items-center gap-1.5">
                    <Landmark className="h-3.5 w-3.5" /> Bank account
                  </span>
                ),
              },
              {
                value: 'VISTA',
                label: (
                  <span className="inline-flex items-center gap-1.5">
                    <UserRound className="h-3.5 w-3.5" /> Rendi user
                  </span>
                ),
              },
            ]}
          />

          {beneficiaries.length > 0 && (
            <Field label="Saved payee" optional hint="Or enter the details below">
              <Select
                value={beneficiaryId}
                onChange={(event) => pickBeneficiary(event.target.value)}
              >
                <option value="">Someone new</option>
                {beneficiaries.map((payee) => (
                  <option key={payee.id} value={payee.id}>
                    {payee.isFavourite ? '★ ' : ''}
                    {payee.displayName} · {payee.subtitle}
                  </option>
                ))}
              </Select>
            </Field>
          )}

          {kind === 'BANK' ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Bank" required>
                <Select value={bankKey} onChange={(event) => setBankKey(event.target.value)}>
                  <option value="">Choose a bank</option>
                  {(banks ?? []).map((option) => (
                    <option key={bankKeyOf(option)} value={bankKeyOf(option)}>
                      {option.bankName}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field
                label="Account number"
                required
                hint="Ten digits"
                error={resolveError ?? undefined}
              >
                <Input
                  inputMode="numeric"
                  maxLength={10}
                  value={accountNumber}
                  onChange={(event) =>
                    setAccountNumber(event.target.value.replace(/\D/g, '').slice(0, 10))
                  }
                  placeholder="0123456789"
                />
              </Field>
              {/* The confirmed name, never editable. An officer who can type
                  over it can make the record say anything. */}
              <div className="sm:col-span-2">
                {resolving ? (
                  <p className="text-[13px] text-slate-500">Confirming the account name…</p>
                ) : accountName ? (
                  <p className="inline-flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-[13px] font-semibold text-emerald-800">
                    <BadgeCheck className="h-4 w-4" /> {accountName}
                  </p>
                ) : (
                  <p className="text-[13px] text-slate-500">
                    The account name appears here once the bank confirms it.
                  </p>
                )}
              </div>
            </div>
          ) : (
            <Field
              label="Rendi account"
              required
              hint="A tag, email or phone number"
              error={resolveError ?? undefined}
            >
              <Input
                value={identifier}
                onChange={(event) => setIdentifier(event.target.value)}
                placeholder="@member.vista"
              />
              {resolving ? (
                <p className="mt-2 text-[13px] text-slate-500">Looking that up…</p>
              ) : recipient ? (
                <p className="mt-2 inline-flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-[13px] font-semibold text-emerald-800">
                  <BadgeCheck className="h-4 w-4" /> {recipient.name}
                </p>
              ) : null}
            </Field>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Amount"
              required
              hint={
                availableBalance !== null
                  ? `${money(availableBalance, currencyCode)} available`
                  : undefined
              }
              error={overBalance ? 'More than the merchant Wallet holds' : undefined}
            >
              <AmountInput
                value={amount}
                onChange={(next) => {
                  setAmount(next);
                  setQuote(null);
                }}
                invalid={overBalance}
              />
            </Field>
            <Field
              label="Settles an expense"
              optional
              hint="Marks an approved bill as paid and posts it to its own account"
            >
              <Select value={expenseId} onChange={(event) => setExpenseId(event.target.value)}>
                <option value="">Not linked to an expense</option>
                {(expenses ?? []).map((expense) => (
                  <option key={expense.id} value={expense.id}>
                    {expense.reference} · {expense.payee} · {money(expense.amount)}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <Field
            label="What is this payment for"
            required
            hint="Recorded against the transaction and shown in the books — at least four characters"
          >
            <Textarea
              rows={2}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="August generator diesel, paid to Okafor Ventures"
            />
          </Field>

          {/* Where this lands in the books.
              Defaulted rather than demanded: most payments are an ordinary
              expense, and an officer who knows the payment belongs somewhere
              more specific can say so — or create the account here without
              leaving the form. Before this, a transfer out was the one money
              movement that posted nowhere until somebody classified it after
              the fact.

              Hidden entirely when the payment settles a recorded bill: that
              bill was coded to an account when it was raised, and offering
              the choice again invites a second, different answer for the
              same expense. */}
          {selectedExpense ? (
            <Callout tone="info" title="Posted to the expense's own account">
              {selectedExpense.reference} · {selectedExpense.payee} is already coded to{' '}
              <span className="font-mono font-semibold">{selectedExpense.accountCode}</span> ·{' '}
              {selectedExpense.accountName}. Paying it here posts it there and marks the bill
              paid — there is nothing left to classify.
            </Callout>
          ) : (
            <div className="rounded-xl border border-slate-200 p-4">
              <AccountSelector
                selection="MERCHANT_MONEY_OUT"
                value={coaChoice}
                onChange={setCoaChoice}
                idPrefix="payout"
              />
            </div>
          )}

          {!beneficiaryId && destinationReady && (
            <div className="space-y-3 rounded-xl bg-slate-50 p-4">
              <Checkbox
                checked={savePayee}
                onChange={setSavePayee}
                label="Save this payee for next time"
                description="Saved against the community, so it survives a change of treasurer"
              />
              {savePayee && (
                <Field label="Call them" optional>
                  <Input
                    value={payeeLabel}
                    onChange={(event) => setPayeeLabel(event.target.value)}
                    placeholder={kind === 'BANK' ? accountName : (recipient?.name ?? '')}
                  />
                </Field>
              )}
            </div>
          )}

          {quote && (
            <Callout tone="info" title="What this will cost">
              <dl className="grid grid-cols-2 gap-y-1 text-[13px]">
                <dt className="text-slate-600">Amount</dt>
                <dd className="tnum text-right font-semibold">
                  {money(quote.amount, currencyCode)}
                </dd>
                <dt className="text-slate-600">Charge</dt>
                <dd className="tnum text-right font-semibold">
                  {money(quote.feeAmount, currencyCode)}
                </dd>
                <dt className="font-semibold text-navy-900">Total out of the account</dt>
                <dd className="tnum text-right font-bold text-navy-900">
                  {money(quote.totalDebit, currencyCode)}
                </dd>
              </dl>
              {quote.note && <p className="mt-2 text-[12.5px] text-slate-600">{quote.note}</p>}
            </Callout>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="secondary"
              disabled={!ready || quoting}
              loading={quoting}
              onClick={() => void getQuote()}
            >
              What will it cost?
            </Button>
            <Button
              icon={<ArrowUpRight className="h-4 w-4" />}
              disabled={!ready || overBalance || gate.pending}
              loading={gate.pending}
              onClick={() => void gate.run()}
            >
              Send payment
            </Button>
            <p className="text-[12.5px] text-slate-500">
              The owner approves this with a code before it leaves.
            </p>
          </div>
        </div>
      </Card>

      <MoneyOutOtpDialog gate={gate} />
    </>
  );
}

/** A saved payee row, used by the payees tab. */
export function BeneficiaryRow({
  payee,
  onToggleFavourite,
  onRemove,
  busy,
}: {
  payee: MerchantBeneficiary;
  onToggleFavourite: () => void;
  onRemove: () => void;
  busy: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 px-5 py-4">
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
          payee.type === 'BANK' ? 'bg-navy-50 text-navy-700' : 'bg-brand-50 text-brand-700'
        }`}
      >
        {payee.type === 'BANK' ? (
          <Landmark className="h-4 w-4" />
        ) : (
          <UserRound className="h-4 w-4" />
        )}
      </span>
      <div className="min-w-[180px] flex-1">
        <p className="font-medium text-navy-900">{payee.displayName}</p>
        <p className="tnum text-xs text-slate-500">{payee.subtitle}</p>
        {payee.note && <p className="mt-0.5 text-xs text-slate-400">{payee.note}</p>}
      </div>
      <button
        type="button"
        onClick={onToggleFavourite}
        disabled={busy}
        aria-label={payee.isFavourite ? 'Remove from favourites' : 'Mark as favourite'}
        className={`rounded-lg p-2 transition ${
          payee.isFavourite
            ? 'text-amber-500 hover:bg-amber-50'
            : 'text-slate-300 hover:bg-slate-50 hover:text-slate-400'
        }`}
      >
        <Star className="h-4 w-4" fill={payee.isFavourite ? 'currentColor' : 'none'} />
      </button>
      <Button variant="ghost" size="sm" disabled={busy} onClick={onRemove}>
        Remove
      </Button>
    </div>
  );
}
