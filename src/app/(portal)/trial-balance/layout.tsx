import type { ReactNode } from 'react';

/**
 * The trial balance sits in the Accounting group in the sidebar even though
 * its route is top-level, so it gets the same larger type. Without this it
 * would be the one accounting page that still reads small.
 */
export default function TrialBalanceLayout({ children }: { children: ReactNode }) {
  return <div className="accounting-type">{children}</div>;
}
