import { NextRequest, NextResponse } from 'next/server';
import { apiServerSafe } from '@/lib/server-api';
import { getActiveCommunityId, setActiveCommunityId } from '@/lib/session';

/** Who am I, and which community am I working in. */
export async function GET() {
  const [user, communities, communityId] = await Promise.all([
    apiServerSafe<unknown>('/auth/me'),
    apiServerSafe<unknown[]>('/communities'),
    getActiveCommunityId(),
  ]);

  if (!user) return NextResponse.json({ authenticated: false }, { status: 401 });
  return NextResponse.json({ authenticated: true, user, communities, communityId });
}

/** Switch the community the officer is working in. */
export async function POST(req: NextRequest) {
  const { communityId } = await req.json().catch(() => ({ communityId: null }));
  if (!communityId) {
    return NextResponse.json({ message: 'communityId is required' }, { status: 400 });
  }

  // Only a community the caller actually belongs to — otherwise the cookie
  // becomes a way to point the portal at someone else's books and lean on
  // the API to say no on every single call.
  const communities = await apiServerSafe<Array<{ id: string }>>('/communities');
  if (!communities?.some((c) => c.id === communityId)) {
    return NextResponse.json({ message: 'You do not belong to that community' }, { status: 403 });
  }

  await setActiveCommunityId(communityId);
  return NextResponse.json({ communityId });
}
