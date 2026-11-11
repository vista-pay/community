import { NextRequest, NextResponse } from 'next/server';
import { API_BASE } from '@/lib/constants';
import { readUpstreamError } from '@/lib/upstream';

/**
 * Registers the community and the account that owns it, in one call.
 *
 * No session is written here: the API leaves the owner PENDING_VERIFICATION
 * and issues no tokens until the code sent to the community's official email
 * is confirmed. Writing a cookie now would claim a session that does not
 * exist yet — `/api/auth/verify` is where one legitimately starts.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));

  const res = await fetch(`${API_BASE}/community-onboarding/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: body.name,
      email: body.email,
      phone: body.phone,
      password: body.password,
      country: body.country,
      registrarName: body.registrarName,
      registrarEmail: body.registrarEmail,
      registrarPhone: body.registrarPhone,
    }),
    cache: 'no-store',
  });

  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    const failure = readUpstreamError(res.status, json, 'Could not register this community.');
    return NextResponse.json({ message: failure.message }, { status: res.status });
  }

  const data = json?.data ?? json;
  return NextResponse.json({
    community: data?.community ?? null,
    sentTo: data?.verification?.sentTo ?? body.email,
    // The API includes this outside production so the flow can be completed
    // without a live mail provider. It is simply absent in production.
    debugOtp: data?.verification?.debugOtp ?? null,
  });
}
