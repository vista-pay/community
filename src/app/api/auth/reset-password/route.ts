import { NextRequest, NextResponse } from 'next/server';
import { API_BASE } from '@/lib/constants';
import { readUpstreamError } from '@/lib/upstream';

/** Completes a password reset: identifier + emailed OTP + new password. */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  if (!body.identifier || !body.otp || !body.newPassword) {
    return NextResponse.json({ message: 'identifier, otp and newPassword are required' }, { status: 400 });
  }

  const res = await fetch(`${API_BASE}/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: body.identifier,
      otp: body.otp,
      newPassword: body.newPassword,
    }),
    cache: 'no-store',
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const failure = readUpstreamError(res.status, json, 'Password reset failed.');
    return NextResponse.json({ message: failure.message }, { status: res.status });
  }

  return NextResponse.json({ reset: true });
}
