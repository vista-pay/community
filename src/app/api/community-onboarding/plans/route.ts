import { NextResponse } from 'next/server';
import { API_BASE } from '@/lib/constants';

/**
 * The published plan list for the registration form's plan chooser.
 *
 * Proxied like the register call because the chooser renders before any
 * session exists — the upstream endpoint is public and read-only.
 */
export async function GET() {
  const res = await fetch(`${API_BASE}/community-onboarding/plans`, { cache: 'no-store' });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    return NextResponse.json({ message: 'Could not load plans' }, { status: res.status });
  }
  return NextResponse.json(json?.data ?? json);
}
