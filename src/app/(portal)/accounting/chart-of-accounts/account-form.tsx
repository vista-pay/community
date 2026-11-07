'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Check, Lock, Sparkles } from 'lucide-react';
import {
  Badge,
  Button,
  Callout,
  Card,
  CardHeader,
  Field,
  Input,
  PageHeader,
  RadioCard,
  Select,
  Textarea,
  Toggle,
} from '@/components/ui';
import { useMutation } from '@/hooks/use-query';
import { useCommunityId } from '@/components/providers/session-provider';
import { useToast } from '@/components/providers/toast-provider';
import { portalApi } from '@/services/portal';
import type { BookAccount, BookAccountType } from '@/types';
import { ACCOUNT_CLASSES, classOf, codeFitsClass, suggestCode } from './account-classes';

/** Typed when the officer wants a group that does not exist yet. */
const NEW_GROUP = '__new__';

/**
 * Adding or editing one line of the community's own books.
 *
 * A page rather than a modal because this is a decision, not a confirmation:
 * which class an account belongs to determines where it lands on the balance
 * sheet, and getting it wrong is the kind of mistake that is only noticed
 * when the year-end numbers look odd. It needs room to explain itself.
 *
 * The order matters. Class comes first, because it decides the code band,
 * the normal side, and half of what the rest of the form should say.
 */
export function AccountForm({
  account,
  chart,
}: {
  /** Null when adding. */
  account: BookAccount | null;
  /** The whole chart, for code suggestions, clash checks and group reuse. */
  chart: BookAccount[];
}) {
  const communityId = useCommunityId();
  const { toast } = useToast();
  const router = useRouter();

  const isNew = account === null;
  const locked = account?.isSystem ?? false;

  const [type, setType] = useState<BookAccountType>(account?.type ?? 'EXPENSE');
  /** What the officer typed, once they have taken the code over themselves. */
  const [typedCode, setTypedCode] = useState<string | null>(isNew ? null : (account?.code ?? ''));
  const [name, setName] = useState(account?.name ?? '');
  const [group, setGroup] = useState(account?.group ?? '');
  const [newGroup, setNewGroup] = useState('');
  const [description, setDescription] = useState(account?.description ?? '');
  const [isActive, setIsActive] = useState(account?.isActive ?? true);

  const takenCodes = useMemo(
    () => chart.filter((a) => a.id !== account?.id).map((a) => a.code),
    [chart, account],
  );

  // Groups already in the chart, so a new account joins an existing section
  // rather than starting a one-account group through a typo.
  const groups = useMemo(
    () => [...new Set(chart.filter((a) => a.type === type).map((a) => a.group))].sort(),
    [chart, type],
  );

  /**
   * The code shown: the officer's if they have typed one, otherwise the next
   * free number in the chosen class.
   *
   * Derived rather than held in state and synced by an effect. Syncing would
   * mean a render with last class's suggestion still in the box, and the
   * suggestion has to change the instant the class does.
   */
  const suggested = useMemo(() => suggestCode(type, takenCodes), [type, takenCodes]);
  const code = typedCode ?? suggested;
  const codeTouched = typedCode !== null;

  const chosenGroup = group === NEW_GROUP ? newGroup.trim() : group.trim();
  const klass = classOf(type);
  const codeShape = /^[0-9]{3,8}$/.test(code.trim());
  const codeClash = takenCodes.includes(code.trim());
  const codeOutOfBand = codeShape && !codeClash && !codeFitsClass(code.trim(), type);

  const save = useMutation(
    () =>
      isNew
        ? portalApi.createAccount(communityId, {
            code: code.trim(),
            name: name.trim(),
            type,
            group: chosenGroup,
            description: description.trim() || undefined,
          })
        : portalApi.updateAccount(communityId, account.id, {
            // Only sent when it changed. The server compares against the
            // stored value so an unchanged code is harmless either way, but
            // omitting it keeps the audit entry to what was actually edited.
            ...(code.trim() !== account.code ? { code: code.trim() } : {}),
            name: name.trim(),
            group: chosenGroup,
            description: description.trim() || undefined,
            isActive,
          }),
    {
      onSuccess: () => {
        toast(isNew ? 'Account added' : 'Account updated', 'success', `${code.trim()} ${name.trim()}`);
        router.push('/accounting/chart-of-accounts');
        router.refresh();
      },
      onError: (message) => toast('Could not save the account', 'error', message),
    },
  );

  const valid =
    codeShape && !codeClash && name.trim().length > 1 && chosenGroup.length > 1;

  return (
    <>
      <PageHeader
        title={isNew ? 'Add an account' : `Edit ${account.code}`}
        subtitle={
          isNew
            ? 'A new line in your books, ready to post to straight away'
            : account.name
        }
        breadcrumb={
          <Link
            href="/accounting/chart-of-accounts"
            className="inline-flex items-center gap-1 hover:text-navy-900"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Chart of accounts
          </Link>
        }
      />

      {locked ? (
        <Callout tone="info" title="This account is used by the automatic postings">
          You can rename it and change its group or description. It cannot be renumbered or
          switched off, because contributions, savings and loans post to it by code — the books
          would quietly stop recording them.
        </Callout>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          {/* Class first: it decides the code band, the normal side, and
              which half of the accounts this one is read alongside. */}
          <Card>
            <CardHeader
              title="What kind of account is this?"
              subtitle={
                isNew
                  ? 'This decides where it appears in your reports and cannot be changed later.'
                  : 'Fixed once an account exists — moving it would restate everything already posted to it.'
              }
            />
            <div className="grid gap-3 p-5 sm:grid-cols-2" role="radiogroup" aria-label="Account class">
              {ACCOUNT_CLASSES.map((option) => (
                <RadioCard
                  key={option.type}
                  selected={type === option.type}
                  onSelect={() => isNew && setType(option.type)}
                  className={!isNew && type !== option.type ? 'hidden' : undefined}
                  icon={<option.icon className="h-[18px] w-[18px]" />}
                  title={option.label}
                  badge={<Badge tone={option.normal === 'Debit' ? 'blue' : 'purple'}>{option.normal}</Badge>}
                  description={
                    <>
                      {option.blurb}
                      <span className="mt-1 block text-[12px] text-slate-500">
                        e.g. {option.examples}
                      </span>
                    </>
                  }
                />
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader title="Name and number" />
            <div className="space-y-4 p-5">
              <Field
                label="What should it be called?"
                htmlFor="account-name"
                required
                hint="How it will read on your reports. Plain language is better than accounting jargon."
              >
                <Input
                  id="account-name"
                  value={name}
                  placeholder="e.g. Generator fuel"
                  onChange={(event) => setName(event.target.value)}
                />
              </Field>

              <Field
                label="Account code"
                htmlFor="account-code"
                required
                hint={
                  locked
                    ? 'Locked — the posting rules reference this account by its code.'
                    : `${klass.plural} are numbered ${klass.range[0]}–${klass.range[1]}. We have suggested the next free one.`
                }
                error={
                  code.trim() && !codeShape
                    ? 'Digits only, 3 to 8 of them'
                    : codeClash
                      ? `${code.trim()} is already used by "${chart.find((a) => a.code === code.trim())?.name}"`
                      : undefined
                }
              >
                <div className="flex items-center gap-2">
                  <Input
                    id="account-code"
                    inputMode="numeric"
                    className="max-w-[140px]"
                    value={code}
                    disabled={locked}
                    onChange={(event) => setTypedCode(event.target.value.replace(/\D/g, ''))}
                  />
                  {isNew && codeTouched ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={<Sparkles className="h-3.5 w-3.5" />}
                      // Back to the suggestion, which resumes following the
                      // class if the officer changes it again.
                      onClick={() => setTypedCode(null)}
                    >
                      Suggest one
                    </Button>
                  ) : null}
                </div>
              </Field>

              {/* A warning, not a block: a community that has always numbered
                  its generator fuel 7100 should be allowed to keep doing so. */}
              {codeOutOfBand ? (
                <Callout tone="warning">
                  {code.trim()} sits outside the usual {klass.range[0]}–{klass.range[1]} range for{' '}
                  {klass.plural.toLowerCase()}. That is allowed — your reports group by class, not
                  by number — but it will read oddly to an auditor expecting the convention.
                </Callout>
              ) : null}

              <Field
                label="Which section does it belong to?"
                htmlFor="account-group"
                required
                hint="Groups the account under a heading on your reports."
              >
                {groups.length > 0 ? (
                  <Select
                    id="account-group"
                    value={groups.includes(group) ? group : group ? NEW_GROUP : ''}
                    onChange={(event) => {
                      setGroup(event.target.value);
                      if (event.target.value !== NEW_GROUP) setNewGroup('');
                    }}
                  >
                    <option value="">Choose a section…</option>
                    {groups.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                    <option value={NEW_GROUP}>+ A new section…</option>
                  </Select>
                ) : (
                  <Input
                    id="account-group"
                    value={newGroup || group}
                    placeholder="e.g. Premises"
                    onChange={(event) => {
                      setGroup(NEW_GROUP);
                      setNewGroup(event.target.value);
                    }}
                  />
                )}
              </Field>

              {group === NEW_GROUP && groups.length > 0 ? (
                <Field label="New section name" htmlFor="account-new-group" required>
                  <Input
                    id="account-new-group"
                    value={newGroup}
                    placeholder="e.g. Premises"
                    onChange={(event) => setNewGroup(event.target.value)}
                  />
                </Field>
              ) : null}

              <Field
                label="Description"
                htmlFor="account-description"
                optional
                hint="What belongs in this account, for whoever posts to it next year."
              >
                <Textarea
                  id="account-description"
                  rows={2}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                />
              </Field>

              {!isNew && !locked ? (
                <div className="border-t border-slate-100 pt-4">
                  <Toggle checked={isActive} onChange={setIsActive} label="Open for posting" />
                  <p className="mt-1.5 text-[12.5px] leading-5 text-slate-500">
                    {isActive
                      ? 'Journal entries can post to this account.'
                      : 'Hidden from new journal entries. Everything already posted to it stays on the books and in your statements — closing an account is not the same as deleting it.'}
                  </p>
                </div>
              ) : null}
            </div>
          </Card>

          <div className="flex items-center gap-3">
            <Button loading={save.pending} disabled={!valid} onClick={() => save.run()}>
              {isNew ? 'Add account' : 'Save changes'}
            </Button>
            <Button variant="ghost" onClick={() => router.back()}>
              Cancel
            </Button>
          </div>
        </div>

        {/* What it will look like, built from the same pieces the chart
            renders — so the answer to "did I get this right?" is visible
            before saving rather than after. */}
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <Card>
            <CardHeader title="How it will appear" />
            <div className="p-5">
              <div className="rounded-xl border border-slate-200 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  {chosenGroup || 'Section'}
                </p>
                <p className="mt-2 flex items-center gap-2">
                  <span className="tnum text-[15px] font-semibold text-navy-900">
                    {code || '—'}
                  </span>
                  <span className="text-[15px] font-medium text-navy-900">
                    {name || 'Account name'}
                  </span>
                  {locked ? <Lock className="h-3 w-3 text-slate-400" /> : null}
                </p>
                <p className="mt-2 flex flex-wrap items-center gap-1.5">
                  <Badge tone="slate">{klass.label}</Badge>
                  <Badge tone={klass.normal === 'Debit' ? 'blue' : 'purple'}>
                    Increases on {klass.normal.toLowerCase()}
                  </Badge>
                </p>
                {description ? (
                  <p className="mt-2 text-[12.5px] leading-5 text-slate-500">{description}</p>
                ) : null}
              </div>

              <ul className="mt-4 space-y-2">
                {[
                  `A ${klass.normal.toLowerCase()} increases this account`,
                  isNew
                    ? 'Postable from a journal entry as soon as you save'
                    : 'Existing postings are unaffected by these changes',
                  isNew
                    ? 'Yours to rename, renumber or close at any time'
                    : locked
                      ? 'Renaming only — the posting rules use this code'
                      : 'Yours to rename, renumber or close at any time',
                ].map((line) => (
                  <li key={line} className="flex items-start gap-2 text-[12.5px] text-slate-600">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-green-600" strokeWidth={3} />
                    {line}
                  </li>
                ))}
              </ul>
            </div>
          </Card>
        </aside>
      </div>
    </>
  );
}
