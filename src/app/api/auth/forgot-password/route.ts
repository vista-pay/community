import { NextRequest, NextResponse } from 'next/server';
import { API_BASE } from '@/lib/constants';
import { readUpstreamError } from '@/lib/upstream';

/** Requests a password-reset code. The upstream reply is deliberately generic. */
export async function POST(req: NextRequest) {
  const { identifier } = await req.json().catch(() => ({ identifier: null }));
  if (!identifier) {
    return NextResponse.json({ message: 'identifier is required' }, { status: 400 });
  }

  const res = await fetch(`${API_BASE}/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier }),
    cache: 'no-store',
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const failure = readUpstreamError(res.status, json, 'Could not send a reset code.');
    return NextResponse.json({ message: failure.message }, { status: res.status });
  }

  return NextResponse.json({ sent: true });
}
