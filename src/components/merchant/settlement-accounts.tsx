"use client";

import { useState } from "react";
import { BadgeCheck, Landmark, Plus, Trash2 } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  Checkbox,
  ConfirmDialog,
  DataTable,
  EmptyState,
  Field,
  Input,
  Modal,
  Select,
} from "@/components/ui";
import { useCommunityId } from "@/components/providers/session-provider";
import { useToast } from "@/components/providers/toast-provider";
import { useQuery } from "@/hooks/use-query";
import { MoneyOutOtpDialog, useMoneyOutOtp } from "@/components/money-out-otp";
import { useDebounced } from "@/hooks/use-debounced";
import { portalApi } from "@/services/portal";
import { date } from "@/lib/format";
import type { BankOption, MerchantSettlementAccount } from "@/types";

/**
 * A merchant's own bank accounts.
 *
 * NOT RENDERED TODAY, on purpose. Nothing consumes a community settlement
 * account: WithdrawalsService handles personal and business wallets only, and
 * its allowlist check is gated on `businessId`, so there is no
 * community-to-bank payout path for these details to feed. Collecting a bank
 * account into a table no code reads is worse than not collecting it.
 *
 * It lives in its own file rather than commented out inside the overview so it
 * stays type-checked and linted, and re-enabling is one import plus one line
 * in merchant-client.tsx. The API endpoints behind it are live and are what the
 * business settings screen already uses.
 */
export function SettlementAccountsCard({
  accounts,
  onChanged,
}: {
  accounts: MerchantSettlementAccount[];
  onChanged: () => void | Promise<void>;
}) {
  const communityId = useCommunityId();
  const [addOpen, setAddOpen] = useState(false);
  const [removing, setRemoving] = useState<MerchantSettlementAccount | null>(
    null,
  );

  /**
   * Every action here is owner-approved, because each one decides where the
   * community's money goes when it leaves Rendi.
   *
   * Through the gate rather than a plain mutation: the API answers the first
   * call with a 428 and a challenge, and a plain mutation would surface that
   * as an error toast with nowhere to type the code — a button that looks
   * like it works and never does.
   */
  const makeDefault = useMoneyOutOtp<string>({
    perform: (extra, accountId) =>
      portalApi.makeSettlementAccountDefault(communityId, accountId, extra),
    onDone: onChanged,
    successMessage: "Default payout account updated",
  });

  const remove = useMoneyOutOtp<string>({
    perform: (extra, accountId) =>
      portalApi.removeSettlementAccount(communityId, accountId, extra),
    onDone: async () => {
      setRemoving(null);
      await onChanged();
    },
    successMessage: "Payout account removed",
  });

  return (
    <>
      <Card>
        <CardHeader
          title="Settlement accounts"
          subtitle="The community’s own bank accounts — where its money goes when it leaves Rendi."
          action={
            <Button
              variant="secondary"
              onClick={() => setAddOpen(true)}
              icon={<Plus className="h-4 w-4" />}
            >
              Add account
            </Button>
          }
        />
        {accounts.length === 0 ? (
          <EmptyState
            icon={<Landmark className="h-5 w-5" />}
            title="No settlement account yet"
            body="Add the community’s own bank account so collected money can be paid out to it."
            action={
              <Button
                onClick={() => setAddOpen(true)}
                icon={<Plus className="h-4 w-4" />}
              >
                Add account
              </Button>
            }
          />
        ) : (
          <DataTable
            rows={accounts}
            rowKey={(a) => a.id}
            columns={[
              {
                key: "bank",
                header: "Bank",
                cell: (a) => (
                  <div className="min-w-0">
                    <p className="truncate font-medium text-navy-900">
                      {a.bankName}
                    </p>
                    <p className="tnum text-xs text-slate-500">
                      {a.accountNumber}
                    </p>
                  </div>
                ),
              },
              {
                key: "name",
                header: "Account name",
                cell: (a) => a.accountName,
              },
              {
                key: "default",
                header: "Default",
                cell: (a) =>
                  a.isDefault ? (
                    <Badge tone="green" dot>
                      Default
                    </Badge>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void makeDefault.run(a.id)}
                      loading={makeDefault.pending}
                    >
                      Make default
                    </Button>
                  ),
              },
              { key: "added", header: "Added", cell: (a) => date(a.createdAt) },
              {
                key: "actions",
                header: "",
                cell: (a) => (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setRemoving(a)}
                    icon={<Trash2 className="h-4 w-4" />}
                    aria-label={`Remove ${a.bankName} ${a.accountNumber}`}
                  />
                ),
              },
            ]}
          />
        )}
      </Card>

      <MoneyOutOtpDialog gate={makeDefault} />
      <MoneyOutOtpDialog gate={remove} />

      <AddSettlementAccountModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        hasExisting={accounts.length > 0}
        onSaved={async () => {
          setAddOpen(false);
          await onChanged();
        }}
      />

      <ConfirmDialog
        open={Boolean(removing)}
        onClose={() => setRemoving(null)}
        title="Remove this settlement account?"
        body={
          removing
            ? `${removing.bankName} · ${removing.accountNumber}. Payouts will no longer be able to go to it.`
            : ""
        }
        confirmLabel="Remove"
        tone="danger"
        loading={remove.pending}
        onConfirm={() => {
          if (removing) void remove.run(removing.id);
        }}
      />
    </>
  );
}

function AddSettlementAccountModal({
  open,
  onClose,
  hasExisting,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  hasExisting: boolean;
  onSaved: () => void | Promise<void>;
}) {
  const communityId = useCommunityId();
  // Composite key, not the bare code: the provider's list has five codes
  // shared by two differently-named banks, three of them genuinely different.
  const [bankKey, setBankKey] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [isDefault, setIsDefault] = useState(!hasExisting);

  const { data: banks } = useQuery<BankOption[]>(
    () => portalApi.bankList(),
    [],
  );
  const bankKeyOf = (option: BankOption) =>
    `${option.bankCode}::${option.bankName}`;
  const bank = banks?.find((option) => bankKeyOf(option) === bankKey) ?? null;

  const nubanValid = /^\d{10}$/.test(accountNumber);
  const debouncedAccountNumber = useDebounced(accountNumber, 500);

  /**
   * The account name comes from the bank, never from the keyboard.
   *
   * It used to be typed, with a hint saying it had to match "exactly as the
   * bank holds it" — which is a rule a form can enforce instead of asking a
   * person to satisfy. A mismatch is what makes the provider reject the
   * registration, and an officer has no way to check their own spelling.
   */
  const lookupReady =
    nubanValid && debouncedAccountNumber === accountNumber && !!bank;
  const lookup = useQuery(
    async () => ({
      accountNumber: debouncedAccountNumber,
      bankCode: bank!.bankCode,
      ...(await portalApi.resolveBankAccount({
        accountNumber: debouncedAccountNumber,
        bankCode: bank!.bankCode,
      })),
    }),
    [debouncedAccountNumber, bank?.bankCode],
    { enabled: lookupReady },
  );
  const resolved =
    lookupReady &&
    lookup.data?.accountNumber === debouncedAccountNumber &&
    lookup.data?.bankCode === bank?.bankCode
      ? lookup.data
      : null;
  const accountName = resolved?.accountName ?? "";
  const resolving = lookupReady && !resolved && !lookup.error;

  const save = useMoneyOutOtp({
    perform: (extra) =>
      portalApi.addSettlementAccount(
        communityId,
        {
          bankName: bank!.bankName,
          bankCode: bank!.bankCode,
          accountNumber,
          accountName,
          isDefault,
        },
        extra,
      ),
    onDone: async () => {
      setBankKey("");
      setAccountNumber("");
      await onSaved();
    },
    successMessage: "Payout account added",
  });

  const complete = Boolean(bank && nubanValid && accountName && !resolving);

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title="Add a settlement account"
        description="The community’s own bank account — where its money goes when it leaves Rendi."
        footer={
          <>
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={() => void save.run()}
              loading={save.pending}
              disabled={!complete}
            >
              Add account
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Bank" required>
            <Select
              value={bankKey}
              onChange={(e) => setBankKey(e.target.value)}
            >
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
            error={
              (accountNumber && !nubanValid
                ? "A NUBAN is exactly 10 digits"
                : undefined) ??
              lookup.error ??
              undefined
            }
          >
            <Input
              value={accountNumber}
              onChange={(e) =>
                setAccountNumber(e.target.value.replace(/\D/g, "").slice(0, 10))
              }
              inputMode="numeric"
              placeholder="0123456789"
              className="tnum"
            />
          </Field>
          {/* Confirmed, never editable: an officer who can type over the name
            can make the registration say anything. */}
          {resolving ? (
            <p className="text-[13px] text-slate-500">
              Confirming the account name…
            </p>
          ) : accountName ? (
            <p className="inline-flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-[13px] font-semibold text-emerald-800">
              <BadgeCheck className="h-4 w-4" /> {accountName}
            </p>
          ) : (
            <p className="text-[13px] text-slate-500">
              The account name appears here once the bank confirms it.
            </p>
          )}
          <Checkbox
            checked={isDefault}
            onChange={setIsDefault}
            label="Make this the default"
            description="The default is what merchant registration settles to."
          />
        </div>
      </Modal>

      {/* Sibling, not child: both portal to the body at the same depth, and
          the one mounted later stacks on top — so the code prompt appears
          over the form rather than behind it. */}
      <MoneyOutOtpDialog gate={save} />
    </>
  );
}
