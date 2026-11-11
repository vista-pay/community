/**
 * Browser-side API client.
 *
 * Every call goes to this app's own `/api/proxy/...`, never to the Nest API
 * directly. The session rides along as an HttpOnly cookie the proxy reads, so
 * there is no token here to steal and no CORS surface to widen.
 */

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

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  params?: Params;
  body?: unknown;
}

function withParams(path: string, params?: Params) {
  if (!params) return path;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
  }
  const s = qs.toString();
  return s ? `${path}${path.includes('?') ? '&' : '?'}${s}` : path;
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { params, body, headers, ...rest } = options;
  const url = withParams(`/api/proxy${path.startsWith('/') ? path : `/${path}`}`, params);

  const res = await fetch(url, {
    ...rest,
    headers: { 'Content-Type': 'application/json', ...(headers as Record<string, string>) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const json = await res.json().catch(() => null);

  if (res.status === 401) {
    // The proxy has already tried to refresh, and it only answers 401 when the
    // API rejected the refresh token outright — an unreachable API answers 503
    // and the session is left alone.
    //
    // Gated on the code rather than the status: an endpoint that answers 401
    // for its own reasons must not take the whole session down with it. A 401
    // without the marker is reported, not acted on.
    const sessionOver = json?.code === 'SESSION_EXPIRED';

    if (
      sessionOver &&
      typeof window !== 'undefined' &&
      !window.location.pathname.startsWith('/signin')
    ) {
      // A full load, not router.push: the session is gone, and every cached
      // server component in memory was rendered for a user who is no longer
      // signed in. Throwing the document away is the point.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = `/signin?next=${encodeURIComponent(window.location.pathname)}`;
    }
    throw new ApiError(json?.message ?? 'Your session has expired.', 401, json);
  }

  if (!res.ok) {
    const message = json?.message ?? json?.error ?? `Request failed (${res.status})`;
    throw new ApiError(Array.isArray(message) ? message.join(', ') : message, res.status, json);
  }

  return (json?.data ?? json) as T;
}

export const get = <T,>(path: string, params?: Params) => api<T>(path, { params });
export const post = <T,>(
  path: string,
  body?: unknown,
  options: Omit<RequestOptions, 'body' | 'method'> = {},
) => api<T>(path, { ...options, method: 'POST', body });
export const patch = <T,>(path: string, body?: unknown) => api<T>(path, { method: 'PATCH', body });
/**
 * A DELETE may carry a body. Lifting a suspension sends which scopes to
 * restore and an optional note to the member — the method is DELETE because
 * it removes a restriction, but it is not a bare "delete this id".
 */
export const del = <T,>(path: string, body?: unknown) =>
  api<T>(path, { method: 'DELETE', body });

export async function postBlob(path: string, body: unknown): Promise<{ blob: Blob; filename: string }> {
  const res = await fetch(`/api/proxy${path.startsWith('/') ? path : `/${path}`}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const json = await res.json().catch(() => null);
    throw new ApiError(json?.message ?? json?.error ?? `Request failed (${res.status})`, res.status, json);
  }
  const disposition = res.headers.get('content-disposition') ?? '';
  const filename = disposition.match(/filename="?([^";]+)"?/i)?.[1] ?? 'loan-quote.pdf';
  return { blob: await res.blob(), filename };
}

/**
 * Fetch a document the API already holds, rather than one computed from a
 * body. The filename the server chose is kept: a signed agreement is filed
 * under its own reference, and renaming it on the way down would lose that.
 */
export async function getBlob(
  path: string,
  fallbackFilename = 'document.pdf',
): Promise<{ blob: Blob; filename: string }> {
  const res = await fetch(`/api/proxy${path.startsWith('/') ? path : `/${path}`}`);
  if (!res.ok) {
    const json = await res.json().catch(() => null);
    throw new ApiError(json?.message ?? json?.error ?? `Request failed (${res.status})`, res.status, json);
  }
  const disposition = res.headers.get('content-disposition') ?? '';
  const filename = disposition.match(/filename="?([^";]+)"?/i)?.[1] ?? fallbackFilename;
  return { blob: await res.blob(), filename };
}

/**
 * Hand a downloaded document to the browser.
 *
 * `view` opens it in a tab for a quick look; otherwise it saves. Either way
 * the object URL is revoked, because a leaked one keeps the whole file in
 * memory for the life of the tab.
 */
export function openBlob(blob: Blob, filename: string, view = false) {
  const url = URL.createObjectURL(blob);
  if (view) {
    window.open(url, '_blank', 'noopener,noreferrer');
  } else {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  }
  // Long enough for the tab to have loaded the bytes it was handed.
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Auth endpoints live on this app, not behind the proxy. */
export const authApi = {
  signIn: async (identifier: string, password: string) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, password }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new ApiError(json?.message ?? 'Sign-in failed', res.status, json);
    return json as {
      user: { id: string; email: string; firstName?: string; lastName?: string } | null;
      communities: Array<{ id: string; name: string; role: string }>;
      needsCommunity: boolean;
    };
  },
  signOut: () => fetch('/api/auth/logout', { method: 'POST' }),
  switchCommunity: async (communityId: string) => {
    const res = await fetch('/api/auth/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ communityId }),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      throw new ApiError(json?.message ?? 'Could not switch community', res.status, json);
    }
  },
};
