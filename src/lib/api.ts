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
    // The proxy has already tried to refresh. A 401 here means the session is
    // genuinely over, so send the officer to sign in rather than leaving a
    // page of permanent spinners.
    if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/signin')) {
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
export const post = <T,>(path: string, body?: unknown) => api<T>(path, { method: 'POST', body });
export const patch = <T,>(path: string, body?: unknown) => api<T>(path, { method: 'PATCH', body });
export const del = <T,>(path: string) => api<T>(path, { method: 'DELETE' });

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
