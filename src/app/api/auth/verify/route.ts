import { NextRequest, NextResponse } from 'next/server';
import { API_BASE } from '@/lib/constants';
import { writeSession } from '@/lib/session';
import { readUpstreamError } from '@/lib/upstream';

/**
 * Confirms the registration code. The API activates the account, provisions
 * the wallet and issues the first token pair — which is the moment a session
 * legitimately exists, so this is where the cookies get written.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));

  const res = await fetch(`${API_BASE}/auth/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: body.identifier,
      otp: body.otp,
      type: 'REGISTRATION',
    }),
    cache: 'no-store',
  });

  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    const failure = readUpstreamError(res.status, json, 'That code did not work.');
    return NextResponse.json({ message: failure.message }, { status: res.status });
  }

  const data = json?.data ?? json;
  const tokens = data?.tokens;

  if (!tokens?.accessToken) {
    // Verifying an already-active account returns no tokens. Say so rather
    // than dropping the person into a half-signed-in state.
    return NextResponse.json({
      verified: true,
      session: false,
      message: 'This account is already active — please sign in.',
    });
  }

  await writeSession({
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresIn: tokens.expiresIn,
  });

  return NextResponse.json({ verified: true, session: true, user: data?.user ?? null });
}
