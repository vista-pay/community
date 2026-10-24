import { NextRequest, NextResponse } from 'next/server';
import { API_BASE } from '@/lib/constants';
import { setActiveCommunityId, writeSession } from '@/lib/session';
import { readUpstreamError } from '@/lib/upstream';

/**
 * Signs an officer in and keeps the tokens server-side.
 *
 * The response carries no token material — only who the officer is and which
 * communities they can act for, which is what the UI actually needs.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));

  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: body.identifier, password: body.password }),
    cache: 'no-store',
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const failure = readUpstreamError(res.status, json, 'Incorrect email/phone or password.');
    return NextResponse.json({ message: failure.message }, { status: res.status });
  }

  const data = json?.data ?? json;
  // /auth/login nests the pair under `tokens`; /auth/refresh returns it flat.
  // Accept either so one endpoint changing shape cannot silently sign
  // everybody out.
  const tokens = data?.tokens ?? data;
  if (!tokens?.accessToken) {
    return NextResponse.json({ message: 'The server did not return a session.' }, { status: 502 });
  }

  await writeSession({
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresIn: tokens.expiresIn,
  });

  // Which communities this person can administer. Someone who is only a
  // member of a community has no business in the portal, and being told that
  // at sign-in is clearer than an empty dashboard.
  const communitiesRes = await fetch(`${API_BASE}/communities`, {
    headers: { Authorization: `Bearer ${tokens.accessToken}` },
    cache: 'no-store',
  });
  const communitiesJson = await communitiesRes.json().catch(() => ({}));
  const communities: Array<{ id: string; name: string; role: string; membershipStatus: string }> =
    communitiesJson?.data ?? [];

  const administrable = communities.filter(
    (c) => c.membershipStatus === 'ACTIVE' && c.role !== 'COMMUNITY_MEMBER',
  );

  if (administrable[0]) await setActiveCommunityId(administrable[0].id);

  return NextResponse.json({
    user: data.user ?? null,
    communities: administrable,
    needsCommunity: administrable.length === 0,
  });
}
