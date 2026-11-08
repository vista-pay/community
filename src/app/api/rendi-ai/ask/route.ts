import { NextRequest, NextResponse } from 'next/server';
import { API_BASE } from '@/lib/constants';
import { getAccessToken } from '@/lib/session';

/**
 * Rendi AI's streaming route.
 *
 * Separate from `/api/proxy` for one reason: that handler buffers the upstream
 * body (`new NextResponse(bytes)`) because it also carries binary downloads.
 * Buffering an SSE stream turns a live answer into one delivery at the end,
 * which loses the whole point of the progress events. So this handler pipes
 * the body through untouched rather than widening the shared proxy and
 * risking every other call.
 *
 * It keeps the same security posture: the bearer token comes from the HttpOnly
 * cookie and is attached here, so no token is ever present in the browser.
 */

export const runtime = 'nodejs';
/** Longer than a normal call: the tool loop can legitimately take a while. */
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const token = await getAccessToken();
  if (!token) {
    return NextResponse.json(
      { message: 'Your session has expired. Sign in again.', code: 'SESSION_EXPIRED' },
      { status: 401 },
    );
  }

  const payload = await req.json().catch(() => null);
  const communityId =
    payload && typeof payload === 'object' ? (payload as Record<string, unknown>).communityId : null;

  if (typeof communityId !== 'string' || !communityId) {
    return NextResponse.json({ message: 'No community selected.' }, { status: 400 });
  }

  // communityId travels in the path, matching every other back-office route,
  // and is never forwarded in the body the API validates.
  const body = { ...(payload as Record<string, unknown>) };
  delete body.communityId;

  let upstream: Response;
  try {
    upstream = await fetch(
      `${API_BASE}/communities/${encodeURIComponent(communityId)}/rendi-ai/ask`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
        },
        body: JSON.stringify(body),
        // Node's fetch buffers without this.
        // @ts-expect-error -- duplex is valid at runtime, absent from the DOM types
        duplex: 'half',
        signal: req.signal,
      },
    );
  } catch {
    return NextResponse.json(
      { message: 'Rendi AI could not be reached.' },
      { status: 503 },
    );
  }

  // An error before the stream starts arrives as JSON; pass it straight on so
  // the panel can show the real reason rather than a dead stream.
  if (!upstream.ok || !upstream.body) {
    const text = await upstream.text().catch(() => '');
    return new NextResponse(text || JSON.stringify({ message: 'Rendi AI is unavailable.' }), {
      status: upstream.status || 503,
      headers: { 'Content-Type': upstream.headers.get('content-type') ?? 'application/json' },
    });
  }

  return new NextResponse(upstream.body, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
