'use client';

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import {
  Building2,
  FileCheck2,
  Loader2,
  MapPin,
  Paperclip,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { Button, Callout, Field, Input, Segmented, Select, Textarea } from '@/components/ui';
import { portalApi } from '@/services/portal';
import { uploadImage } from '@/lib/upload';
import { COMMUNITY_SIZE_BANDS, COMMUNITY_TYPES } from '@/types';
import type { VerificationProfileInput } from '@/types';

const COUNTRIES = [
  { value: 'NGA', label: 'Nigeria' },
  { value: 'GHA', label: 'Ghana' },
  { value: 'KEN', label: 'Kenya' },
];

interface Draft {
  country: string;
  communityType: string;
  companySize: string;
  hasExistingMembers: 'yes' | 'no' | '';
  existingMemberCount: string;
  address: string;
  city: string;
  state: string;
  foundedYear: string;
  registrationNumber: string;
  website: string;
  cacDocumentUrl: string;
  cacDocumentName: string;
}

const EMPTY: Draft = {
  country: 'NGA',
  communityType: '',
  companySize: '',
  hasExistingMembers: '',
  existingMemberCount: '',
  address: '',
  city: '',
  state: '',
  foundedYear: '',
  registrationNumber: '',
  website: '',
  cacDocumentUrl: '',
  cacDocumentName: '',
};

/** Per community, so switching workspaces cannot show the wrong draft. */
const draftKey = (communityId: string) => `rendi:verification-profile:${communityId}`;

/**
 * Nothing else writes this key, so there is no change to subscribe to — the
 * store is read once, at mount, and owned by React state from then on.
 */
const neverChanges = () => () => {};

function readDraft(communityId: string): Draft {
  try {
    const saved = window.localStorage.getItem(draftKey(communityId));
    return saved ? { ...EMPTY, ...(JSON.parse(saved) as Partial<Draft>) } : EMPTY;
  } catch {
    // Corrupt JSON, or storage unavailable in private mode. An empty form is
    // a far better outcome than a modal that throws and cannot be dismissed.
    return EMPTY;
  }
}

/**
 * The step registration cannot finish without.
 *
 * It has no close affordance of any kind — no X, no Escape, no backdrop
 * click — because a community that skips it sits in the review queue with
 * nothing a reviewer can decide on, and the owner has no way back to a form
 * they dismissed. The portal behind it is deliberately unreachable.
 *
 * Answers are mirrored into localStorage on every keystroke. Someone will
 * close the tab to go and find their CAC number, and losing a half-filled
 * form to that is the fastest way to lose the registration entirely.
 */
export function VerificationProfileModal(props: { communityId: string; communityName: string }) {
  // The saved draft is external state, and this is how React reads one
  // without a hydration mismatch: the server snapshot is `false`, so the
  // first paint is the scrim alone, and the form mounts on the client with
  // the stored answers already in its initial state.
  const ready = useSyncExternalStore(
    neverChanges,
    () => true,
    () => false,
  );

  if (!ready) {
    return <div className="fixed inset-0 z-[110] bg-navy-950/70 backdrop-blur-sm" aria-hidden />;
  }

  return <VerificationProfileForm {...props} />;
}

function VerificationProfileForm({
  communityId,
  communityName,
}: {
  communityId: string;
  communityName: string;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>(() => readDraft(communityId));
  const [touched, setTouched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Writing to an external store is exactly what an effect is for. Every
  // keystroke, because someone will close the tab to go and find their CAC
  // number, and losing a half-filled form to that loses the registration.
  useEffect(() => {
    try {
      window.localStorage.setItem(draftKey(communityId), JSON.stringify(draft));
    } catch {
      // Private mode, or the quota is full. The form still works.
    }
  }, [draft, communityId]);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const hasMembers = draft.hasExistingMembers === 'yes';
  const countBad =
    hasMembers && (!/^\d+$/.test(draft.existingMemberCount) || Number(draft.existingMemberCount) < 1);
  const yearBad =
    Boolean(draft.foundedYear) &&
    (!/^\d{4}$/.test(draft.foundedYear) || Number(draft.foundedYear) > new Date().getFullYear());

  const invalid = {
    communityType: !draft.communityType,
    companySize: !draft.companySize,
    hasExistingMembers: !draft.hasExistingMembers,
    existingMemberCount: countBad,
    address: draft.address.trim().length < 5,
    city: draft.city.trim().length < 2,
    state: draft.state.trim().length < 2,
    foundedYear: yearBad,
  };
  const valid = !Object.values(invalid).some(Boolean);

  async function attach(file: File) {
    setError(null);
    setUploading(true);
    try {
      // `community-documents` accepts PDFs as well as images; the logo folder
      // is pinned to image-only and would reject a scanned certificate.
      const url = await uploadImage(file, 'community-documents');
      setDraft((d) => ({ ...d, cacDocumentUrl: url, cacDocumentName: file.name }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not upload that document.');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setTouched(true);
    setError(null);
    if (!valid || loading || uploading) return;

    const body: VerificationProfileInput = {
      country: draft.country,
      communityType: draft.communityType,
      companySize: draft.companySize,
      hasExistingMembers: hasMembers,
      ...(hasMembers ? { existingMemberCount: Number(draft.existingMemberCount) } : {}),
      address: draft.address.trim(),
      city: draft.city.trim(),
      state: draft.state.trim(),
      ...(draft.foundedYear ? { foundedYear: Number(draft.foundedYear) } : {}),
      ...(draft.registrationNumber.trim()
        ? { registrationNumber: draft.registrationNumber.trim() }
        : {}),
      ...(draft.website.trim() ? { website: draft.website.trim() } : {}),
      ...(draft.cacDocumentUrl ? { cacDocumentUrl: draft.cacDocumentUrl } : {}),
    };

    setLoading(true);
    try {
      await portalApi.submitVerificationProfile(communityId, body);
      // Only now: a draft cleared before the API accepted it is a draft lost
      // to a failed request.
      try {
        window.localStorage.removeItem(draftKey(communityId));
      } catch {
        // Nothing to do — the server has the answers either way.
      }
      // The shell re-reads the session on the server, sees the flag has
      // flipped, and stops rendering this.
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit this for review.');
      setLoading(false);
    }
  }

  return (
    // The dialog is pinned to the viewport: header and footer never move, and
    // only the field area between them scrolls. The page behind must not
    // scroll either — the title is what tells the owner what this wall is.
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-navy-950/70 p-4 backdrop-blur-sm"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="verification-profile-title"
    >
      <form
        onSubmit={submit}
        noValidate
        className="flex max-h-[calc(100dvh-2rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        <div className="shrink-0 border-b border-slate-200 px-6 py-5 sm:px-8">
          <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
            <ShieldCheck className="h-5 w-5" aria-hidden />
          </span>
          <h2 id="verification-profile-title" className="text-xl font-bold text-navy-900">
            Tell us about {communityName}
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
            Rendi reviews every community before it can collect contributions, lend or appear in
            Discover. This is the last step of registration — your answers go straight to the
            review team.
          </p>
        </div>

        <div className="min-h-0 flex-1 space-y-7 overflow-y-auto px-6 py-6 sm:px-8">
          {error && <Callout tone="danger">{error}</Callout>}

          <section className="space-y-5">
            <SectionLabel icon={<Building2 className="h-3.5 w-3.5" />} title="The organisation" />

            <Field label="Country" htmlFor="vp-country" required>
              <Segmented
                label="Country"
                value={draft.country}
                onChange={(v) => set('country', v)}
                options={COUNTRIES}
              />
            </Field>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field
                label="What kind of community is this?"
                htmlFor="vp-type"
                required
                error={touched && invalid.communityType && 'Pick the closest match.'}
              >
                <Select
                  id="vp-type"
                  value={draft.communityType}
                  invalid={touched && invalid.communityType}
                  onChange={(e) => set('communityType', e.target.value)}
                >
                  <option value="">Select…</option>
                  {COMMUNITY_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field
                label="How many members do you expect?"
                htmlFor="vp-size"
                required
                hint="A rough band is fine"
                error={touched && invalid.companySize && 'Pick a size band.'}
              >
                <Select
                  id="vp-size"
                  value={draft.companySize}
                  invalid={touched && invalid.companySize}
                  onChange={(e) => set('companySize', e.target.value)}
                >
                  <option value="">Select…</option>
                  {COMMUNITY_SIZE_BANDS.map((band) => (
                    <option key={band} value={band}>
                      {band} members
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <Field
              label="Does the community already have members?"
              required
              error={touched && invalid.hasExistingMembers && 'Pick one of the two.'}
            >
              {/* Two cards, not a segmented control: an unset segmented reads
                  as if something is already chosen, and the follow-up count
                  lives inside the Yes card so the question and its answer
                  stay one object. */}
              <div
                role="radiogroup"
                aria-label="Does the community already have members?"
                className="grid gap-3 sm:grid-cols-2"
              >
                <MemberOption
                  selected={draft.hasExistingMembers === 'yes'}
                  invalid={touched && invalid.hasExistingMembers}
                  onSelect={() => set('hasExistingMembers', 'yes')}
                  title="Yes, we have members"
                  body="The group runs today — on paper, a spreadsheet or another app."
                >
                  {hasMembers && (
                    <div className="mt-3 border-t border-blue-100 pt-3">
                      <label
                        htmlFor="vp-count"
                        className="text-[12.5px] font-medium text-navy-900"
                      >
                        Roughly how many?
                      </label>
                      <Input
                        id="vp-count"
                        inputMode="numeric"
                        value={draft.existingMemberCount}
                        invalid={touched && invalid.existingMemberCount}
                        onChange={(e) =>
                          set('existingMemberCount', e.target.value.replace(/\D/g, ''))
                        }
                        placeholder="120"
                        className="mt-1.5"
                        // The card is a radio button; typing must not re-fire it.
                        onClick={(e) => e.stopPropagation()}
                      />
                      <p className="mt-1.5 text-[12px] text-slate-500">
                        {touched && invalid.existingMemberCount ? (
                          <span className="text-red-600">Enter a whole number.</span>
                        ) : (
                          'A guess is fine — you can import them later from Members → Add.'
                        )}
                      </p>
                    </div>
                  )}
                </MemberOption>
                <MemberOption
                  selected={draft.hasExistingMembers === 'no'}
                  invalid={touched && invalid.hasExistingMembers}
                  onSelect={() => set('hasExistingMembers', 'no')}
                  title="No, starting fresh"
                  body="The member list begins here on Rendi."
                />
              </div>
            </Field>
          </section>

          <section className="space-y-5 border-t border-slate-200 pt-6">
            <SectionLabel icon={<MapPin className="h-3.5 w-3.5" />} title="Where you operate" />

            <Field
              label="Address"
              htmlFor="vp-address"
              required
              error={touched && invalid.address && 'Enter the address the community operates from.'}
            >
              <Textarea
                id="vp-address"
                rows={2}
                value={draft.address}
                invalid={touched && invalid.address}
                onChange={(e) => set('address', e.target.value)}
                placeholder="14 Allen Avenue, off Opebi Road"
              />
            </Field>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field
                label="City"
                htmlFor="vp-city"
                required
                error={touched && invalid.city && 'Enter a city.'}
              >
                <Input
                  id="vp-city"
                  value={draft.city}
                  invalid={touched && invalid.city}
                  onChange={(e) => set('city', e.target.value)}
                  placeholder="Ikeja"
                />
              </Field>

              <Field
                label="State or region"
                htmlFor="vp-state"
                required
                error={touched && invalid.state && 'Enter a state or region.'}
              >
                <Input
                  id="vp-state"
                  value={draft.state}
                  invalid={touched && invalid.state}
                  onChange={(e) => set('state', e.target.value)}
                  placeholder="Lagos"
                />
              </Field>
            </div>
          </section>

          <section className="space-y-5 border-t border-slate-200 pt-6">
            <SectionLabel
              icon={<FileCheck2 className="h-3.5 w-3.5" />}
              title="Registration evidence"
              body="Optional, and an unregistered thrift group is welcome — but evidence gets a decision back faster."
            />

            <div className="grid gap-5 sm:grid-cols-2">
              <Field
                label="Registration number"
                htmlFor="vp-reg"
                optional
                hint="CAC or state cooperative registration"
              >
                <Input
                  id="vp-reg"
                  value={draft.registrationNumber}
                  onChange={(e) => set('registrationNumber', e.target.value.toUpperCase())}
                  placeholder="RC1234567"
                />
              </Field>

              <Field
                label="Year founded"
                htmlFor="vp-year"
                optional
                error={touched && invalid.foundedYear && 'Enter a four-digit year in the past.'}
              >
                <Input
                  id="vp-year"
                  inputMode="numeric"
                  value={draft.foundedYear}
                  invalid={touched && invalid.foundedYear}
                  onChange={(e) => set('foundedYear', e.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder="1998"
                />
              </Field>

              <Field className="sm:col-span-2" label="Website" htmlFor="vp-website" optional>
                <Input
                  id="vp-website"
                  value={draft.website}
                  onChange={(e) => set('website', e.target.value)}
                  placeholder="https://ikejatraders.ng"
                />
              </Field>
            </div>

            <Field
              label="CAC certificate or registration document"
              optional
              hint="PDF or photo, up to about 10MB"
            >
              {draft.cacDocumentUrl ? (
                <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50/60 px-3.5 py-2.5">
                  <Paperclip className="h-4 w-4 shrink-0 text-emerald-700" aria-hidden />
                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-emerald-900">
                    {draft.cacDocumentName || 'Document attached'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setDraft((d) => ({ ...d, cacDocumentUrl: '', cacDocumentName: '' }))}
                    className="rounded-md p-1.5 text-emerald-800 hover:bg-emerald-100 focus-ring"
                    aria-label="Remove document"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="application/pdf,image/*"
                    className="sr-only"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void attach(file);
                    }}
                  />
                  <button
                    type="button"
                    disabled={uploading}
                    onClick={() => fileRef.current?.click()}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 bg-slate-50/60 px-4 py-3 text-[13px] font-medium text-slate-600 transition hover:border-slate-400 hover:text-navy-900 disabled:cursor-wait focus-ring"
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Uploading…
                      </>
                    ) : (
                      <>
                        <Paperclip className="h-4 w-4" aria-hidden /> Attach a document
                      </>
                    )}
                  </button>
                </>
              )}
            </Field>
          </section>
        </div>

        <div className="flex shrink-0 flex-col gap-3 border-t border-slate-200 bg-slate-50/70 px-6 py-4 sm:flex-row sm:items-center sm:px-8">
          <p className="text-[12.5px] leading-relaxed text-slate-500">
            Your answers are saved as you type — you can close this tab and come back.
          </p>
          <div className="sm:flex-1" />
          <Button type="submit" size="lg" variant="blue" loading={loading} disabled={uploading}>
            Submit for review
          </Button>
        </div>
      </form>
    </div>
  );
}

/**
 * One of the two answers to "does the community already have members?",
 * drawn as a selectable card. The Yes card hosts the count field, so the
 * follow-up appears where the answer was given instead of materialising
 * elsewhere in the form.
 */
function MemberOption({
  selected,
  invalid,
  onSelect,
  title,
  body,
  children,
}: {
  selected: boolean;
  invalid: boolean;
  onSelect: () => void;
  title: string;
  body: string;
  children?: ReactNode;
}) {
  return (
    <div
      role="radio"
      aria-checked={selected}
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
      className={cnOption(selected, invalid)}
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className={
            selected
              ? 'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-[5px] border-blue-600 bg-white'
              : 'mt-0.5 h-4 w-4 shrink-0 rounded-full border-2 border-slate-300 bg-white'
          }
        />
        <div className="min-w-0">
          <p className="text-[13.5px] font-semibold text-navy-900">{title}</p>
          <p className="mt-0.5 text-[12.5px] leading-snug text-slate-500">{body}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

function cnOption(selected: boolean, invalid: boolean) {
  const base =
    'cursor-pointer rounded-xl border p-3.5 text-left transition focus-ring';
  if (selected) return `${base} border-blue-600 bg-blue-50/50 ring-1 ring-blue-600`;
  if (invalid) return `${base} border-red-300 hover:border-red-400`;
  return `${base} border-slate-200 hover:border-slate-300`;
}

function SectionLabel({
  icon,
  title,
  body,
}: {
  icon: ReactNode;
  title: string;
  body?: string;
}) {
  return (
    <div>
      <h3 className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wide text-navy-900">
        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-navy-50 text-navy-700">
          {icon}
        </span>
        {title}
      </h3>
      {body && <p className="mt-1.5 text-[13px] leading-relaxed text-slate-500">{body}</p>}
    </div>
  );
}
