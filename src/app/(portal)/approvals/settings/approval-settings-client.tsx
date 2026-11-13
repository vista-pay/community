'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import { ArrowLeft, GripVertical, Lock, Plus, RotateCcw, Trash2 } from 'lucide-react';
import {
  Badge,
  Button,
  Callout,
  Card,
  ConfirmDialog,
  Drawer,
  Field,
  Input,
  PageHeader,
  Select,
  Spinner,
  Toggle,
} from '@/components/ui';
import { useMutation, useQuery } from '@/hooks/use-query';
import { useCommunityId } from '@/components/providers/session-provider';
import { useToast } from '@/components/providers/toast-provider';
import { portalApi } from '@/services/portal';
import { money as formatMoney } from '@/lib/format';
import type {
  ApprovalMode,
  ApprovalOperationSetting,
  ApprovalPolicyInput,
  ApprovalPolicyOverview,
} from '@/types';

/** A stage as the editor holds it, before it is sent. */
interface DraftStage {
  key: string;
  roleId: string;
  requiredApprovals: number;
  isFinalAuthority: boolean;
  isOptional: boolean;
  instruction: string;
}

interface DraftBand {
  key: string;
  minAmount: string;
  maxAmount: string;
  mode: ApprovalMode;
  allowSelfApproval: boolean;
  expiresAfterHours: string;
  autoExecute: boolean;
  stages: DraftStage[];
}

let keySeq = 0;
const nextKey = () => `k${(keySeq += 1)}`;

/**
 * Approval Workflow & Authorisation Settings.
 *
 * The President or administrator decides, per operation, which officers must
 * sign off, in what order, how many of them, who gives the final
 * authorisation, and above what amount an extra officer is pulled in.
 *
 * Nothing here names a post the platform invented: every stage is chosen from
 * the community's own roles, so a cooperative that calls its treasurer the
 * Purse Bearer configures a Purse Bearer.
 */
export function ApprovalSettingsClient() {
  const communityId = useCommunityId();
  const { toast } = useToast();
  const overview = useQuery(() => portalApi.approvalPolicies(communityId), [communityId]);
  const [editing, setEditing] = useState<ApprovalOperationSetting | null>(null);
  const [resetting, setResetting] = useState<ApprovalOperationSetting | null>(null);

  const reset = useMutation(
    (operation: string) => portalApi.resetApprovalPolicy(communityId, operation),
    {
      onSuccess: (data) => {
        overview.setData(data as ApprovalPolicyOverview);
        setResetting(null);
        toast('Back to the recommended sequence', 'success');
      },
      onError: (message) => toast('Could not reset it', 'error', message),
    },
  );

  const data = overview.data;

  return (
    <>
      <PageHeader
        breadcrumb={
          <Link href={'/approvals' as Route} className="inline-flex items-center gap-1 hover:text-navy-900">
            <ArrowLeft className="h-3.5 w-3.5" /> Approvals
          </Link>
        }
        title="Approval workflow & authorisation"
        subtitle="Decide which officers must review each kind of decision, in what order, and who gives the final authorisation."
      />

      {overview.loading && !data ? (
        <div className="py-16 text-center">
          <Spinner />
        </div>
      ) : !data ? (
        <Callout tone="danger">{overview.error ?? 'Could not load your approval settings.'}</Callout>
      ) : (
        <div className="space-y-6">
          <Callout tone="info" title="How this works">
            An operation with no configuration of its own follows the recommended sequence, using
            whichever of those posts your community actually fills. Set your own and it replaces
            that entirely. A few operations cannot be switched off — releasing money and changing
            where it settles always need more than one officer on Rendi.
          </Callout>

          {data.roles.filter((r) => r.activeHolders > 0).length < 2 && (
            <Callout tone="warning" title="Only one post is filled">
              Multi-level approval needs at least two officers. Until a second post has a holder,
              nothing can be put in front of two people and these settings have no effect.
            </Callout>
          )}

          {data.categories.map((category) => (
            <section key={category.category}>
              <h2 className="mb-3 text-lg font-semibold text-navy-900">{category.label}</h2>
              <div className="space-y-3">
                {category.operations.map((operation) => (
                  <OperationCard
                    key={operation.key}
                    operation={operation}
                    onEdit={() => setEditing(operation)}
                    onReset={() => setResetting(operation)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {editing && data && (
        <PolicyEditor
          communityId={communityId}
          operation={editing}
          roles={data.roles}
          onClose={() => setEditing(null)}
          onSaved={(next) => {
            overview.setData(next);
            setEditing(null);
            toast('Approval workflow saved', 'success');
          }}
          toast={toast}
        />
      )}

      <ConfirmDialog
        open={Boolean(resetting)}
        onClose={() => setResetting(null)}
        title={`Reset ${resetting?.label ?? ''}?`}
        confirmLabel="Reset"
        loading={reset.pending}
        onConfirm={() => resetting && void reset.run(resetting.key)}
        body={
          <>
            Your own sequence is deleted and this operation goes back to the recommended one.
            Requests already in progress keep the sequence they were raised under.
          </>
        }
      />
    </>
  );
}

function OperationCard({
  operation,
  onEdit,
  onReset,
}: {
  operation: ApprovalOperationSetting;
  onEdit: () => void;
  onReset: () => void;
}) {
  const enabled = operation.isConfigured
    ? operation.bands.some((b) => b.isEnabled)
    : Boolean(operation.effective);

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-navy-900">{operation.label}</h3>
            {operation.mandatory && (
              <Badge tone="blue">
                <Lock className="mr-1 inline h-3 w-3" />
                Always required
              </Badge>
            )}
            {operation.movesMoney && <Badge tone="amber">Moves money</Badge>}
            {!operation.isConfigured && operation.effective && (
              <Badge tone="slate">Recommended default</Badge>
            )}
            {!enabled && <Badge tone="slate">Off</Badge>}
          </div>
          <p className="mt-1 text-sm text-slate-600">{operation.description}</p>

          <div className="mt-3">
            {operation.isConfigured ? (
              <div className="space-y-2">
                {operation.bands.map((band) => (
                  <div key={band.id} className="rounded-lg bg-slate-50 p-2.5">
                    {operation.movesMoney && (
                      <p className="mb-1 text-xs font-semibold text-slate-500">
                        {formatMoney(band.minAmount, band.currencyCode)}
                        {band.maxAmount
                          ? ` – ${formatMoney(band.maxAmount, band.currencyCode)}`
                          : ' and above'}
                      </p>
                    )}
                    <StageChips
                      stages={band.steps.map((s) => ({
                        label: s.roleLabel ?? 'Named officer',
                        isFinalAuthority: s.isFinalAuthority,
                        isOptional: s.isOptional,
                        requiredApprovals: s.requiredApprovals,
                      }))}
                      mode={band.mode}
                    />
                  </div>
                ))}
              </div>
            ) : operation.effective ? (
              <StageChips
                stages={operation.effective.stages.map((s) => ({
                  label: s.role ?? 'Officer',
                  isFinalAuthority: s.isFinalAuthority,
                  isOptional: false,
                  requiredApprovals: 1,
                }))}
                mode={operation.effective.mode}
              />
            ) : (
              <p className="text-sm text-amber-700">
                Nothing applies yet — the recommended sequence names{' '}
                {operation.recommended.map(humaniseRole).join(', ')}, and fewer than two of those
                posts are filled.
              </p>
            )}
          </div>

          {!operation.canAutoExecute && operation.movesMoney && (
            <p className="mt-2 text-xs text-slate-500">
              Once approved, a finance officer completes this one in its own screen — releasing
              money also needs the owner&apos;s code, which no automatic step can supply.
            </p>
          )}
        </div>

        <div className="flex shrink-0 gap-2">
          {operation.isConfigured && (
            <Button variant="secondary" size="sm" icon={<RotateCcw className="h-3.5 w-3.5" />} onClick={onReset}>
              Reset
            </Button>
          )}
          <Button size="sm" onClick={onEdit}>
            {operation.isConfigured ? 'Edit' : 'Configure'}
          </Button>
        </div>
      </div>
    </Card>
  );
}

function StageChips({
  stages,
  mode,
}: {
  stages: { label: string; isFinalAuthority: boolean; isOptional: boolean; requiredApprovals: number }[];
  mode: ApprovalMode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {stages.map((stage, index) => (
        <span key={`${stage.label}-${index}`} className="flex items-center gap-1.5">
          {index > 0 && (
            <span className="text-xs text-slate-400">{mode === 'PARALLEL' ? '+' : '→'}</span>
          )}
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-medium ${
              stage.isFinalAuthority
                ? 'bg-blue-100 text-blue-900'
                : 'bg-white text-slate-700 ring-1 ring-slate-200'
            }`}
          >
            {stage.label}
            {stage.requiredApprovals > 1 ? ` ×${stage.requiredApprovals}` : ''}
            {stage.isOptional ? ' (optional)' : ''}
          </span>
        </span>
      ))}
    </div>
  );
}

/** The editor: bands, and the sequence inside each one. */
function PolicyEditor({
  communityId,
  operation,
  roles,
  onClose,
  onSaved,
  toast,
}: {
  communityId: string;
  operation: ApprovalOperationSetting;
  roles: ApprovalPolicyOverview['roles'];
  onClose: () => void;
  onSaved: (next: ApprovalPolicyOverview) => void;
  toast: ReturnType<typeof useToast>['toast'];
}) {
  const staffed = useMemo(() => roles.filter((r) => r.activeHolders > 0), [roles]);

  const [enabled, setEnabled] = useState(
    operation.isConfigured ? operation.bands.some((b) => b.isEnabled) : true,
  );
  const [bands, setBands] = useState<DraftBand[]>(() => fromOperation(operation, staffed));

  const save = useMutation(
    () =>
      portalApi.saveApprovalPolicy(communityId, operation.key, {
        isEnabled: enabled,
        bands: bands.map((band) => ({
          minAmount: operation.movesMoney ? band.minAmount || '0' : '0',
          ...(operation.movesMoney && band.maxAmount ? { maxAmount: band.maxAmount } : {}),
          mode: band.mode,
          allowSelfApproval: band.allowSelfApproval,
          expiresAfterHours: Number(band.expiresAfterHours || 0),
          autoExecute: band.autoExecute,
          steps: band.stages.map((stage) => ({
            roleId: stage.roleId,
            requiredApprovals: stage.requiredApprovals,
            isFinalAuthority: stage.isFinalAuthority,
            isOptional: stage.isOptional,
            ...(stage.instruction.trim() ? { instruction: stage.instruction.trim() } : {}),
          })),
        })),
      } satisfies ApprovalPolicyInput),
    {
      onSuccess: (next) => onSaved(next as ApprovalPolicyOverview),
      onError: (message) => toast('Could not save that workflow', 'error', message),
    },
  );

  const updateBand = (key: string, patch: Partial<DraftBand>) =>
    setBands((list) => list.map((b) => (b.key === key ? { ...b, ...patch } : b)));

  const updateStage = (bandKey: string, stageKey: string, patch: Partial<DraftStage>) =>
    setBands((list) =>
      list.map((b) =>
        b.key === bandKey
          ? {
              ...b,
              stages: b.stages.map((s) => (s.key === stageKey ? { ...s, ...patch } : s)),
              // Final authority is singular: setting it on one clears the rest.
              ...(patch.isFinalAuthority
                ? {
                    stages: b.stages.map((s) => ({
                      ...s,
                      ...(s.key === stageKey ? patch : { isFinalAuthority: false }),
                    })),
                  }
                : {}),
            }
          : b,
      ),
    );

  const moveStage = (bandKey: string, index: number, direction: -1 | 1) =>
    setBands((list) =>
      list.map((b) => {
        if (b.key !== bandKey) return b;
        const target = index + direction;
        if (target < 0 || target >= b.stages.length) return b;
        const stages = [...b.stages];
        [stages[index], stages[target]] = [stages[target], stages[index]];
        return { ...b, stages };
      }),
    );

  const canSave =
    !enabled ||
    (bands.length > 0 &&
      bands.every((b) => b.stages.length > 0 && b.stages.every((s) => s.roleId)));

  return (
    <Drawer
      open
      onClose={onClose}
      width="max-w-3xl"
      title={operation.label}
      subtitle={operation.description}
      footer={
        <div className="flex w-full justify-between gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={save.pending} disabled={!canSave} onClick={() => void save.run()}>
            Save workflow
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        {operation.mandatory ? (
          <Callout tone="info">
            This one always needs more than one officer. You decide who and in what order; you
            cannot switch it off.
          </Callout>
        ) : (
          <Toggle
            checked={enabled}
            onChange={setEnabled}
            label="Require multiple officers for this operation"
          />
        )}

        {staffed.length < 2 && (
          <Callout tone="warning">
            Only one post in this community has a holder. Fill a second post before relying on
            this workflow — an officer cannot approve their own request.
          </Callout>
        )}

        {enabled &&
          bands.map((band, bandIndex) => (
            <Card key={band.key} className="p-4">
              {operation.movesMoney && (
                <div className="mb-4 grid gap-3 sm:grid-cols-2">
                  <Field label="From amount" htmlFor={`min-${band.key}`} hint="Bands must start at 0 and meet exactly.">
                    <Input
                      id={`min-${band.key}`}
                      value={band.minAmount}
                      inputMode="decimal"
                      disabled={bandIndex === 0}
                      onChange={(e) => updateBand(band.key, { minAmount: e.target.value })}
                    />
                  </Field>
                  <Field
                    label="Up to"
                    htmlFor={`max-${band.key}`}
                    hint={
                      bandIndex === bands.length - 1
                        ? 'The top band is open-ended.'
                        : 'Where the next band begins.'
                    }
                  >
                    <Input
                      id={`max-${band.key}`}
                      value={band.maxAmount}
                      inputMode="decimal"
                      placeholder={bandIndex === bands.length - 1 ? 'No limit' : ''}
                      disabled={bandIndex === bands.length - 1}
                      onChange={(e) => {
                        updateBand(band.key, { maxAmount: e.target.value });
                        // The next band starts exactly where this one ends.
                        const next = bands[bandIndex + 1];
                        if (next) updateBand(next.key, { minAmount: e.target.value });
                      }}
                    />
                  </Field>
                </div>
              )}

              <div className="space-y-2">
                {band.stages.map((stage, index) => (
                  <div key={stage.key} className="rounded-xl border border-slate-200 p-3">
                    <div className="flex items-start gap-2">
                      <div className="flex flex-col items-center pt-2">
                        <GripVertical className="h-4 w-4 text-slate-300" />
                        <span className="text-xs font-bold text-slate-500">{index + 1}</span>
                      </div>
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                          <Select
                            aria-label={`Stage ${index + 1} approver`}
                            value={stage.roleId}
                            onChange={(e) => updateStage(band.key, stage.key, { roleId: e.target.value })}
                          >
                            <option value="">Choose a post…</option>
                            {roles.map((role) => (
                              <option key={role.id} value={role.id} disabled={role.activeHolders === 0}>
                                {role.label}
                                {role.activeHolders === 0 ? ' — nobody holds this' : ''}
                                {role.activeHolders > 1 ? ` (${role.activeHolders} holders)` : ''}
                              </option>
                            ))}
                          </Select>
                          <div className="flex gap-1">
                            <Button
                              variant="secondary"
                              size="sm"
                              disabled={index === 0}
                              onClick={() => moveStage(band.key, index, -1)}
                              aria-label="Move earlier"
                            >
                              ↑
                            </Button>
                            <Button
                              variant="secondary"
                              size="sm"
                              disabled={index === band.stages.length - 1}
                              onClick={() => moveStage(band.key, index, 1)}
                              aria-label="Move later"
                            >
                              ↓
                            </Button>
                            <Button
                              variant="secondary"
                              size="sm"
                              aria-label="Remove stage"
                              onClick={() =>
                                updateBand(band.key, {
                                  stages: band.stages.filter((s) => s.key !== stage.key),
                                })
                              }
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                          <label className="flex items-center gap-1.5">
                            <input
                              type="radio"
                              name={`final-${band.key}`}
                              checked={stage.isFinalAuthority}
                              onChange={() =>
                                updateStage(band.key, stage.key, { isFinalAuthority: true })
                              }
                            />
                            <span className="text-slate-700">Final authorisation</span>
                          </label>
                          <label className="flex items-center gap-1.5">
                            <input
                              type="checkbox"
                              checked={stage.isOptional}
                              onChange={(e) =>
                                updateStage(band.key, stage.key, { isOptional: e.target.checked })
                              }
                            />
                            <span className="text-slate-700">Advisory only</span>
                          </label>
                          <label className="flex items-center gap-1.5">
                            <span className="text-slate-500">Approvals needed</span>
                            <Input
                              className="w-16"
                              inputMode="numeric"
                              value={String(stage.requiredApprovals)}
                              onChange={(e) =>
                                updateStage(band.key, stage.key, {
                                  requiredApprovals: Math.max(1, Number(e.target.value) || 1),
                                })
                              }
                            />
                          </label>
                        </div>

                        <Input
                          placeholder="What should this officer check? (optional)"
                          value={stage.instruction}
                          onChange={(e) =>
                            updateStage(band.key, stage.key, { instruction: e.target.value })
                          }
                        />
                      </div>
                    </div>
                  </div>
                ))}

                <Button
                  variant="secondary"
                  size="sm"
                  icon={<Plus className="h-3.5 w-3.5" />}
                  onClick={() =>
                    updateBand(band.key, {
                      stages: [
                        ...band.stages,
                        {
                          key: nextKey(),
                          roleId: '',
                          requiredApprovals: 1,
                          isFinalAuthority: band.stages.length === 0,
                          isOptional: false,
                          instruction: '',
                        },
                      ],
                    })
                  }
                >
                  Add a stage
                </Button>
              </div>

              <div className="mt-4 space-y-3 border-t border-slate-200 pt-4">
                <Field label="How the stages run" htmlFor={`mode-${band.key}`}>
                  <Select
                    id={`mode-${band.key}`}
                    value={band.mode}
                    onChange={(e) =>
                      updateBand(band.key, { mode: e.target.value as ApprovalMode })
                    }
                  >
                    <option value="SEQUENTIAL">One after another, in this order</option>
                    <option value="PARALLEL">All at once — any order</option>
                  </Select>
                </Field>
                <Toggle
                  checked={band.allowSelfApproval}
                  onChange={(v) => updateBand(band.key, { allowSelfApproval: v })}
                  label="Let an officer approve a request they raised themselves"
                  size="sm"
                />
                {operation.canAutoExecute && (
                  <Toggle
                    checked={band.autoExecute}
                    onChange={(v) => updateBand(band.key, { autoExecute: v })}
                    label="Carry the action out automatically once fully approved"
                    size="sm"
                  />
                )}
                <Field
                  label="Expire after (hours)"
                  htmlFor={`exp-${band.key}`}
                  hint="0 means a request waits until someone decides it."
                >
                  <Input
                    id={`exp-${band.key}`}
                    className="w-28"
                    inputMode="numeric"
                    value={band.expiresAfterHours}
                    onChange={(e) =>
                      updateBand(band.key, { expiresAfterHours: e.target.value })
                    }
                  />
                </Field>
              </div>

              {bands.length > 1 && (
                <div className="mt-3 text-right">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setBands((list) => closeGaps(list.filter((b) => b.key !== band.key)))}
                  >
                    Remove this band
                  </Button>
                </div>
              )}
            </Card>
          ))}

        {enabled && operation.movesMoney && (
          <Button
            variant="secondary"
            icon={<Plus className="h-4 w-4" />}
            onClick={() =>
              setBands((list) => {
                const last = list[list.length - 1];
                const floor = last?.maxAmount || '100000';
                return closeGaps([
                  ...list.map((b, i) =>
                    i === list.length - 1 ? { ...b, maxAmount: b.maxAmount || floor } : b,
                  ),
                  {
                    key: nextKey(),
                    minAmount: floor,
                    maxAmount: '',
                    mode: last?.mode ?? 'SEQUENTIAL',
                    allowSelfApproval: false,
                    expiresAfterHours: '0',
                    autoExecute: true,
                    stages: last ? last.stages.map((s) => ({ ...s, key: nextKey() })) : [],
                  },
                ]);
              })
            }
          >
            Add a higher-amount band
          </Button>
        )}
      </div>
    </Drawer>
  );
}

/** The saved policy, or the recommended one, as editable drafts. */
function fromOperation(
  operation: ApprovalOperationSetting,
  staffed: ApprovalPolicyOverview['roles'],
): DraftBand[] {
  if (operation.isConfigured && operation.bands.length) {
    return operation.bands.map((band) => ({
      key: nextKey(),
      minAmount: band.minAmount,
      maxAmount: band.maxAmount ?? '',
      mode: band.mode,
      allowSelfApproval: band.allowSelfApproval,
      expiresAfterHours: String(band.expiresAfterHours),
      autoExecute: band.autoExecute,
      stages: band.steps.map((step) => ({
        key: nextKey(),
        roleId: step.roleId ?? '',
        requiredApprovals: step.requiredApprovals,
        isFinalAuthority: step.isFinalAuthority,
        isOptional: step.isOptional,
        instruction: step.instruction ?? '',
      })),
    }));
  }

  // Seed the editor from the recommended sequence, matched to this
  // community's own posts by label, so the first edit starts from something
  // sensible rather than an empty list.
  const recommended = operation.recommended
    .map((name) => staffed.find((r) => r.name === name))
    .filter((role): role is ApprovalPolicyOverview['roles'][number] => Boolean(role));

  return [
    {
      key: nextKey(),
      minAmount: '0',
      maxAmount: '',
      mode: 'SEQUENTIAL',
      allowSelfApproval: false,
      expiresAfterHours: '0',
      autoExecute: true,
      stages: recommended.map((role, index) => ({
        key: nextKey(),
        roleId: role.id,
        requiredApprovals: 1,
        isFinalAuthority: index === recommended.length - 1,
        isOptional: false,
        instruction: '',
      })),
    },
  ];
}

/** Bands must tile without gaps; removing one re-joins its neighbours. */
function closeGaps(bands: DraftBand[]): DraftBand[] {
  return bands.map((band, index) => ({
    ...band,
    minAmount: index === 0 ? '0' : bands[index - 1].maxAmount || band.minAmount,
    maxAmount: index === bands.length - 1 ? '' : band.maxAmount,
  }));
}

function humaniseRole(name: string) {
  return name
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
