import { UserPlus, Users, UserRoundCheck } from 'lucide-react';
import type { Route } from 'next';

/**
 * The member sections, read by both the sidebar and the hub so a new one
 * cannot appear in the nav and be quietly missing from the landing page.
 */
export const MEMBER_SECTIONS: Array<{
  href: Route;
  label: string;
  description: string;
  icon: typeof Users;
  /** Which dashboard count belongs on this card, if any. */
  countKey?: 'members' | 'joinRequests';
}> = [
  {
    href: '/members/add' as Route,
    label: 'Add members',
    description: 'Invite new members or import existing members individually or by CSV.',
    icon: UserPlus,
  },
  {
    href: '/members/requests' as Route,
    label: 'Pending members',
    description: 'People who applied, and invitations not yet answered.',
    icon: UserRoundCheck,
    countKey: 'joinRequests',
  },
  {
    href: '/members/all' as Route,
    label: 'Existing members',
    description: 'Everyone active, with their member code and standing.',
    icon: Users,
    countKey: 'members',
  },
];
