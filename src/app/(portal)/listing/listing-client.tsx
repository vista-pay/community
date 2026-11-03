'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, ChevronDown, Eye, Globe, ImagePlus, Pause, Play, Send, Users } from 'lucide-react';
import {
  AmountInput,
  Badge,
  Button,
  Callout,
  Card,
  CardHeader,
  Checkbox,
  Field,
  Input,
  PageHeader,
  Select,
  Stat,
  Textarea,
} from '@/components/ui';
import { useMutation, useQuery } from '@/hooks/use-query';
import { useCommunityId } from '@/components/providers/session-provider';
import { useToast } from '@/components/providers/toast-provider';
import { portalApi } from '@/services/portal';
import { uploadImage } from '@/lib/upload';
import { useSession } from '@/components/providers/session-provider';
import { ORG_CATEGORIES, SERVICE_TAGS } from '@/data/catalog';
import { humanise } from '@/lib/format';
import type { Listing } from '@/types';

export function ListingClient({ initial }: { initial: Listing }) {
  const communityId = useCommunityId();
  const { community } = useSession();
  const { toast } = useToast();
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const coverInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);

  const { data, refresh } = useQuery<Listing>(() => portalApi.listing(communityId), [communityId], {
    initial,
  });
  const listing = data ?? initial;

  const [tagline, setTagline] = useState(listing.tagline ?? '');
  const [category, setCategory] = useState(listing.category ?? '');
  const [about, setAbout] = useState(listing.about ?? '');
  const [joinMode, setJoinMode] = useState(listing.joinMode);
  const [entryFee, setEntryFee] = useState(listing.entryFee);
  const [requirements, setRequirements] = useState(listing.requirements.join('\n'));
  const [tags, setTags] = useState<string[]>(listing.tags ?? []);
  const [logoUrl, setLogoUrl] = useState(listing.community?.logoUrl ?? null);
  const [coverImageUrl, setCoverImageUrl] = useState(listing.coverImageUrl ?? null);
  const [requireReferee, setRequireReferee] = useState(listing.requireReferee);
  const [requireIdCheck, setRequireIdCheck] = useState(listing.requireIdCheck);
  const [showMemberCount, setShowMemberCount] = useState(listing.showMemberCount);
  const [showLocation, setShowLocation] = useState(listing.showLocation);

  const payload = () => ({
    tagline: tagline.trim(),
    category: category.trim(),
    about: about.trim(),
    joinMode,
    entryFee,
    requirements: requirements
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean),
    tags,
    ...(logoUrl !== (listing.community?.logoUrl ?? null) ? { logoUrl: logoUrl ?? '' } : {}),
    ...(coverImageUrl !== (listing.coverImageUrl ?? null)
      ? { coverImageUrl: coverImageUrl ?? '' }
      : {}),
    requireReferee,
    requireIdCheck,
    showMemberCount,
    showLocation,
  });

  const save = useMutation(() => portalApi.updateListing(communityId, payload()), {
    onSuccess: async () => {
      toast('Listing saved', 'success');
      await refresh();
    },
    onError: (message) => toast('Could not save', 'error', message),
  });

  // Submitting saves first: the server judges the stored listing, and the
  // officer's unsaved edits are what they believe they are submitting.
  const submit = useMutation(
    async () => {
      await portalApi.updateListing(communityId, payload());
      return portalApi.submitListing(communityId);
    },
    {
      onSuccess: () => {
        toast('Listing published', 'success', 'Your community is now visible in Discover.');
        // Back to the dashboard — and refresh so the server re-reads the
        // session: the setup mandate clears on publish, and a stale layout
        // would otherwise still show the blocking modal.
        router.push('/dashboard');
        router.refresh();
      },
      onError: (message) => toast('Could not publish', 'error', message),
    },
  );

  const pause = useMutation(
    (paused: boolean) =>
      paused ? portalApi.pauseListing(communityId) : portalApi.resumeListing(communityId),
    {
      onSuccess: async () => {
        toast('Listing updated', 'info');
        await refresh();
      },
      onError: (message) => toast('Could not update', 'error', message),
    },
  );

  const pickLogo = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadImage(file, 'community-logos');
      setLogoUrl(url);
      toast('Logo uploaded', 'success', 'Save changes to publish it.');
    } catch (err) {
      toast('Upload failed', 'error', err instanceof Error ? err.message : undefined);
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const pickCover = async (file: File | undefined) => {
    if (!file) return;
    setUploadingCover(true);
    try {
      const url = await uploadImage(file, 'community-logos');
      setCoverImageUrl(url);
      toast('Cover photo uploaded', 'success', 'Save changes to publish it.');
    } catch (err) {
      toast('Upload failed', 'error', err instanceof Error ? err.message : undefined);
    } finally {
      setUploadingCover(false);
      if (coverInput.current) coverInput.current.value = '';
    }
  };

  const unverified = listing.community?.status !== 'VERIFIED';
  const mandated = Boolean(community?.listingSetupRequired);

  return (
    <>
      <PageHeader
        title="Public listing"
        subtitle="How your community appears to people searching in the Rendi app"
        actions={
          <>
            {listing.status === 'LIVE' && (
              <Button
                variant="secondary"
                icon={<Pause className="h-4 w-4" />}
                loading={pause.pending}
                onClick={() => void pause.run(true)}
              >
                Pause
              </Button>
            )}
            {listing.status === 'PAUSED' && (
              <Button
                variant="secondary"
                icon={<Play className="h-4 w-4" />}
                loading={pause.pending}
                onClick={() => void pause.run(false)}
              >
                Resume
              </Button>
            )}
            <Button loading={save.pending} onClick={() => void save.run()}>
              Save changes
            </Button>
          </>
        }
      />

      {mandated && (
        <Callout tone="info" className="mb-6" title="Your community is verified — publish your listing to continue">
          Every verified community must set up its public listing page before using the rest of the
          portal. Add your logo, tagline, category and joining terms below, then submit for review.
        </Callout>
      )}

      {unverified && (
        <Callout tone="warning" className="mb-6" title="Verification comes first">
          Only a Rendi-verified community can appear in Discover. Your listing can be prepared now
          and submitted once verification completes.
        </Callout>
      )}

      {listing.status === 'REJECTED' && listing.rejectionNote && (
        <Callout tone="danger" className="mb-6" title="This listing was not approved">
          {listing.rejectionNote}
        </Callout>
      )}

      <div className="grid gap-4 sm:grid-cols-4">
        <Stat
          label="Status"
          value={humanise(listing.status)}
          icon={<Globe className="h-4 w-4" />}
          tone={listing.status === 'LIVE' ? 'positive' : 'default'}
        />
        <Stat label="Views" value={listing.stats.views} icon={<Eye className="h-4 w-4" />} />
        <Stat label="Requests" value={listing.stats.requests} icon={<Users className="h-4 w-4" />} />
        <Stat label="Members" value={listing.stats.approved} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="What people see" />
            <div className="space-y-4 px-5 py-4">
              <Field label="Logo" htmlFor="li-logo" hint="Shown on your community's card and profile in the Rendi app">
                <div className="flex items-center gap-4">
                  {logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={logoUrl}
                      alt="Community logo"
                      className="h-16 w-16 rounded-2xl border border-slate-200 object-cover"
                    />
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50">
                      <ImagePlus className="h-5 w-5 text-slate-400" />
                    </div>
                  )}
                  <div className="space-x-2">
                    <Button
                      variant="secondary"
                      loading={uploading}
                      onClick={() => fileInput.current?.click()}
                    >
                      {logoUrl ? 'Replace logo' : 'Upload logo'}
                    </Button>
                    {logoUrl && (
                      <Button variant="secondary" onClick={() => setLogoUrl(null)}>
                        Remove
                      </Button>
                    )}
                  </div>
                  <input
                    ref={fileInput}
                    id="li-logo"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => void pickLogo(e.target.files?.[0])}
                  />
                </div>
              </Field>

              <Field
                label="Cover photo"
                htmlFor="li-cover"
                optional
                hint="Wide banner across the top of your join page in the Rendi app"
              >
                <div className="space-y-2">
                  {coverImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={coverImageUrl}
                      alt="Cover photo"
                      className="h-28 w-full rounded-xl border border-slate-200 object-cover"
                    />
                  ) : (
                    <div className="flex h-28 w-full items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50">
                      <ImagePlus className="h-5 w-5 text-slate-400" />
                    </div>
                  )}
                  <div className="space-x-2">
                    <Button
                      variant="secondary"
                      loading={uploadingCover}
                      onClick={() => coverInput.current?.click()}
                    >
                      {coverImageUrl ? 'Replace cover' : 'Upload cover photo'}
                    </Button>
                    {coverImageUrl && (
                      <Button variant="secondary" onClick={() => setCoverImageUrl(null)}>
                        Remove
                      </Button>
                    )}
                  </div>
                  <input
                    ref={coverInput}
                    id="li-cover"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => void pickCover(e.target.files?.[0])}
                  />
                </div>
              </Field>

              <Field label="Tagline" htmlFor="li-tagline" hint="One line, shown on the Discover card">
                <Input
                  id="li-tagline"
                  value={tagline}
                  maxLength={160}
                  onChange={(e) => setTagline(e.target.value)}
                  placeholder="Savings, loans and welfare for Ojodu traders since 1998"
                />
              </Field>

              <Field label="Category" htmlFor="li-category">
                <Select id="li-category" value={category} onChange={(e) => setCategory(e.target.value)}>
                  <option value="">Choose a category…</option>
                  {ORG_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field
                label="Services you offer"
                htmlFor="li-tags"
                optional
                hint="Shown as chips on your Discover card so members know what you provide"
              >
                <ServiceTagPicker value={tags} onChange={setTags} />
              </Field>

              <Field label="About" htmlFor="li-about" hint="What you do, who can join, how it works">
                <Textarea
                  id="li-about"
                  rows={6}
                  value={about}
                  onChange={(e) => setAbout(e.target.value)}
                />
              </Field>
            </div>
          </Card>

          <Card>
            <CardHeader title="Joining" subtitle="What someone must do and provide to apply" />
            <div className="space-y-4 px-5 py-4">
              <Field label="How people join" htmlFor="li-mode">
                <Select
                  id="li-mode"
                  value={joinMode}
                  onChange={(e) => setJoinMode(e.target.value as Listing['joinMode'])}
                >
                  <option value="REQUEST">Request to join, reviewed by an officer</option>
                  <option value="OPEN">Anyone can join immediately</option>
                  <option value="INVITE_ONLY">Invitation only</option>
                </Select>
              </Field>

              <Field label="Entry fee" htmlFor="li-fee" optional>
                <AmountInput id="li-fee" value={entryFee} onChange={setEntryFee} />
              </Field>

              <Field label="Requirements" htmlFor="li-req" optional hint="One per line">
                <Textarea
                  id="li-req"
                  rows={3}
                  value={requirements}
                  onChange={(e) => setRequirements(e.target.value)}
                  placeholder={'Trade within Ojodu market\nTwo passport photographs'}
                />
              </Field>

              <Checkbox
                checked={requireReferee}
                onChange={setRequireReferee}
                label="A current member must vouch for the applicant"
              />
              <Checkbox
                checked={requireIdCheck}
                onChange={setRequireIdCheck}
                label="Require an identity check before admission"
              />
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Privacy" />
            <div className="space-y-3 px-5 py-4">
              <Checkbox
                checked={showMemberCount}
                onChange={setShowMemberCount}
                label="Show how many members we have"
              />
              <Checkbox checked={showLocation} onChange={setShowLocation} label="Show our city" />
            </div>
          </Card>

          <Card>
            <CardHeader title="Preview" subtitle="Roughly what the Discover card shows" />
            <div className="px-5 py-4">
              <div className="rounded-xl border border-slate-200 p-4">
                <div className="flex items-center gap-3">
                  {logoUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logoUrl} alt="" className="h-10 w-10 rounded-xl object-cover" />
                  )}
                  <p className="text-[15px] font-semibold text-navy-900">
                    {listing.community?.name ?? 'Your community'}
                  </p>
                </div>
                <p className="mt-1 text-[13px] text-slate-600">
                  {tagline || 'Add a tagline so people know what you do.'}
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {category && <Badge tone="slate">{category}</Badge>}
                  {tags.map((t) => (
                    <Badge key={t} tone="navy">
                      {t}
                    </Badge>
                  ))}
                  {showLocation && listing.community?.city && (
                    <Badge tone="slate">{listing.community.city}</Badge>
                  )}
                  {showMemberCount && <Badge tone="slate">{listing.stats.approved} members</Badge>}
                  {listing.community?.status === 'VERIFIED' && <Badge tone="green">Verified</Badge>}
                </div>
              </div>
            </div>
          </Card>

          {listing.status !== 'LIVE' && listing.status !== 'PAUSED' && (
            <Card>
              <div className="px-5 py-4">
                <p className="text-[13px] text-slate-600">
                  Publish the listing and it appears in Discover immediately — your community is
                  already verified, so no further approval is needed.
                </p>
                <Button
                  className="mt-3"
                  block
                  disabled={unverified || !tagline || !about || !category}
                  loading={submit.pending}
                  icon={<Send className="h-4 w-4" />}
                  onClick={() => void submit.run()}
                >
                  Publish listing
                </Button>
                {!unverified && (!tagline || !about || !category) && (
                  <p className="mt-2 text-xs text-slate-500">
                    Add a tagline, category and description first.
                  </p>
                )}
              </div>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

/** Dropdown multi-select over the fixed service vocabulary. */
function ServiceTagPicker({
  value,
  onChange,
}: {
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const toggle = (tag: string) =>
    onChange(value.includes(tag) ? value.filter((t) => t !== tag) : [...value, tag]);

  return (
    <div ref={wrap} className="relative">
      <button
        type="button"
        id="li-tags"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex h-10 w-full items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 text-left text-sm text-navy-900 focus:border-blue-500 focus:outline-none"
      >
        <span className={value.length ? '' : 'text-slate-400'}>
          {value.length ? value.join(', ') : 'Choose the services you offer…'}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
      </button>

      {open && (
        <div
          role="listbox"
          aria-multiselectable="true"
          className="absolute z-20 mt-1 w-full rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
        >
          {SERVICE_TAGS.map((tag) => {
            const selected = value.includes(tag);
            return (
              <button
                key={tag}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => toggle(tag)}
                className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-navy-900 hover:bg-slate-50"
              >
                {tag}
                {selected && <Check className="h-4 w-4 text-blue-600" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
