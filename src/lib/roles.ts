/**
 * Role-name predicates, in one place.
 *
 * These used to be inline string comparisons against `COMMUNITY_MEMBER` and
 * `COMMUNITY_OWNER`, scattered across the staff screen, the member directory,
 * the session loader and the sign-in route. When roles moved into
 * `community_roles` — scoped per community, and without the `COMMUNITY_`
 * prefix that only existed to keep them apart from business roles in the old
 * shared table — every one of those comparisons quietly stopped matching.
 *
 * Nothing threw. The staff screen simply listed every member as an officer,
 * and `isOfficer` started letting plain members into a portal built for
 * officers. A missed rename should not be able to widen who gets in, so the
 * check lives here once.
 *
 * Both spellings are accepted because a session payload minted before the
 * rename can still be in a cookie.
 */

const PLAIN_MEMBER = new Set(['MEMBER', 'COMMUNITY_MEMBER']);
const FOUNDER = new Set(['REGISTRAR', 'COMMUNITY_OWNER']);

/** An ordinary member: no officer rights, and not shown on the staff screen. */
export const isPlainMember = (roleName: string | null | undefined): boolean =>
  !roleName || PLAIN_MEMBER.has(roleName);

/**
 * The account the community was registered with. Holds every permission, and
 * cannot be removed — so the staff screen shows a marker, not a button.
 */
export const isFounderRole = (roleName: string | null | undefined): boolean =>
  Boolean(roleName) && FOUNDER.has(roleName as string);

/** Holds a post, as opposed to being an ordinary member. */
export const isOfficerRole = (roleName: string | null | undefined): boolean =>
  !isPlainMember(roleName);
