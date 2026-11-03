import { NextRequest, NextResponse } from 'next/server';
import { API_BASE } from '@/lib/constants';
import { readUpstreamError } from '@/lib/upstream';

/**
 * Creates the Rendi account that will own the community.
 *
 * No session is written here: the API leaves a new user PENDING_VERIFICATION
 * and issues no tokens until the code is confirmed. Writing a cookie now
 * would claim a session that does not exist yet.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));

  const res = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      firstName: body.firstName,
      lastName: body.lastName,
      email: body.email,
      phone: body.phone,
      password: body.password,
      verificationChannel: body.verificationChannel ?? 'EMAIL',
    }),
    cache: 'no-store',
  });

  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    const failure = readUpstreamError(res.status, json, 'Could not create the account.');
    return NextResponse.json({ message: failure.message }, { status: res.status });
  }

  const data = json?.data ?? json;
  return NextResponse.json({
    channel: data?.verification?.channel ?? 'EMAIL',
    sentTo: data?.verification?.sentTo ?? body.email,
    // The API includes this outside production so the flow can be completed
    // without a live mail or SMS provider. It is simply absent in production.
    debugOtp: data?.verification?.debugOtp ?? null,
  });
}
