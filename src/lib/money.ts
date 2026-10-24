/**
 * Decimal-string arithmetic.
 *
 * The API speaks in decimal strings because a cooperative's balance has to be
 * exact. Adding them with `+` after `parseFloat` works right up until it does
 * not — 0.1 + 0.2 is the canonical example, and a treasurer reconciling to the
 * kobo will find it. These helpers work in integer minor units instead.
 */

const SCALE = 4;

function toUnits(value: string | number): bigint {
  const s = String(value ?? '0').trim();
  if (!s || s === '-') return 0n;

  const negative = s.startsWith('-');
  const [whole, fraction = ''] = (negative ? s.slice(1) : s).split('.');
  const padded = (fraction + '0'.repeat(SCALE)).slice(0, SCALE);
  const units = BigInt(whole || '0') * BigInt(10 ** SCALE) + BigInt(padded || '0');
  return negative ? -units : units;
}

function fromUnits(units: bigint): string {
  const negative = units < 0n;
  const abs = negative ? -units : units;
  const divisor = BigInt(10 ** SCALE);
  const whole = abs / divisor;
  const fraction = (abs % divisor).toString().padStart(SCALE, '0');
  return `${negative ? '-' : ''}${whole}.${fraction}`;
}

export const addMoney = (...values: Array<string | number>) =>
  fromUnits(values.reduce<bigint>((acc, v) => acc + toUnits(v), 0n));

export const subtractMoney = (a: string | number, b: string | number) =>
  fromUnits(toUnits(a) - toUnits(b));

export const sumMoney = (values: Array<string | number>) => addMoney(...values);

export const compareMoney = (a: string | number, b: string | number) => {
  const d = toUnits(a) - toUnits(b);
  return d === 0n ? 0 : d > 0n ? 1 : -1;
};

export const isZeroMoney = (value: string | number) => toUnits(value) === 0n;
export const isNegativeMoney = (value: string | number) => toUnits(value) < 0n;

/** Only for charts and percentages, never for a figure that is displayed as money. */
export const moneyToNumber = (value: string | number) => Number(toUnits(value)) / 10 ** SCALE;

/** Percentage of `part` within `whole`, 0 when the whole is zero. */
export function percentOf(part: string | number, whole: string | number) {
  const w = toUnits(whole);
  if (w === 0n) return 0;
  return Number((toUnits(part) * 10000n) / w) / 100;
}
