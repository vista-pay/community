'use client';

import { useState } from 'react';
import { BadgeCheck, Building2, FileCheck2, ShieldAlert } from 'lucide-react';
import {
  Badge,
  Button,
  Callout,
  Card,
  CardHeader,
  Field,
  Input,
  KV,
  PageHeader,
  Select,
  Tabs,
  Textarea,
} from '@/components/ui';
import { useMutation } from '@/hooks/use-query';
import { MoneyOutOtpDialog, useMoneyOutOtp } from '@/components/money-out-otp';
import { useCan, useCommunityId } from '@/components/providers/session-provider';
import { useToast } from '@/components/providers/toast-provider';
import { portalApi } from '@/services/portal';
import { ORG_CATEGORIES } from '@/data/catalog';
import { date } from '@/lib/format';
import { uploadImage } from '@/lib/upload';
import type { CommunityPolicy, CommunityPolicyArea } from '@/types';

interface Community {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string | null;
  country: string;
  city: string | null;
  category: string | null;
  registrationNumber: string | null;
  status: 'PENDING' | 'VERIFIED' | 'SUSPENDED' | 'REJECTED';
  isDiscoverable: boolean;
  organizerFeesEnabled: boolean;
  verifiedAt: string | null;
  rejectionReason: string | null;
}

type Tab = 'profile' | 'policies' | 'verification';

const POLICY_COPY: Record<CommunityPolicyArea, { title: string; description: string; placeholder: string }> = {
  JOINING: { title: 'Joining the community', description: 'Eligibility, required documents, joining fees, approval and exit rules.', placeholder: 'Who can join, documents required, joining fee, approval timeline, exit conditions…' },
  CONTRIBUTIONS: { title: 'Contributions', description: 'Amounts, frequency, due dates, grace periods, fees and missed-payment handling.', placeholder: 'Contribution schedule, payment deadline, grace period, late fee, refunds…' },
  SAVINGS: { title: 'Savings', description: 'Deposits, withdrawals, notice periods, interest and account closure.', placeholder: 'Minimum balance, withdrawal notice, interest calculation, closure rules…' },
  LOANS: { title: 'Loans', description: 'Eligibility, limits, guarantors, pricing, approval, repayment and default.', placeholder: 'Eligibility period, maximum loan, guarantors, interest, tenor, default actions…' },
  WELFARE: { title: 'Welfare', description: 'Eligible needs, evidence, limits, review stages and payout conditions.', placeholder: 'Covered situations, evidence required, support cap, review and payment process…' },
  OPPORTUNITIES: { title: 'Opportunities', description: 'Eligibility, selection, fees, deadlines and participant obligations.', placeholder: 'Who qualifies, how selection works, closing dates, fees and participation rules…' },
};

type PolicyRuleField = {
  key: string;
  label: string;
  help: string;
  type: 'number' | 'boolean' | 'kyc';
  suffix?: string;
};

const POLICY_RULE_FIELDS: Record<CommunityPolicyArea, PolicyRuleField[]> = {
  JOINING: [
    { key: 'minimumAge', label: 'Minimum age', help: 'Leave blank for no age restriction.', type: 'number', suffix: 'years' },
    { key: 'joiningFee', label: 'Joining fee', help: 'One-time amount charged to an approved applicant.', type: 'number', suffix: 'NGN' },
    { key: 'requiredKycTier', label: 'Required KYC tier', help: 'Identity level required before admission.', type: 'kyc' },
    { key: 'refereeRequired', label: 'Referee required', help: 'Require an existing member or referee.', type: 'boolean' },
    { key: 'approvalRequired', label: 'Officer approval', help: 'Applications must be reviewed by an officer.', type: 'boolean' },
  ],
  CONTRIBUTIONS: [
    { key: 'minimumMembershipMonths', label: 'Membership period', help: 'Months a member must be active before joining.', type: 'number', suffix: 'months' },
    { key: 'minimumContribution', label: 'Minimum contribution', help: 'Lowest permitted contribution amount.', type: 'number', suffix: 'NGN' },
    { key: 'gracePeriodDays', label: 'Payment grace period', help: 'Days allowed after a contribution is due.', type: 'number', suffix: 'days' },
    { key: 'lateFee', label: 'Late fee', help: 'Fee charged after the grace period.', type: 'number', suffix: 'NGN' },
    { key: 'advancePaymentAllowed', label: 'Advance payment', help: 'Allow members to pay future periods early.', type: 'boolean' },
  ],
  SAVINGS: [
    { key: 'minimumMembershipMonths', label: 'Membership period', help: 'Months active before opening savings.', type: 'number', suffix: 'months' },
    { key: 'minimumOpeningBalance', label: 'Opening balance', help: 'Minimum first deposit.', type: 'number', suffix: 'NGN' },
    { key: 'minimumBalance', label: 'Minimum retained balance', help: 'Balance that must remain after withdrawal.', type: 'number', suffix: 'NGN' },
    { key: 'withdrawalNoticeDays', label: 'Withdrawal notice', help: 'Notice required before funds can be released.', type: 'number', suffix: 'days' },
    { key: 'maximumWithdrawalsPerMonth', label: 'Monthly withdrawals', help: 'Maximum withdrawals allowed each month.', type: 'number' },
  ],
  LOANS: [
    { key: 'minimumMembershipMonths', label: 'Active membership', help: 'Months a member must be active before applying.', type: 'number', suffix: 'months' },
    { key: 'minimumSavingsBalance', label: 'Minimum savings balance', help: 'Savings required to qualify.', type: 'number', suffix: 'NGN' },
    { key: 'minimumContributionMonths', label: 'Contribution history', help: 'Minimum paid contribution periods.', type: 'number', suffix: 'periods' },
    { key: 'maxLoanToSavingsRatio', label: 'Loan-to-savings limit', help: 'Maximum loan as a multiple of savings.', type: 'number', suffix: '× savings' },
    { key: 'maximumActiveLoans', label: 'Active loan limit', help: 'Maximum simultaneous active loans.', type: 'number' },
    { key: 'guarantorsRequired', label: 'Required guarantors', help: 'Minimum guarantors per application.', type: 'number' },
    { key: 'requiredKycTier', label: 'Required KYC tier', help: 'Identity level required to apply.', type: 'kyc' },
    { key: 'noOverdueContributions', label: 'Contribution standing', help: 'Block applications with overdue contributions.', type: 'boolean' },
  ],
  WELFARE: [
    { key: 'minimumMembershipMonths', label: 'Active membership', help: 'Months active before requesting welfare.', type: 'number', suffix: 'months' },
    { key: 'minimumContributionMonths', label: 'Contribution history', help: 'Minimum paid contribution periods.', type: 'number', suffix: 'periods' },
    { key: 'maximumClaimAmount', label: 'Maximum claim', help: 'Largest welfare request permitted.', type: 'number', suffix: 'NGN' },
    { key: 'coolingOffDays', label: 'Cooling-off period', help: 'Days before another approved claim.', type: 'number', suffix: 'days' },
    { key: 'evidenceRequired', label: 'Supporting evidence', help: 'Require documents before review.', type: 'boolean' },
  ],
  OPPORTUNITIES: [
    { key: 'minimumMembershipMonths', label: 'Active membership', help: 'Months active before applying.', type: 'number', suffix: 'months' },
    { key: 'minimumSavingsBalance', label: 'Minimum savings balance', help: 'Savings required to participate.', type: 'number', suffix: 'NGN' },
    { key: 'requiredKycTier', label: 'Required KYC tier', help: 'Identity level required to participate.', type: 'kyc' },
    { key: 'approvalRequired', label: 'Officer approval', help: 'Applications require officer approval.', type: 'boolean' },
  ],
};

export function SettingsClient({ community, initialPolicies }: { community: Community; initialPolicies: CommunityPolicy[] }) {
  const communityId = useCommunityId();
  // Read-only for an officer without write access. The form used to look
  // editable and only refuse on save, which wasted the typing and read as a
  // bug rather than a permission.
  const canEdit = useCan()('community', 'write');
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>('profile');

  const [name, setName] = useState(community.name);
  const [phone, setPhone] = useState(community.phone);
  const [address, setAddress] = useState(community.address ?? '');
  const [city, setCity] = useState(community.city ?? '');
  const [category, setCategory] = useState(community.category ?? '');
  const [registrationNumber, setRegistrationNumber] = useState(community.registrationNumber ?? '');
  const [verificationFile, setVerificationFile] = useState<File | null>(null);
  const [policies, setPolicies] = useState(initialPolicies);

  const updatePolicyRule = (
    area: CommunityPolicyArea,
    key: string,
    value: string | number | boolean | undefined,
  ) => {
    setPolicies((current) =>
      current.map((policy) => {
        if (policy.area !== area) return policy;
        const rules = { ...policy.rules };
        if (value === undefined || value === '') delete rules[key];
        else rules[key] = value;
        return { ...policy, rules };
      }),
    );
  };

  const save = useMutation(
    () =>
      portalApi.updateCommunity(communityId, {
        name: name.trim(),
        phone: phone.trim(),
        address: address.trim() || undefined,
        city: city.trim() || undefined,
        category: category.trim() || undefined,
        registrationNumber: registrationNumber.trim() || undefined,
      }),
    {
      onSuccess: () => toast('Saved', 'success'),
      onError: (message) => toast('Could not save', 'error', message),
    },
  );

  const submitEvidence = useMutation(
    async () => {
      if (!verificationFile) throw new Error('Choose an image or PDF to upload');
      if (verificationFile.size > 10 * 1024 * 1024) throw new Error('The file must be 10 MB or smaller');
      const fileUrl = await uploadImage(verificationFile, 'community-documents');
      return portalApi.addDocument(communityId, {
        name: community.rejectionReason?.split(':')[0] || verificationFile.name,
        category: 'FORMS',
        visibility: 'OFFICERS',
        fileUrl,
        sizeBytes: verificationFile.size,
      });
    },
    {
      onSuccess: () => {
        setVerificationFile(null);
        toast('Verification document submitted', 'success', 'Vista administrators can now review it.');
      },
      onError: (message) => toast('Could not upload the document', 'error', message),
    },
  );

  const savePolicy = useMoneyOutOtp<CommunityPolicy>({
    perform: (extra, policy) =>
      portalApi.updatePolicy(
        communityId,
        {
          area: policy.area,
          content: policy.content,
          rules: policy.rules,
          isPublished: policy.isPublished,
        },
        extra,
      ),
    onDone: async () => {
      // Reload every policy after approval so the saved version, visibility
      // and server-normalised rules replace the draft without losing the
      // other cards the officer may still be editing.
      setPolicies(await portalApi.policies(communityId));
    },
    successMessage: 'Policy saved',
  });

  return (
    <>
      <PageHeader
        title="Settings"
        subtitle="Your community's profile and its standing with Rendi"
        actions={
          tab === 'profile' && canEdit ? (
            <Button loading={save.pending} onClick={() => void save.run()}>
              Save changes
            </Button>
          ) : null
        }
      />

      {!canEdit && tab === 'profile' ? (
        <Callout
          tone="info"
          className="mb-4"
          title="You can view these details but not change them"
        >
          Editing the community profile needs the &apos;write&apos; permission on
          &apos;community&apos;. An admin of this community can grant it under Staff &amp; roles.
        </Callout>
      ) : null}

      <Tabs
        value={tab}
        onChange={setTab}
        className="mb-4"
        tabs={[
          { value: 'profile', label: 'Profile' },
          { value: 'policies', label: 'Service policies' },
          { value: 'verification', label: 'Verification' },
        ]}
      />

      {tab === 'profile' ? (
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader title="Community details" />
            <div className="space-y-4 px-5 py-4">
              {save.error && <Callout tone="danger">{save.error}</Callout>}

              <Field label="Name" htmlFor="se-name" required>
                <Input id="se-name" value={name} onChange={(e) => setName(e.target.value)} disabled={!canEdit} />
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Email"
                  htmlFor="se-email"
                  hint="Changing this needs Rendi support — it identifies the community"
                >
                  <Input id="se-email" value={community.email} disabled />
                </Field>
                <Field label="Phone" htmlFor="se-phone" required>
                  <Input id="se-phone" value={phone} onChange={(e) => setPhone(e.target.value)} disabled={!canEdit} />
                </Field>
              </div>

              <Field label="Address" htmlFor="se-address" optional>
                <Textarea
                  id="se-address"
                  rows={2}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="City" htmlFor="se-city" optional>
                  <Input id="se-city" value={city} onChange={(e) => setCity(e.target.value)} disabled={!canEdit} />
                </Field>
                <Field label="Category" htmlFor="se-cat" optional>
                  <Select id="se-cat" value={category} onChange={(e) => setCategory(e.target.value)} disabled={!canEdit}>
                    <option value="">Not set</option>
                    {ORG_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>

              <Field
                label="Registration number"
                htmlFor="se-reg"
                optional
                hint="CAC or state cooperative registration, if you have one"
              >
                <Input
                  id="se-reg"
                  value={registrationNumber}
                  onChange={(e) => setRegistrationNumber(e.target.value)}
                />
              </Field>
            </div>
          </Card>

          <Card className="h-fit">
            <CardHeader title="At a glance" />
            <dl className="space-y-3 px-5 py-4">
              <KV label="Status">
                <Badge tone={community.status === 'VERIFIED' ? 'green' : 'amber'}>
                  {community.status.toLowerCase()}
                </Badge>
              </KV>
              <KV label="Listed in Discover">{community.isDiscoverable ? 'Yes' : 'No'}</KV>
              <KV label="Organizer fees">
                {community.organizerFeesEnabled ? 'Permitted by Rendi' : 'Not permitted'}
              </KV>
              <KV label="Country">{community.country}</KV>
            </dl>
          </Card>
        </div>
      ) : tab === 'policies' ? (
        <div className="space-y-4">
          <Callout tone="info" title="Policies make every service predictable">
            Publish the rules members should see before joining or using a service. Drafts remain visible only to officers.
          </Callout>
          <div className="grid gap-5 lg:grid-cols-2">
            {policies.map((policy) => {
              const copy = POLICY_COPY[policy.area];
              const rules = policy.rules ?? {};
              return (
                <Card key={policy.area}>
                  <CardHeader
                    title={copy.title}
                    subtitle={copy.description}
                    action={<Badge tone={policy.isPublished ? 'green' : 'slate'}>{policy.isPublished ? 'Published' : 'Draft'}</Badge>}
                  />
                  <div className="space-y-4 px-5 pb-5">
                    <div>
                      <p className="label">Eligibility and operating rules</p>
                      <div className="mt-2 grid gap-3 sm:grid-cols-2">
                        {POLICY_RULE_FIELDS[policy.area].map((rule) => (
                          <Field
                            key={rule.key}
                            label={rule.label}
                            htmlFor={`policy-${policy.area}-${rule.key}`}
                            hint={rule.help}
                          >
                            {rule.type === 'boolean' ? (
                              <Select
                                id={`policy-${policy.area}-${rule.key}`}
                                value={
                                  typeof rules[rule.key] === 'boolean'
                                    ? String(rules[rule.key])
                                    : ''
                                }
                                disabled={!canEdit}
                                onChange={(event) =>
                                  updatePolicyRule(
                                    policy.area,
                                    rule.key,
                                    event.target.value === ''
                                      ? undefined
                                      : event.target.value === 'true',
                                  )
                                }
                              >
                                <option value="">Not configured</option>
                                <option value="true">Required / allowed</option>
                                <option value="false">Not required / not allowed</option>
                              </Select>
                            ) : rule.type === 'kyc' ? (
                              <Select
                                id={`policy-${policy.area}-${rule.key}`}
                                value={String(rules[rule.key] ?? '')}
                                disabled={!canEdit}
                                onChange={(event) =>
                                  updatePolicyRule(
                                    policy.area,
                                    rule.key,
                                    event.target.value || undefined,
                                  )
                                }
                              >
                                <option value="">Not configured</option>
                                <option value="TIER_0">Tier 0</option>
                                <option value="TIER_1">Tier 1</option>
                                <option value="TIER_2">Tier 2</option>
                                <option value="TIER_3">Tier 3</option>
                              </Select>
                            ) : (
                              <div className="relative">
                                <Input
                                  id={`policy-${policy.area}-${rule.key}`}
                                  type="number"
                                  min="0"
                                  step="any"
                                  value={String(rules[rule.key] ?? '')}
                                  disabled={!canEdit}
                                  className={rule.suffix ? 'pr-24' : undefined}
                                  onChange={(event) =>
                                    updatePolicyRule(
                                      policy.area,
                                      rule.key,
                                      event.target.value === ''
                                        ? undefined
                                        : Number(event.target.value),
                                    )
                                  }
                                />
                                {rule.suffix && (
                                  <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-slate-400">
                                    {rule.suffix}
                                  </span>
                                )}
                              </div>
                            )}
                          </Field>
                        ))}
                      </div>
                    </div>
                    <Field label="Policy terms" htmlFor={`policy-${policy.area}`}>
                      <Textarea
                        id={`policy-${policy.area}`}
                        rows={8}
                        value={policy.content}
                        placeholder={copy.placeholder}
                        disabled={!canEdit}
                        onChange={(event) =>
                          setPolicies((current) => current.map((item) =>
                            item.area === policy.area ? { ...item, content: event.target.value } : item,
                          ))
                        }
                      />
                    </Field>
                    <div className="flex flex-wrap items-end justify-between gap-3">
                      <Field label="Visibility" htmlFor={`policy-status-${policy.area}`}>
                        <Select
                          id={`policy-status-${policy.area}`}
                          value={policy.isPublished ? 'published' : 'draft'}
                          disabled={!canEdit}
                          onChange={(event) =>
                            setPolicies((current) => current.map((item) =>
                              item.area === policy.area
                                ? { ...item, isPublished: event.target.value === 'published' }
                                : item,
                            ))
                          }
                        >
                          <option value="draft">Officer draft</option>
                          <option value="published">Published to members</option>
                        </Select>
                      </Field>
                      <div className="flex items-center gap-3">
                        {policy.version > 0 && <span className="text-xs text-slate-400">Version {policy.version}</span>}
                        {canEdit && (
                          <Button
                            icon={<FileCheck2 className="h-4 w-4" />}
                            disabled={!policy.content.trim()}
                            loading={savePolicy.pending}
                            onClick={() => void savePolicy.run(policy)}
                          >
                            Save policy
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader title="Verification" subtitle="Carried out by Rendi, not by the portal" />
            <div className="px-5 py-5">
              {community.status === 'VERIFIED' ? (
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                    <BadgeCheck className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-navy-900">This community is verified</p>
                    <p className="mt-1 text-[13px] text-slate-600">
                      Verified{community.verifiedAt ? ` on ${date(community.verifiedAt, 'long')}` : ''}.
                      Collections, payouts, lending and your public listing are all available.
                    </p>
                  </div>
                </div>
              ) : community.status === 'REJECTED' ? (
                <Callout tone="danger" title="Verification was not approved">
                  {community.rejectionReason ??
                    'Rendi did not approve this community. Contact support to find out what is needed.'}
                </Callout>
              ) : (
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
                    <ShieldAlert className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-navy-900">Verification pending</p>
                    <p className="mt-1 text-[13px] text-slate-600">
                      A Rendi administrator reviews the registration details and the officers named
                      on the account. Until that finishes, the community cannot move money or
                      appear in Discover — everything else in the portal works.
                    </p>
                  </div>
                </div>
              )}
              {community.status !== 'VERIFIED' && (
                <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-navy-900">
                    {community.rejectionReason ? 'Document requested by Vista' : 'Submit verification evidence'}
                  </p>
                  {community.rejectionReason && (
                    <p className="mt-1 text-[13px] text-slate-600">{community.rejectionReason}</p>
                  )}
                  <input
                    className="mt-3 block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-white file:px-3 file:py-2 file:font-semibold"
                    type="file"
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    onChange={(event) => setVerificationFile(event.target.files?.[0] ?? null)}
                  />
                  <Button
                    className="mt-3"
                    disabled={!verificationFile}
                    loading={submitEvidence.pending}
                    onClick={() => void submitEvidence.run()}
                  >
                    Upload for review
                  </Button>
                  {submitEvidence.error && <p className="mt-2 text-xs text-red-600">{submitEvidence.error}</p>}
                </div>
              )}
            </div>
          </Card>

          <Card className="h-fit">
            <CardHeader title="What verification unlocks" />
            <ul className="space-y-2 px-5 py-4 text-[13px] text-slate-600">
              <li className="flex gap-2">
                <Building2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                Online collections into the community wallet
              </li>
              <li className="flex gap-2">
                <Building2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                Ajo payouts and loan disbursement
              </li>
              <li className="flex gap-2">
                <Building2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                A public listing in the Rendi app
              </li>
            </ul>
          </Card>
        </div>
      )}
      <MoneyOutOtpDialog gate={savePolicy} />
    </>
  );
}
