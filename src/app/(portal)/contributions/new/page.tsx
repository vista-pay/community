import type { Metadata } from 'next';
import { CreateGroupForm } from '../contributions-client';

export const metadata: Metadata = { title: 'New Ajo group' };

export default function NewAjoGroupPage() {
  return <CreateGroupForm />;
}
