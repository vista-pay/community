/**
 * The Nest API origin. Deliberately NOT a NEXT_PUBLIC_ variable: the browser
 * never talks to the API directly, it goes through this app's own route
 * handlers, which attach the session from an HttpOnly cookie.
 */
export const API_BASE = process.env.API_BASE ?? 'http://localhost:9100/api/v1';

/**
 * Confirms the configured API_BASE really is the Rendi API.
 *
 * Worth the one request at boot: when something else owns that port — an S3
 * mock, another service — every call fails with a generic error that reads
 * like the user's fault, and nothing points at the configuration.
 */
export async function checkApiBase(): Promise<{ ok: boolean; detail: string }> {
  try {
    const res = await fetch(`${API_BASE}/community-services/catalog`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(4000),
      cache: 'no-store',
    });

    const body = await res.json().catch(() => null);

    // Unauthenticated, this endpoint answers 401 in the Rendi envelope. Any
    // other shape means something else is listening.
    if (body && typeof body === 'object' && 'statusCode' in body) {
      return { ok: true, detail: `Rendi API reachable at ${API_BASE}` };
    }

    return {
      ok: false,
      detail:
        `${API_BASE} answered HTTP ${res.status} but not in the Rendi format. ` +
        `Something else is listening on that port.`,
    };
  } catch (error) {
    return {
      ok: false,
      detail: `${API_BASE} is unreachable: ${error instanceof Error ? error.message : 'unknown error'}`,
    };
  }
}

export const APP_NAME = 'Rendi Community Portal';

/**
 * Where a join link points. The mobile app deep-links `/j/<code>`, so this
 * has to match whatever domain actually routes to the app — hence an env var
 * rather than a constant baked into three codebases.
 */
export const JOIN_LINK_BASE =
  process.env.NEXT_PUBLIC_JOIN_LINK_BASE ?? 'https://rendi.ng/j';

/** Cookie names. Only the flag is readable by script. */
export const ACCESS_COOKIE = 'vcp_at';
export const REFRESH_COOKIE = 'vcp_rt';
export const SESSION_FLAG_COOKIE = 'vcp_session';
/** Which community the officer is currently working in. */
export const COMMUNITY_COOKIE = 'vcp_community';

