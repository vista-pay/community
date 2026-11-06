import type { Metadata } from 'next';
import { StatementsClient } from './statements-client';

export const metadata: Metadata = { title: 'Statements' };

/**
 * Client-loaded: the statement is driven entirely by its filters, so fetching
 * an unfiltered copy on the server would be thrown away on first interaction.
 */
export default function StatementsPage() {
  return <StatementsClient />;
}
