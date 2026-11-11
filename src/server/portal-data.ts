import 'server-only';
import { redirect } from 'next/navigation';
import { apiServer, apiServerSafe, isKycRequired } from '@/lib/server-api';
import { getActiveCommunityId } from '@/lib/session';
import { isOfficerRole } from '@/lib/roles';
import type { CommunitySummary, PortalSession, PortalUser } from '@/types';

/**
 * Server-side reads for the portal shell and pages.
 *
 * Pages fetch here so the first paint already has data; the matching client
 * hooks then refetch through the proxy when the officer acts. Both ends go to
 * the same API with the same session.
 */

interface RawCommunity {
  id: string;
  name: string;
  slug: string;
  role: string;
  title: string | null;
  membershipStatus: CommunitySummary['membershipStatus'];
  status: CommunitySummary['status'];
  memberCount: number;
  listingSetupRequired: boolean;
  verificationProfileRequired: boolean;
}

/**
 * The portal is for officers. A plain member holds no write permission, so
 * they would meet a wall of 403s — better to treat them as having no
 * workspace at all and say so once.
 *
 * Via the shared predicate rather than a literal: this comparison decides who
 * is let into the portal, and it had already been missed once by a role
 * rename, which silently started admitting plain members.
 */
const isOfficer = (c: RawCommunity) =>
  c.membershipStatus === 'ACTIVE' && isOfficerRole(c.role);

export async function loadSession(): Promise<PortalSession | null> {
  const [user, communities, activeId] = await Promise.all([
    apiServerSafe<Record<string, unknown>>('/auth/me'),
    apiServerSafe<RawCommunity[]>('/communities'),
    getActiveCommunityId(),
  ]);

  if (!user) return null;

  const officerOf = (communities ?? []).filter(isOfficer);
  const active = officerOf.find((c) => c.id === activeId) ?? officerOf[0] ?? null;

  const profile = (user.profile ?? {}) as { firstName?: string; lastName?: string };
  const name =
    `${profile.firstName ?? ''} ${profile.lastName ?? ''}`.trim() || (user.email as string);

  return {
    user: {
      id: user.id as string,
      email: user.email as string,
      phone: user.phone as string | undefined,
      firstName: profile.firstName ?? null,
      lastName: profile.lastName ?? null,
      name,
    } satisfies PortalUser,
    communities: officerOf,
    community: active,
  };
}

/** Community-scoped server read. Throws if the officer has no workspace. */
export async function communityGet<T>(
  suffix: string,
  params?: Record<string, string | number | boolean | undefined>,
) {
  const communityId = await requireCommunityId();
  return apiServer<T>(`/communities/${communityId}${suffix}`, { params });
}

export async function communityGetSafe<T>(
  suffix: string,
  params?: Record<string, string | number | boolean | undefined>,
) {
  const communityId = await getActiveCommunityId();
  if (!communityId) return null;
  return apiServerSafe<T>(`/communities/${communityId}${suffix}`, { params });
}

export async function requireCommunityId(): Promise<string> {
  const id = await getActiveCommunityId();
  if (id) return id;

  // Cookie missing (first sign-in on a new device, or it expired): fall back
  // to the first community the officer actually administers.
  const communities = await apiServerSafe<RawCommunity[]>('/communities');
  const first = (communities ?? []).find(isOfficer);

  // Redirect rather than throw. Throwing here crashed whichever page called
  // it and showed a stack trace where an explanation belongs.
  if (!first) redirect('/no-workspace');

  return first.id;
}

export { apiServer, apiServerSafe, isKycRequired };
