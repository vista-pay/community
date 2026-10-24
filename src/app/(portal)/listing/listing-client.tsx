'use client';

import { useState } from 'react';
import { Eye, Globe, Pause, Play, Send, Users } from 'lucide-react';
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
import { ORG_CATEGORIES } from '@/data/catalog';
import { humanise } from '@/lib/format';
import type { Listing } from '@/types';

export function ListingClient({ initial }: { initial: Listing }) {
  const communityId = useCommunityId();
  const { toast } = useToast();

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
  const [requireReferee, setRequireReferee] = useState(listing.requireReferee);
  const [requireIdCheck, setRequireIdCheck] = useState(listing.requireIdCheck);
  const [showMemberCount, setShowMemberCount] = useState(listing.showMemberCount);
  const [showLocation, setShowLocation] = useState(listing.showLocation);

  const save = useMutation(
    () =>
      portalApi.updateListing(communityId, {
        tagline: tagline.trim(),
        category: category.trim(),
        about: about.trim(),
        joinMode,
        entryFee,
        requirements: requirements
          .split('\n')
          .map((l) => l.trim())
          .filter(Boolean),
        requireReferee,
        requireIdCheck,
        showMemberCount,
        showLocation,
      }),
    {
      onSuccess: async () => {
        toast('Listing saved', 'success');
        await refresh();
      },
      onError: (message) => toast('Could not save', 'error', message),
    },
  );

  const submit = useMutation(() => portalApi.submitListing(communityId), {
    onSuccess: async () => {
      toast('Submitted for review', 'success', 'Vista will check it before it goes live.');
      await refresh();
    },
    onError: (message) => toast('Could not submit', 'error', message),
  });

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

  const unverified = listing.community?.status !== 'VERIFIED';

  return (
    <>
      <PageHeader
        title="Public listing"
        subtitle="How your community appears to people searching in the Vista app"
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

      {unverified && (
        <Callout tone="warning" className="mb-6" title="Verification comes first">
          Only a Vista-verified community can appear in Discover. Your listing can be prepared now
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
                <p className="text-[15px] font-semibold text-navy-900">
                  {listing.community?.name ?? 'Your community'}
                </p>
                <p className="mt-1 text-[13px] text-slate-600">
                  {tagline || 'Add a tagline so people know what you do.'}
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {category && <Badge tone="slate">{category}</Badge>}
                  {showLocation && listing.community?.city && (
                    <Badge tone="slate">{listing.community.city}</Badge>
                  )}
                  {showMemberCount && <Badge tone="slate">{listing.stats.approved} members</Badge>}
                  {listing.community?.status === 'VERIFIED' && <Badge tone="green">Verified</Badge>}
                </div>
              </div>
            </div>
          </Card>

          {(listing.status === 'DRAFT' || listing.status === 'REJECTED') && (
            <Card>
              <div className="px-5 py-4">
                <p className="text-[13px] text-slate-600">
                  Submit the listing and Rendi will review it before it appears in Discover.
                </p>
                <Button
                  className="mt-3"
                  block
                  disabled={unverified || !tagline || !about || !category}
                  loading={submit.pending}
                  icon={<Send className="h-4 w-4" />}
                  onClick={() => void submit.run()}
                >
                  Submit for review
                </Button>
                {!unverified && (!tagline || !about || !category) && (
                  <p className="mt-2 text-xs text-slate-500">
                    Add a tagline, category and description first.
                  </p>
                )}
              </div>
            </Card>
          )}

          {listing.status === 'IN_REVIEW' && (
            <Callout tone="info" title="With Vista for review">
              You will see the result here. Editing the listing keeps it in review.
            </Callout>
          )}
        </div>
      </div>
    </>
  );
}
