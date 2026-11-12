'use client';

import { useMemo, useState } from 'react';
import { ArchiveRestore } from 'lucide-react';
import { Button, Callout, Field, Input, Modal, Select, Textarea } from '@/components/ui';
import { MoneyOutOtpDialog, useMoneyOutOtp } from '@/components/money-out-otp';
import { useCommunityId } from '@/components/providers/session-provider';
import { useQuery } from '@/hooks/use-query';
import { portalApi } from '@/services/portal';
import type { LoanProduct, MemberDetail, SavingsProduct } from '@/types';

type Kind = 'SAVINGS' | 'LOAN';
type Form = {
  kind: Kind;
  productId: string;
  amount: string;
  outstanding: string;
  openedOn: string;
  dueOn: string;
  legacyReference: string;
  note: string;
};

const initial: Form = {
  kind: 'SAVINGS',
  productId: '',
  amount: '',
  outstanding: '',
  openedOn: '',
  dueOn: '',
  legacyReference: '',
  note: '',
};

export function RecordOpeningBalance({
  member,
  onRecorded,
}: {
  member: MemberDetail;
  onRecorded: () => void | Promise<void>;
}) {
  const communityId = useCommunityId();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Form>(initial);
  const savings = useQuery<SavingsProduct[]>(() => portalApi.savingsProducts(communityId), [communityId]);
  const loans = useQuery<LoanProduct[]>(() => portalApi.loanProducts(communityId), [communityId]);
  const products = useMemo(
    () => (form.kind === 'SAVINGS' ? savings.data ?? [] : loans.data ?? []),
    [form.kind, savings.data, loans.data],
  );

  const gate = useMoneyOutOtp<Form>({
    perform: (extra, payload) =>
      portalApi.recordMemberOpening(
        communityId,
        member.id,
        {
          kind: payload.kind,
          productId: payload.productId,
          amount: payload.amount,
          ...(payload.kind === 'LOAN' && { outstanding: payload.outstanding || payload.amount }),
          ...(payload.openedOn && { openedOn: payload.openedOn }),
          ...(payload.kind === 'LOAN' && payload.dueOn && { dueOn: payload.dueOn }),
          ...(payload.legacyReference && { legacyReference: payload.legacyReference }),
          ...(payload.note && { note: payload.note }),
        },
        extra,
      ),
    onDone: async () => {
      setOpen(false);
      setForm(initial);
      await onRecorded();
    },
    successMessage: 'Historical record added and approved',
  });

  const valid =
    Boolean(form.productId) &&
    Number(form.amount) > 0 &&
    (form.kind === 'SAVINGS' || !form.outstanding || Number(form.outstanding) >= 0);

  const update = (patch: Partial<Form>) => setForm((current) => ({ ...current, ...patch }));

  return (
    <>
      <Button variant="secondary" icon={<ArchiveRestore className="h-4 w-4" />} onClick={() => setOpen(true)}>
        Record existing balance
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={`Record previous balance for ${member.name}`}
        description="Bring a member's balance from paper or another system into Rendi without pretending it was a new payment."
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={gate.pending}>Cancel</Button>
            <Button onClick={() => void gate.run(form)} loading={gate.pending} disabled={!valid}>
              Send for owner approval
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Callout tone="info" title="Controlled opening record">
            The owner approves the exact member, product, amount and dates. Rendi records an audit trail and posts the matching opening entry to the community books.
          </Callout>

          <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1">
            {(['SAVINGS', 'LOAN'] as Kind[]).map((kind) => (
              <button
                key={kind}
                type="button"
                onClick={() => update({ kind, productId: '', outstanding: '', dueOn: '' })}
                className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${form.kind === kind ? 'bg-white text-navy-900 shadow-sm' : 'text-slate-600 hover:text-navy-900'}`}
              >
                {kind === 'SAVINGS' ? 'Savings balance' : 'Outstanding loan'}
              </button>
            ))}
          </div>

          <Field label={`${form.kind === 'SAVINGS' ? 'Savings' : 'Loan'} product`} required>
            <Select value={form.productId} onChange={(event) => update({ productId: event.target.value })}>
              <option value="">Choose a product</option>
              {products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
            </Select>
          </Field>
          {products.length === 0 && (
            <Callout tone="warning" title={`No ${form.kind.toLowerCase()} products yet`}>
              Create the product first so this balance has the correct terms and chart-of-account classification.
            </Callout>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={form.kind === 'SAVINGS' ? 'Opening balance' : 'Original principal'} required>
              <Input type="number" min="0.01" step="0.01" prefix="NGN" value={form.amount} onChange={(event) => update({ amount: event.target.value })} />
            </Field>
            {form.kind === 'LOAN' && (
              <Field label="Still outstanding" required hint="Leave blank if none has been repaid.">
                <Input type="number" min="0" step="0.01" prefix="NGN" value={form.outstanding} onChange={(event) => update({ outstanding: event.target.value })} />
              </Field>
            )}
            <Field label="Original start date" optional>
              <Input type="date" value={form.openedOn} onChange={(event) => update({ openedOn: event.target.value })} />
            </Field>
            {form.kind === 'LOAN' && (
              <Field label="Due date" optional>
                <Input type="date" min={form.openedOn || undefined} value={form.dueOn} onChange={(event) => update({ dueOn: event.target.value })} />
              </Field>
            )}
          </div>

          <Field label="Old-system reference" optional hint="Receipt, passbook, spreadsheet or loan reference.">
            <Input value={form.legacyReference} maxLength={120} onChange={(event) => update({ legacyReference: event.target.value })} />
          </Field>
          <Field label="Officer note" optional>
            <Textarea value={form.note} maxLength={300} onChange={(event) => update({ note: event.target.value })} placeholder="Where this record was verified from" />
          </Field>
        </div>
      </Modal>
      <MoneyOutOtpDialog gate={gate} />
    </>
  );
}
