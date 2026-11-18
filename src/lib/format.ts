export const cn = (...c: Array<string | false | null | undefined | 0>) => c.filter(Boolean).join(' ');

const SYMBOLS: Record<string, string> = { NGN: '₦', GHS: 'GH₵', KES: 'KSh ', USD: '$', GBP: '£', EUR: '€' };

/**
 * Formats a decimal string (or a number, for chart labels) as money.
 *
 * Takes the string straight from the API rather than a parsed number, so a
 * value never loses precision on its way to the screen.
 */
export function money(
  value: string | number,
  currency = 'NGN',
  opts: { compact?: boolean; decimals?: boolean } = {},
) {
  const symbol = SYMBOLS[currency] ?? `${currency} `;
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return `${symbol}0`;

  if (opts.compact && Math.abs(n) >= 1000) {
    const units: Array<[number, string]> = [
      [1e9, 'B'],
      [1e6, 'M'],
      [1e3, 'K'],
    ];
    for (const [v, s] of units) {
      if (Math.abs(n) >= v) {
        return `${symbol}${(n / v).toFixed(Math.abs(n / v) >= 100 ? 0 : 1).replace(/\.0$/, '')}${s}`;
      }
    }
  }

  const decimals = opts.decimals ?? true;
  return (
    symbol +
    n.toLocaleString('en-NG', {
      minimumFractionDigits: decimals ? 2 : 0,
      maximumFractionDigits: decimals ? 2 : 0,
    })
  );
}

export const num = (n: number) => n.toLocaleString('en-NG');

/**
 * The civil calendar this platform keeps.
 *
 * These pages are rendered on the server and hydrated in the browser, so an
 * unpinned formatter runs twice in two different zones: UTC in the container,
 * the viewer's own on the client. A timestamp late in the UTC day then prints
 * one date on first paint and another after hydration — and any "days left"
 * derived from it inherits the same disagreement. Rendi's communities keep
 * Nigerian time, so that is the calendar a day is counted on.
 */
const ZONE = 'Africa/Lagos';

/** `YYYY-MM-DD` for a moment, as that calendar sees it. */
const civilDay = (d: Date) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);

/**
 * A date, or an em dash when there isn't one.
 *
 * Null and undefined are accepted deliberately, even where a type says they
 * cannot happen. A field the API stopped sending — or never sent — used to
 * reach `undefined.getTime()` here and throw, and a throw inside a formatter
 * does not degrade one cell: it unmounts the route. That is how the
 * settlement tab 500'd on a payload whose accounts carried no `createdAt`.
 * Nothing is worth less than a timestamp, and nothing costs more than the
 * screen an officer opens to fix a money problem.
 */
export function date(
  d: string | Date | null | undefined,
  style: 'short' | 'long' | 'time' | 'datetime' = 'short',
) {
  if (d === null || d === undefined) return '—';
  const x = typeof d === 'string' ? new Date(d) : d;
  if (!(x instanceof Date) || Number.isNaN(x.getTime())) return '—';
  if (style === 'time') return x.toLocaleTimeString('en-GB', { timeZone: ZONE, hour: '2-digit', minute: '2-digit' });
  if (style === 'datetime')
    return x.toLocaleString('en-GB', {
      timeZone: ZONE,
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  if (style === 'long')
    return x.toLocaleDateString('en-GB', { timeZone: ZONE, day: 'numeric', month: 'long', year: 'numeric' });
  return x.toLocaleDateString('en-GB', { timeZone: ZONE, day: 'numeric', month: 'short', year: 'numeric' });
}

export function relative(d: string) {
  const diff = (Date.now() - new Date(d).getTime()) / 1000;
  if (Number.isNaN(diff)) return '—';
  if (diff < 0) {
    const days = Math.round(-diff / 86400);
    return days <= 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`;
  }
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`;
  return date(d);
}

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');

/** "PENDING_APPROVAL" → "Pending approval". */
export const humanise = (value: string) =>
  value
    ? value.charAt(0).toUpperCase() + value.slice(1).toLowerCase().replace(/_/g, ' ')
    : '';

export const fileSize = (bytes: number) =>
  bytes >= 1_048_576
    ? `${(bytes / 1_048_576).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;

/**
 * Whole days between today and the given date, counted on the calendar.
 *
 * Counting raw elapsed milliseconds and rounding up is what made a trial
 * ending tomorrow read "2 days left": any fraction of a day became a whole
 * one. Worse, it could disagree with the date printed beside it — a period
 * running to 19 Dec claimed 32 days left when the period was 30 days long.
 *
 * Both numbers come off the same calendar now, in the reader's own timezone,
 * so the count and the date can never contradict each other. Today is 0,
 * tomorrow is 1.
 */
export const daysUntil = (iso: string) => {
  const target = new Date(iso);
  if (Number.isNaN(target.getTime())) return 0;
  // Both ends reduced to a calendar date first, then compared as UTC
  // midnights — the same calendar `date()` prints from, so the number and the
  // date beside it can never contradict each other.
  const asUtcMidnight = (d: Date) => Date.parse(`${civilDay(d)}T00:00:00Z`);
  return Math.round((asUtcMidnight(target) - asUtcMidnight(new Date())) / 86_400_000);
};
