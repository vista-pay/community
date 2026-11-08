const LEGACY_PERSONAL_SAVINGS_NAME = 'Member contributions';

/**
 * The backend keeps the original product name as a stable system identifier.
 * Present it in member-facing and back-office UI using language that describes
 * what the balance actually is: savings owned by one member.
 */
export function savingsProductName(name: string) {
  return name === LEGACY_PERSONAL_SAVINGS_NAME ? 'Individual savings' : name;
}
