'use client';

import { useState } from 'react';
import { BadgeCheck, Building2, ShieldAlert } from 'lucide-react';
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
import { useCommunityId } from '@/components/providers/session-provider';
import { useToast } from '@/components/providers/toast-provider';
import { portalApi } from '@/services/portal';
import { ORG_CATEGORIES } from '@/data/catalog';
import { date } from '@/lib/format';
import { uploadImage } from '@/lib/upload';

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

type Tab = 'profile' | 'verification';

export function SettingsClient({ community }: { community: Community }) {
  const communityId = useCommunityId();
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>('profile');

  const [name, setName] = useState(community.name);
  const [phone, setPhone] = useState(community.phone);
  const [address, setAddress] = useState(community.address ?? '');
  const [city, setCity] = useState(community.city ?? '');
  const [category, setCategory] = useState(community.category ?? '');
  const [registrationNumber, setRegistrationNumber] = useState(community.registrationNumber ?? '');
  const [verificationFile, setVerificationFile] = useState<File | null>(null);

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

  return (
    <>
      <PageHeader
        title="Settings"
        subtitle="Your community's profile and its standing with Rendi"
        actions={
          tab === 'profile' ? (
            <Button loading={save.pending} onClick={() => void save.run()}>
              Save changes
            </Button>
          ) : null
        }
      />

      <Tabs
        value={tab}
        onChange={setTab}
        className="mb-4"
        tabs={[
          { value: 'profile', label: 'Profile' },
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
                <Input id="se-name" value={name} onChange={(e) => setName(e.target.value)} />
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
                  <Input id="se-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
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
                  <Input id="se-city" value={city} onChange={(e) => setCity(e.target.value)} />
                </Field>
                <Field label="Category" htmlFor="se-cat" optional>
                  <Select id="se-cat" value={category} onChange={(e) => setCategory(e.target.value)}>
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
    </>
  );
}
