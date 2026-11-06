import { communityGet } from '@/server/portal-data';
import type { MemberRow } from '@/types';
import { OfficerForm } from './officer-form';
export default async function NewOfficerPage() { return <OfficerForm members={await communityGet<MemberRow[]>('/members', { includeOwner: true })} />; }
