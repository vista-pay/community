import { Landmark, PiggyBank, Receipt, Scale, TrendingUp } from 'lucide-react';
import type { BookAccountType } from '@/types';

/**
 * The five account classes, in the order a balance sheet reads them.
 *
 * `normal` is which side increases the account — shown because a negative
 * balance only means something once you know which way the account is
 * supposed to lean. `range` is the band its code belongs in, which is the
 * convention every cooperative's auditor expects and the thing an officer is
 * most likely to get wrong unaided.
 */
export const ACCOUNT_CLASSES = [
  {
    type: 'ASSET' as BookAccountType,
    label: 'Asset',
    plural: 'Assets',
    normal: 'Debit' as const,
    icon: Landmark,
    blurb: 'What the community owns or is owed.',
    examples: 'Cash, bank accounts, loans out to members, equipment',
    range: [1000, 1999] as const,
  },
  {
    type: 'LIABILITY' as BookAccountType,
    label: 'Liability',
    plural: 'Liabilities',
    normal: 'Credit' as const,
    icon: Scale,
    blurb: 'What it owes members and others.',
    examples: 'Member savings, welfare fund, unpaid bills',
    range: [2000, 2999] as const,
  },
  {
    type: 'EQUITY' as BookAccountType,
    label: 'Equity',
    plural: 'Equity',
    normal: 'Credit' as const,
    icon: PiggyBank,
    blurb: "Members' capital and accumulated reserves.",
    examples: 'Share capital, statutory reserve, accumulated surplus',
    range: [3000, 3999] as const,
  },
  {
    type: 'INCOME' as BookAccountType,
    label: 'Income',
    plural: 'Income',
    normal: 'Credit' as const,
    icon: TrendingUp,
    blurb: 'Money coming in that the community keeps.',
    examples: 'Dues, levies, loan interest, late charges',
    range: [4000, 4999] as const,
  },
  {
    type: 'EXPENSE' as BookAccountType,
    label: 'Expense',
    plural: 'Expenses',
    normal: 'Debit' as const,
    icon: Receipt,
    blurb: 'What it costs to run the community.',
    examples: 'Meetings, stationery, bank charges, generator fuel',
    range: [5000, 5999] as const,
  },
];

export type AccountClass = (typeof ACCOUNT_CLASSES)[number];

export const classOf = (type: BookAccountType): AccountClass =>
  ACCOUNT_CLASSES.find((c) => c.type === type) ?? ACCOUNT_CLASSES[4];

/**
 * The next free code in a class's band.
 *
 * Suggested rather than demanded. Picking a number is the step where an
 * officer with no bookkeeping background stalls, and the convention — assets
 * in 1xxx, expenses in 5xxx — is not something they should have to know to
 * add a line for generator fuel.
 *
 * Steps by 10 so there is room to slot related accounts in later, which is
 * how a hand-kept chart is normally numbered.
 */
export function suggestCode(type: BookAccountType, taken: readonly string[]): string {
  const [start, end] = classOf(type).range;
  const used = new Set(taken);

  for (let code = start; code <= end; code += 10) {
    if (!used.has(String(code))) return String(code);
  }
  // The decades are full; fall back to any gap at all before giving up.
  for (let code = start; code <= end; code += 1) {
    if (!used.has(String(code))) return String(code);
  }
  return '';
}

/** Whether a code sits in the band its class expects. */
export function codeFitsClass(code: string, type: BookAccountType): boolean {
  const value = Number(code);
  if (!Number.isFinite(value)) return false;
  const [start, end] = classOf(type).range;
  // Longer codes are a community's own sub-numbering (e.g. 50901); judge
  // them on the band their leading digits fall in.
  const leading = Number(String(code).slice(0, 4).padEnd(4, '0'));
  return leading >= start && leading <= end;
}

/**
 * What a debit or a credit actually *means* on an account of this class.
 *
 * Debit and credit are the terms an auditor needs and the ones the books are
 * kept in, so they stay. But they read backwards to anyone who learned them
 * from a bank statement — a bank says "credit" when you pay in, because on
 * the bank's own books your deposit is a liability they owe you. These are
 * the plain words for the same movement, from the community's side of it.
 *
 * Not simply "the normal side means more". It does for an asset, a
 * liability, income and equity — but a debit to an expense account is money
 * leaving, even though it increases the account.
 */
const EFFECTS: Record<BookAccountType, { debit: string; credit: string }> = {
  ASSET: { debit: 'Money in', credit: 'Money out' },
  LIABILITY: { debit: 'Settled', credit: 'Money in' },
  EQUITY: { debit: 'Withdrawn', credit: 'Contributed' },
  INCOME: { debit: 'Reversed', credit: 'Earned' },
  EXPENSE: { debit: 'Spent', credit: 'Refunded' },
};

export const effectOf = (type: BookAccountType, side: 'debit' | 'credit'): string =>
  EFFECTS[type]?.[side] ?? (side === 'debit' ? 'Debit' : 'Credit');

/**
 * One line saying which column is which, written out per class.
 *
 * Built by hand rather than from the labels above, because "a debit is
 * settled" is not a sentence. The bank-statement line is on the asset case
 * deliberately: that is the account people read first and the one where the
 * convention feels wrong, since a bank says "credit" when you pay in —
 * their books, not yours.
 */
const SENTENCES: Record<BookAccountType, string> = {
  ASSET:
    'A debit is money coming in, a credit is money going out. Your bank statement says the opposite because it is written from the bank’s side.',
  LIABILITY:
    'A credit is money coming in and what you owe going up; a debit is paying some of it back.',
  EQUITY:
    'A credit is capital contributed or surplus retained; a debit is capital taken back out.',
  INCOME: 'A credit is income earned. A debit only appears when something is reversed.',
  EXPENSE: 'A debit is money spent. A credit only appears when something is refunded.',
};

export const sidesSentence = (type: BookAccountType): string => SENTENCES[type] ?? '';
