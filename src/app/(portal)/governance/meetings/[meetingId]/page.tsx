import { notFound } from 'next/navigation';
import { communityGet } from '@/server/portal-data';
import type { Meeting } from '@/types';
import { MeetingEditor } from '../meeting-editor';
export default async function MeetingPage({ params }: { params: Promise<{ meetingId: string }> }) { const { meetingId } = await params; const meetings = await communityGet<Meeting[]>('/governance/meetings'); const meeting = meetings.find((item) => item.id === meetingId); if (!meeting) notFound(); return <MeetingEditor meeting={meeting} />; }
