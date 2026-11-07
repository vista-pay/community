import type { MigrationRowKind, MigrationStep } from '@/types';

/**
 * The four steps of a migration, in the order a community does them.
 *
 * Declared once because the page, the stepper and the resume logic all need
 * the same sequence — three copies of an ordering is three chances for the
 * screen to disagree with itself about where you are.
 */
export const MIGRATION_STEPS: Array<{
  step: MigrationStep;
  title: string;
  blurb: string;
}> = [
  {
    step: 'ROSTER',
    title: 'Your member list',
    blurb: 'Who belongs to the community, with their existing member numbers kept.',
  },
  {
    step: 'BALANCES',
    title: 'Balances and loans',
    blurb: 'What each member has saved and what they still owe.',
  },
  {
    step: 'FUNDING',
    title: 'Move the money',
    blurb: 'Transfer the cash you hold into Rendi, in as many parts as you like.',
  },
  {
    step: 'CLAIMING',
    title: 'Members arrive',
    blurb: 'Each member downloads the app and their record is already correct.',
  },
];

/** The upload kinds, and what each file needs. Shown next to the drop zone so
 * nobody has to leave the page to find out which columns to put in. */
export const UPLOAD_KINDS: Array<{
  kind: Exclude<MigrationRowKind, 'MEMBER'> | 'MEMBER';
  slug: 'members' | 'savings' | 'loans' | 'plans';
  label: string;
  columns: string;
  note: string;
}> = [
  {
    kind: 'MEMBER',
    slug: 'members',
    label: 'Member list',
    columns: 'member_no, full_name, phone, email, joined_on',
    note: 'Phone or email — at least one, so they can claim their record later.',
  },
  {
    kind: 'SAVINGS',
    slug: 'savings',
    label: 'Savings balances',
    columns: 'member_no, product, balance, opened_on',
    note: 'One row per account. Create each savings product first so its terms are yours.',
  },
  {
    kind: 'LOAN',
    slug: 'loans',
    label: 'Outstanding loans',
    columns: 'member_no, product, principal, outstanding, disbursed_on, due_on',
    note: 'Outstanding is what is still owed — it reduces the cash you need to transfer.',
  },
  {
    kind: 'PLAN',
    slug: 'plans',
    label: 'Contribution plans',
    columns: 'member_no, amount, frequency',
    note: 'Imported switched off. Each member turns on auto-debit themselves, in the app.',
  },
];

/** How far through the sequence a step sits, for the stepper's state. */
export function stepIndex(step: MigrationStep): number {
  if (step === 'COMPLETE') return MIGRATION_STEPS.length;
  const at = MIGRATION_STEPS.findIndex((s) => s.step === step);
  return at === -1 ? 0 : at;
}
