import { NextRequest, NextResponse } from 'next/server';
import { API_BASE } from '@/lib/constants';
import { readUpstreamError } from '@/lib/upstream';

/** Sends another registration code to the same address. */
export async function POST(req: NextRequest) {
  const { identifier } = await req.json().catch(() => ({ identifier: null }));
  if (!identifier) {
    return NextResponse.json({ message: 'identifier is required' }, { status: 400 });
  }

  const res = await fetch(`${API_BASE}/auth/send-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier, type: 'REGISTRATION' }),
    cache: 'no-store',
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const failure = readUpstreamError(res.status, json, 'Could not send another code.');
    return NextResponse.json({ message: failure.message }, { status: res.status });
  }

  const data = json?.data ?? json;
  return NextResponse.json({ sent: true, debugOtp: data?.debugOtp ?? null });
}
