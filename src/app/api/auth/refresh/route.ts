import { NextResponse } from 'next/server';
import { refreshSession } from '@/lib/session';

/**
 * Explicit refresh, for a client that wants to extend the session before
 * acting rather than discover it mid-request.
 *
 * Mirrors the proxy's three outcomes: 200 refreshed, 401 genuinely rejected,
 * 503 the API could not be asked. Collapsing the last two into 401 is what
 * made a transient outage look like a dead session.
 */
export async function POST() {
  const refresh = await refreshSession();

  if (refresh.status === 'refreshed') {
    return NextResponse.json({ authenticated: true }, { status: 200 });
  }
  if (refresh.status === 'rejected') {
    return NextResponse.json(
      { authenticated: false, code: 'SESSION_EXPIRED', message: refresh.reason },
      { status: 401 },
    );
  }
  return NextResponse.json(
    { authenticated: true, code: 'API_UNAVAILABLE', message: refresh.reason },
    { status: 503 },
  );
}
