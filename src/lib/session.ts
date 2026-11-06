import 'server-only';
import { cookies } from 'next/headers';
import {
  ACCESS_COOKIE,
  API_BASE,
  COMMUNITY_COOKIE,
  REFRESH_COOKIE,
  SESSION_FLAG_COOKIE,
} from './constants';

/**
 * Session handling for the portal.
 *
 * The Nest API issues bearer tokens in the response body. Keeping those in
 * localStorage would mean any XSS in the portal is a full account takeover,
 * and a community officer's token can move the cooperative's money. So the
 * tokens never reach the browser at all: this app stores them in HttpOnly
 * cookies and proxies every call. The only script-readable cookie is a flag
 * saying a session exists, which the middleware and UI use for routing.
 */

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn?: number;
}

const secure = process.env.NODE_ENV === 'production';

/**
 * Persists a token pair.
 *
 * Returns false when it could not: Next forbids writing cookies during a
 * Server Component render, and a page refreshing an expired token is exactly
 * that case. Treating the failure as fatal is what turned an expired access
 * token into "your session is dead" — and then into a redirect loop, because
 * the script-readable flag cookie still said otherwise.
 *
 * The caller uses the returned token for the current render regardless; the
 * next call through a route handler persists it properly.
 */
export async function writeSession(tokens: TokenPair): Promise<boolean> {
  const base = { httpOnly: true, secure, sameSite: 'lax' as const, path: '/' };

  try {
    const jar = await cookies();
    jar.set(ACCESS_COOKIE, tokens.accessToken, {
      ...base,
      // Match the token's own lifetime so a dead token is not kept around
      // making the UI look signed in.
      maxAge: tokens.expiresIn ?? 15 * 60,
    });
    jar.set(REFRESH_COOKIE, tokens.refreshToken, { ...base, maxAge: 7 * 24 * 60 * 60 });
    jar.set(SESSION_FLAG_COOKIE, '1', {
      httpOnly: false,
      secure,
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60,
    });
    return true;
  } catch {
    return false;
  }
}

export async function clearSession(): Promise<boolean> {
  try {
    const jar = await cookies();
    for (const name of [ACCESS_COOKIE, REFRESH_COOKIE, SESSION_FLAG_COOKIE, COMMUNITY_COOKIE]) {
      jar.set(name, '', { path: '/', maxAge: 0 });
    }
    return true;
  } catch {
    // Same render-context restriction. The caller redirects through a route
    // handler, which can clear them for real.
    return false;
  }
}

export async function getAccessToken() {
  return (await cookies()).get(ACCESS_COOKIE)?.value ?? null;
}

export async function getRefreshToken() {
  return (await cookies()).get(REFRESH_COOKIE)?.value ?? null;
}

export async function getActiveCommunityId() {
  return (await cookies()).get(COMMUNITY_COOKIE)?.value ?? null;
}

export async function setActiveCommunityId(communityId: string) {
  (await cookies()).set(COMMUNITY_COOKIE, communityId, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: 30 * 24 * 60 * 60,
  });
}

/**
 * The outcome of trying to refresh.
 *
 * Three states, not two. A single null conflated "your refresh token is
 * invalid" with "I could not reach the API", and the caller could only treat
 * both as a dead session — so a momentary API hiccup signed the officer out
 * of a session that was perfectly valid. Only `rejected` means sign out.
 */
export type RefreshResult =
  | { status: 'refreshed'; accessToken: string }
  /** The API answered, and the refresh token is genuinely no longer good. */
  | { status: 'rejected'; reason: string }
  /** The API could not be asked, or failed. The session is still fine. */
  | { status: 'unavailable'; reason: string };

/**
 * Exchanges the refresh token for a new pair.
 *
 * Distinguishing a rejection from an outage is the whole point of the return
 * type: an officer halfway through approving a payout should see "try again",
 * not be thrown back to the sign-in page because the API restarted.
 */
export async function refreshSession(): Promise<RefreshResult> {
  const refreshToken = await getRefreshToken();
  // No refresh token at all is a genuine dead end — there is nothing to
  // exchange, and retrying cannot produce one.
  if (!refreshToken) return { status: 'rejected', reason: 'No refresh token' };

  let res: Response;
  try {
    res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
      cache: 'no-store',
      // A refresh that hangs must not hang the page behind it. Without this
      // the request waits on the platform default, which is effectively
      // forever for a server that accepted the connection and went quiet.
      signal: AbortSignal.timeout(10_000),
    });
  } catch (error) {
    // Connection refused, DNS failure, timeout — the API is unreachable, and
    // the session says nothing about that. Previously this threw out of the
    // route handler and became a 500.
    return {
      status: 'unavailable',
      reason: error instanceof Error ? error.message : 'Could not reach the API',
    };
  }

  // Only the API's own "no" ends a session. 401/403 is the refresh token
  // being rejected; anything else (500, 502, 429, a gateway page) is the API
  // having a bad moment, and the officer keeps their session.
  if (res.status === 401 || res.status === 403) {
    return { status: 'rejected', reason: `Refresh rejected (${res.status})` };
  }
  if (!res.ok) {
    return { status: 'unavailable', reason: `Refresh failed (${res.status})` };
  }

  const json = await res.json().catch(() => null);
  const data = json?.data ?? json;
  // Same reason as the login route: refresh returns the pair flat, login
  // nests it under `tokens`.
  const tokens = data?.tokens ?? data;
  if (!tokens?.accessToken) {
    // A 200 with no token is the API misbehaving, not the officer's session
    // ending. Retrying is the right move.
    return { status: 'unavailable', reason: 'Refresh returned no access token' };
  }

  await writeSession({
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken ?? refreshToken,
    expiresIn: tokens.expiresIn,
  });
  return { status: 'refreshed', accessToken: tokens.accessToken as string };
}
