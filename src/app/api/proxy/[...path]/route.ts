import { NextRequest, NextResponse } from 'next/server';
import { API_BASE } from '@/lib/constants';
import { clearSession, getAccessToken, refreshSession } from '@/lib/session';

/**
 * The portal's only route to the API.
 *
 * Client components call `/api/proxy/<nest path>`; this handler attaches the
 * bearer token from the HttpOnly cookie, so no token is ever present in the
 * browser's JavaScript. A 401 is retried once behind a refresh before the
 * session is given up on.
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
    return fetch(target, { method: req.method, headers: h, body, cache: 'no-store' });
  };

  let res = await send(await getAccessToken());

  if (res.status === 401) {
    const refreshed = await refreshSession();
    if (refreshed) {
      res = await send(refreshed);
    } else {
      await clearSession();
      return NextResponse.json(
        { message: 'Your session has expired. Please sign in again.' },
        { status: 401 },
      );
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
