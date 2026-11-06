import 'server-only';
import { API_BASE } from './constants';
import { getAccessToken, refreshSession } from './session';

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public body?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type Params = Record<string, string | number | boolean | undefined | null>;

function buildUrl(path: string, params?: Params) {
  const url = `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;
  if (!params) return url;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
  }
  const s = qs.toString();
  return s ? `${url}?${s}` : url;
}

/**
 * Call the Nest API from a server component or route handler.
 *
 * Retries once through a token refresh: access tokens are short-lived, and
 * without this a page render that lands a second after expiry would bounce
 * the officer to sign-in with a perfectly good session.
 */
export async function apiServer<T>(
  path: string,
  init: RequestInit & { params?: Params } = {},
): Promise<T> {
  const { params, headers, ...rest } = init;
  const url = buildUrl(path, params);

  const send = (token: string | null) =>
    fetch(url, {
      ...rest,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(headers as Record<string, string>),
      },
      // Portal data is per-officer and changes constantly; caching it across
      // requests would show one community's figures to another.
      cache: 'no-store',
    });

  let token = await getAccessToken();
  let res = await send(token);

  if (res.status === 401) {
    // A server render cannot write cookies, so writeSession quietly fails
    // here and the fresh token is used for this render only — the next call
    // through a route handler persists it. An unreachable API leaves `res` as
    // the original 401, which surfaces as an ApiError rather than silently
    // rendering a signed-out page.
    const refresh = await refreshSession();
    if (refresh.status === 'refreshed') {
      token = refresh.accessToken;
      res = await send(token);
    }
  }

  const json = await res.json().catch(() => null);

  if (!res.ok) {
    const message = json?.message ?? json?.error ?? `Request failed (${res.status})`;
    throw new ApiError(Array.isArray(message) ? message.join(', ') : message, res.status, json);
  }

  return (json?.data ?? json) as T;
}

/**
 * The API keeps Ajo (and some membership actions) locked until the signed-in
 * user's identity is verified, answering 403 with code KYC_VERIFICATION_REQUIRED.
 * Pages catch that case to show the verification notice instead of crashing.
 */
export function isKycRequired(error: unknown): error is ApiError {
  if (!(error instanceof ApiError) || error.status !== 403) return false;
  const body = error.body as { code?: string } | null;
  // API builds that predate the `code` field only carry the prose.
  return body?.code === 'KYC_VERIFICATION_REQUIRED' || /identity verification/i.test(error.message);
}

/** Same call, but a failure returns null instead of throwing. */
export async function apiServerSafe<T>(
  path: string,
  init?: RequestInit & { params?: Params },
): Promise<T | null> {
  try {
    return await apiServer<T>(path, init);
  } catch {
    return null;
  }
}
