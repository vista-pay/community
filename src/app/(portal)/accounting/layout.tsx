import type { ReactNode } from 'react';

/**
 * Accounting reads a size larger than the rest of the portal.
 *
 * A treasurer here is checking figures against a bank statement line by
 * line, not scanning a list for a name to click — and the smallest type in
 * the app was carrying the numbers that matter most. The class does the
 * work; see `.accounting-type` in globals.css.
 */
export default function AccountingLayout({ children }: { children: ReactNode }) {
  return <div className="accounting-type">{children}</div>;
}
