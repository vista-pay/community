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
 * nobody has to leave the page to find out which columns to put in.
 *
 * Each carries a downloadable sample. The rows are not filler — they
 * deliberately demonstrate what the parser tolerates, so an officer can see
 * that a member number may contain a slash, that a name with a comma needs
 * quoting, that a phone number can be written any of the usual ways, and that
 * both 07/11/2026 and 2026-11-07 are read as the same day. A list of column
 * names alone leaves all of that to be guessed at. */
export const UPLOAD_KINDS: Array<{
  kind: Exclude<MigrationRowKind, 'MEMBER'> | 'MEMBER';
  slug: 'members' | 'savings' | 'loans' | 'plans';
  label: string;
  columns: string;
  note: string;
  /** Header row plus illustrative rows, exactly as the file should look. */
  sample: Array<Record<string, string>>;
}> = [
  {
    kind: 'MEMBER',
    slug: 'members',
    label: 'Member list',
    columns: 'member_no, full_name, phone, email, joined_on',
    note: 'Phone or email — at least one, so they can claim their record later.',
    sample: [
      // Their own numbering, kept. A slash is fine.
      { member_no: 'A/032', full_name: 'Okafor, Ada', phone: '08012345608', email: 'ada@example.com', joined_on: '15/03/2020' },
      // No email: phone alone is enough to claim the record later.
      { member_no: 'A/033', full_name: 'Chidi Eze', phone: '0803 456 7890', email: '', joined_on: '2021-04-15' },
      // A number stored by a spreadsheet as a number, losing its leading 0.
      { member_no: 'A/034', full_name: 'Ngozi Bello', phone: '8098765432', email: 'ngozi@example.com', joined_on: '02/09/2023' },
    ],
  },
  {
    kind: 'SAVINGS',
    slug: 'savings',
    label: 'Savings balances',
    columns: 'member_no, product, balance, opened_on',
    note: 'One row per account. Create each savings product first so its terms are yours.',
    sample: [
      // One member, two products: two rows, not two columns.
      { member_no: 'A/032', product: 'Christmas Savings', balance: '250,000.00', opened_on: '10/01/2021' },
      { member_no: 'A/032', product: 'Member contributions', balance: '480,000', opened_on: '15/03/2020' },
      { member_no: 'A/033', product: 'Christmas Savings', balance: '95,500.50', opened_on: '2022-02-01' },
    ],
  },
  {
    kind: 'LOAN',
    slug: 'loans',
    label: 'Outstanding loans',
    columns: 'member_no, product, principal, outstanding, disbursed_on, due_on',
    note: 'Outstanding is what is still owed — it reduces the cash you need to transfer.',
    sample: [
      // Part repaid: 100,000 lent, 40,000 still owed.
      { member_no: 'A/032', product: 'Emergency Loan', principal: '100,000', outstanding: '40,000', disbursed_on: '01/06/2026', due_on: '01/12/2026' },
      // Nothing repaid yet — outstanding may equal the principal.
      { member_no: 'A/034', product: 'Emergency Loan', principal: '50,000', outstanding: '50,000', disbursed_on: '2026-09-20', due_on: '2027-03-20' },
    ],
  },
  {
    kind: 'PLAN',
    slug: 'plans',
    label: 'Contribution plans',
    columns: 'member_no, amount, frequency',
    note: 'Imported switched off. Each member turns on auto-debit themselves, in the app.',
    sample: [
      { member_no: 'A/032', amount: '5,000', frequency: 'MONTHLY' },
      { member_no: 'A/033', amount: '2,500', frequency: 'WEEKLY' },
    ],
  },
];

/** How far through the sequence a step sits, for the stepper's state. */
export function stepIndex(step: MigrationStep): number {
  if (step === 'COMPLETE') return MIGRATION_STEPS.length;
  const at = MIGRATION_STEPS.findIndex((s) => s.step === step);
  return at === -1 ? 0 : at;
}

/**
 * The order fields should read in, per file type.
 *
 * Derived from the same `columns` string the upload card shows, so an edit
 * form never contradicts the instructions that produced the file. Without it
 * fields render in whatever order the keys happen to sit in the object —
 * which is how "Due on" ends up above "Member no".
 */
export function fieldOrder(slug: string): string[] {
  const kind = UPLOAD_KINDS.find((k) => k.slug === slug);
  if (!kind) return [];
  return kind.columns.split(',').map((name) => name.trim().replace(/[\s_-]/g, ''));
}

/** Which product list a file type draws on, if any. */
export function productKindFor(slug: string): 'savings' | 'loans' | null {
  if (slug === 'savings') return 'savings';
  if (slug === 'loans') return 'loans';
  return null;
}
