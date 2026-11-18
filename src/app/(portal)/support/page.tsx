import type { Metadata } from 'next';
import { SupportClient } from './support-client';

export const metadata: Metadata = { title: 'Support' };

/**
 * Support is open to every community on every plan, so there is nothing to
 * gate and nothing to read on the server before the page can render — the
 * ticket list is fetched client-side, where opening one can mark it read.
 */
export default function SupportPage() {
  return <SupportClient />;
}
