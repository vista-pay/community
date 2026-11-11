'use client';

import { useMemo, useState } from 'react';
import { BookOpen, Check, Plus, Sparkles } from 'lucide-react';
import { Callout, Field, Input, RadioCard, Select, Textarea } from '@/components/ui';
import { useQuery } from '@/hooks/use-query';
import { useCommunityId } from '@/components/providers/session-provider';
import { portalApi } from '@/services/portal';
import type { CoaChoice, CoaOptions, CoaSelectionKey } from '@/types';

/** The choice a form starts on: whatever the posting rules already name. */
export const SYSTEM_COA_CHOICE: CoaChoice = { mode: 'SYSTEM' };

/**
 * Drop the choice when it is the default, so the API stores null and the
 * record follows the chart if the default ever moves.
 */
export const coaChoicePayload = (choice: CoaChoice): CoaChoice | undefined =>
  choice.mode === 'SYSTEM' ? undefined : choice;

/** Whether what the officer has filled in is actually sendable. */
export function isCoaChoiceComplete(choice: CoaChoice) {
  if (choice.mode === 'SYSTEM') return true;
  if (choice.mode === 'EXISTING') return Boolean(choice.accountCode);
  return Boolean(choice.newAccount?.name?.trim());
}

/**
 * Which account in the chart the thing being created posts to.
 *
 * Three choices, in the order they are actually wanted: keep what the system
 * picked (pre-selected, and the only one most communities will ever use),
 * point it at an account already in the chart, or create one here. The third
 * matters more than it looks — without it, a treasurer who wants the
 * Christmas fund on its own line has to abandon this form, go to
 * Accounting, add an account, come back and start again.
 *
 * The options come from the API, including the type rule and the wording, so
 * the form cannot offer an expense account for a savings liability and the
 * label an officer reads here is the label the books will carry.
 */
export function AccountSelector({
  selection,
  value,
  onChange,
  idPrefix = 'coa',
}: {
  selection: CoaSelectionKey;
  value: CoaChoice;
  onChange: (choice: CoaChoice) => void;
  /** Keeps field ids unique when two selectors share a page. */
  idPrefix?: string;
}) {
  const communityId = useCommunityId();
  const [expanded, setExpanded] = useState(false);

  const { data, loading, error } = useQuery<CoaOptions>(
    () => portalApi.coaOptions(communityId, selection),
    [communityId, selection],
  );

  const alternatives = useMemo(
    () => [...(data?.suggested ?? []), ...(data?.others ?? [])],
    [data],
  );
  const chosenExisting = alternatives.find((a) => a.code === value.accountCode);

  if (error) {
    // Not fatal: the system default still applies, and blocking the whole
    // form because an optional refinement could not load would be worse
    // than losing the refinement.
    return (
      <Callout tone="warning" title="Could not load your chart of accounts">
        {error} This will post to the account the system normally uses.
      </Callout>
    );
  }

  const spec = data?.selection;
  const summary = loading
    ? 'Checking your chart of accounts…'
    : value.mode === 'SYSTEM'
      ? data?.systemDefault
        ? `${data.systemDefault.code} · ${data.systemDefault.name}`
        : 'The account the system normally uses'
      : value.mode === 'EXISTING'
        ? chosenExisting
          ? `${chosenExisting.code} · ${chosenExisting.name}`
          : 'Pick an account'
        : `New account · ${value.newAccount?.name?.trim() || 'not named yet'}`;

  return (
    <section className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-navy-900">
            <BookOpen className="h-4 w-4 text-brand-600" />
            {spec?.label ?? 'Accounting'}
          </h3>
          <p className="mt-1 text-[13px] text-slate-600">
            Posts to <span className="font-medium text-navy-900">{summary}</span>
          </p>
        </div>
        <button
          type="button"
          onClick={() => setExpanded((open) => !open)}
          className="shrink-0 text-[13px] font-semibold text-brand-700 hover:underline"
          aria-expanded={expanded}
        >
          {expanded ? 'Done' : 'Change'}
        </button>
      </div>

      {!expanded && value.mode === 'SYSTEM' && (
        <p className="mt-2 text-[13px] text-slate-500">
          Nothing to do — this is the account a cooperative&apos;s books normally use. Change it only
          if you report this separately.
        </p>
      )}

      {expanded && spec && (
        <div className="mt-4 space-y-3">
          <p className="text-[13px] font-medium text-navy-900">{spec.question}</p>

          <RadioCard
            selected={value.mode === 'SYSTEM'}
            onSelect={() => onChange({ mode: 'SYSTEM' })}
            icon={<Check className="h-4 w-4" />}
            badge={<span className="text-[11px] font-semibold text-brand-700">Recommended</span>}
            title={
              data?.systemDefault
                ? `Keep ${data.systemDefault.code} · ${data.systemDefault.name}`
                : 'Keep the account the system picked'
            }
            description={
              data?.systemDefault?.description ??
              'The standard account for this in a cooperative chart.'
            }
          />

          <RadioCard
            selected={value.mode === 'EXISTING'}
            onSelect={() =>
              onChange({
                mode: 'EXISTING',
                accountCode: value.accountCode ?? alternatives[0]?.code,
              })
            }
            icon={<BookOpen className="h-4 w-4" />}
            title="Use another account already in my chart"
            description={
              alternatives.length === 0
                ? `You have no other ${spec.type.toLowerCase()} account to choose. Create one below instead.`
                : `${alternatives.length} ${spec.type.toLowerCase()} account${alternatives.length === 1 ? '' : 's'} would fit.`
            }
          />

          {value.mode === 'EXISTING' && alternatives.length > 0 && (
            <div className="pl-4">
              <Field label="Account" htmlFor={`${idPrefix}-existing`} required>
                <Select
                  id={`${idPrefix}-existing`}
                  value={value.accountCode ?? ''}
                  onChange={(event) =>
                    onChange({ mode: 'EXISTING', accountCode: event.target.value })
                  }
                >
                  {(data?.suggested ?? []).length > 0 && (
                    <optgroup label={spec.group}>
                      {data!.suggested.map((account) => (
                        <option key={account.code} value={account.code}>
                          {account.code} · {account.name}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {(data?.others ?? []).length > 0 && (
                    <optgroup label="Other accounts of the same type">
                      {data!.others.map((account) => (
                        <option key={account.code} value={account.code}>
                          {account.code} · {account.name} ({account.group})
                        </option>
                      ))}
                    </optgroup>
                  )}
                </Select>
              </Field>
            </div>
          )}

          <RadioCard
            selected={value.mode === 'NEW'}
            onSelect={() =>
              onChange({
                mode: 'NEW',
                newAccount: value.newAccount ?? { code: data?.nextCode, name: '', group: spec.group },
              })
            }
            icon={<Plus className="h-4 w-4" />}
            title="Create a new account for this"
            description={`Added to your chart as ${data?.nextCode ?? 'the next free code'}, in ${spec.group}. You do not have to leave this form.`}
          />

          {value.mode === 'NEW' && (
            <div className="grid gap-4 pl-4 sm:grid-cols-2">
              <Field
                label="Account name"
                htmlFor={`${idPrefix}-new-name`}
                required
                hint={spec.nameHint}
              >
                <Input
                  id={`${idPrefix}-new-name`}
                  value={value.newAccount?.name ?? ''}
                  onChange={(event) =>
                    onChange({
                      mode: 'NEW',
                      newAccount: { ...value.newAccount, name: event.target.value },
                    })
                  }
                />
              </Field>
              <Field
                label="Code"
                htmlFor={`${idPrefix}-new-code`}
                hint="Suggested for you — change it only if your chart is numbered differently."
              >
                <Input
                  id={`${idPrefix}-new-code`}
                  value={value.newAccount?.code ?? data?.nextCode ?? ''}
                  onChange={(event) =>
                    onChange({
                      mode: 'NEW',
                      newAccount: {
                        ...value.newAccount,
                        name: value.newAccount?.name ?? '',
                        code: event.target.value,
                      },
                    })
                  }
                />
              </Field>
              <div className="sm:col-span-2">
                <Field
                  label="Group"
                  htmlFor={`${idPrefix}-new-group`}
                  optional
                  hint="Where it sits in your chart. Defaults to the group this kind of account belongs in."
                >
                  <Input
                    id={`${idPrefix}-new-group`}
                    value={value.newAccount?.group ?? spec.group}
                    onChange={(event) =>
                      onChange({
                        mode: 'NEW',
                        newAccount: {
                          ...value.newAccount,
                          name: value.newAccount?.name ?? '',
                          group: event.target.value,
                        },
                      })
                    }
                  />
                </Field>
              </div>
              <div className="sm:col-span-2">
                <Field label="What it is for" htmlFor={`${idPrefix}-new-desc`} optional>
                  <Textarea
                    id={`${idPrefix}-new-desc`}
                    rows={2}
                    value={value.newAccount?.description ?? ''}
                    onChange={(event) =>
                      onChange({
                        mode: 'NEW',
                        newAccount: {
                          ...value.newAccount,
                          name: value.newAccount?.name ?? '',
                          description: event.target.value,
                        },
                      })
                    }
                  />
                </Field>
              </div>
            </div>
          )}

          {/* What this account will actually carry. An officer choosing a
              posting account should be able to see the postings, not take
              the label on trust. */}
          <div className="rounded-xl bg-white p-3.5 ring-1 ring-inset ring-slate-200">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              <Sparkles className="h-3.5 w-3.5" /> What posts here
            </p>
            <ul className="mt-2 space-y-1">
              {spec.postings.map((line) => (
                <li key={line} className="text-[13px] leading-5 text-slate-600">
                  · {line}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </section>
  );
}
