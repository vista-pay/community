/**
 * What the API says when an action has gone to the community's officers.
 *
 * Deliberately free of imports. `lib/api` publishes on it and the dialog that
 * renders it subscribes, and neither can be allowed to pull the other in —
 * the parser living next to `ApiError` would make the module graph circular
 * for the sake of one type.
 */

/** The discriminator the API sets on the 428. */
export const APPROVAL_REQUIRED = 'APPROVAL_REQUIRED';

export interface ApprovalChallenge {
  requestId: string;
  reference: string;
  operation: string;
  operationLabel: string;
  /** One line naming what was submitted, as the officers will read it. */
  title: string;
  status: string;
  currentStage: { position: number; of: number; awaiting: string } | null;
  approvals: { given: number; required: number };
  /** The whole sequence, in order. */
  stages: { position: number; role: string; status: string; isFinalAuthority: boolean }[];
  amount: string | null;
  currencyCode: string | null;
  /** False when the request already existed — the officer is retrying. */
  raised: boolean;
}

/** The challenge carried by a response, or null if it is anything else. */
export function readApprovalChallenge(status: number, body: unknown): ApprovalChallenge | null {
  if (status !== 428) return null;
  const payload = body as { code?: string; errors?: ApprovalChallenge } | null;
  if (payload?.code !== APPROVAL_REQUIRED || !payload.errors?.reference) return null;
  return payload.errors;
}

// ───────────────────────────── The bus ─────────────────────────────
//
// An action can be sent to the approval workflow from any of twenty screens,
// and every one of them would otherwise have to know to catch a 428 and say
// something sensible about it. Instead the API client publishes the challenge
// the moment it arrives and one dialog in the portal shell shows it, so a
// screen that knows nothing about approvals still reports the outcome
// correctly.

type Listener = (challenge: ApprovalChallenge) => void;
const listeners = new Set<Listener>();

export function publishApprovalChallenge(challenge: ApprovalChallenge) {
  listeners.forEach((listener) => listener(challenge));
}

export function subscribeApprovalChallenge(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
