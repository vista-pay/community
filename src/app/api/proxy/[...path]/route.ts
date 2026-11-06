import { NextRequest, NextResponse } from 'next/server';
import { API_BASE } from '@/lib/constants';
import { clearSession, getAccessToken, refreshSession } from '@/lib/session';

/**
 * The portal's only route to the API.
 *
 * Client components call `/api/proxy/<nest path>`; this handler attaches the
 * bearer token from the HttpOnly cookie, so no token is ever present in the
 * browser's JavaScript.
 *
 * A 401 is retried once behind a refresh. The session is only given up on
 * when the API rejects the refresh token outright — an API that is merely
 * unreachable answers 503 and the session survives, because signing an
 * officer out mid-task over a restart is far worse than asking them to retry.
 *
 * Methods are forwarded as-is, which keeps the client a thin fetch wrapper
 * rather than a second copy of the API surface.
 */

const HOP_BY_HOP = new Set([
  'host',
  'connection',
  'content-length',
  'transfer-encoding',
  'cookie',
]);

async function forward(req: NextRequest, path: string[]) {
  const target = `${API_BASE}/${path.join('/')}${req.nextUrl.search}`;

  const headers = new Headers();
  req.headers.forEach((value, key) => {
    if (!HOP_BY_HOP.has(key.toLowerCase())) headers.set(key, value);
  });
  headers.set('Content-Type', req.headers.get('content-type') ?? 'application/json');

  const body =
    req.method === 'GET' || req.method === 'HEAD' ? undefined : await req.text();

  const send = (token: string | null) => {
    const h = new Headers(headers);
    if (token) h.set('Authorization', `Bearer ${token}`);
    else h.delete('Authorization');
    return fetch(target, {
      method: req.method,
      headers: h,
      body,
      cache: 'no-store',
      // A hung API must not hold the officer's request open indefinitely.
      signal: AbortSignal.timeout(30_000),
    });
  };

  /** 503 rather than a thrown 500: unreachable is a known state, not a crash. */
  const unavailable = (reason: string) =>
    NextResponse.json(
      {
        message: 'Rendi could not be reached just now. Your session is still active — try again.',
        code: 'API_UNAVAILABLE',
        reason,
      },
      { status: 503 },
    );

  let res: Response;
  try {
    res = await send(await getAccessToken());
  } catch (error) {
    // The API is down, restarting or unreachable. Previously this threw out
    // of the handler and surfaced as an opaque 500.
    return unavailable(error instanceof Error ? error.message : 'Request failed');
  }

  if (res.status === 401) {
    const refresh = await refreshSession();

    if (refresh.status === 'refreshed') {
      try {
        res = await send(refresh.accessToken);
      } catch (error) {
        return unavailable(error instanceof Error ? error.message : 'Retry failed');
      }
    } else if (refresh.status === 'rejected') {
      // The API has actually rejected the refresh token. This is the only
      // case that ends the session.
      await clearSession();
      return NextResponse.json(
        { message: 'Your session has expired. Please sign in again.', code: 'SESSION_EXPIRED' },
        { status: 401 },
      );
    } else {
      // The API could not be asked — it is restarting, erroring or
      // unreachable. The session is untouched: signing the officer out here
      // is what turned every API hiccup into a surprise logout mid-task.
      return unavailable(refresh.reason);
    }
  }

  const text = await res.text();
  return new NextResponse(text, {
    status: res.status,
    headers: { 'Content-Type': res.headers.get('content-type') ?? 'application/json' },
  });
}

type Ctx = { params: Promise<{ path: string[] }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  return forward(req, (await ctx.params).path);
}
export async function POST(req: NextRequest, ctx: Ctx) {
  return forward(req, (await ctx.params).path);
}
export async function PATCH(req: NextRequest, ctx: Ctx) {
  return forward(req, (await ctx.params).path);
}
export async function PUT(req: NextRequest, ctx: Ctx) {
  return forward(req, (await ctx.params).path);
}
export async function DELETE(req: NextRequest, ctx: Ctx) {
  return forward(req, (await ctx.params).path);
}
