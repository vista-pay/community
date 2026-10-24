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

export function date(d: string | Date, style: 'short' | 'long' | 'time' | 'datetime' = 'short') {
  const x = typeof d === 'string' ? new Date(d) : d;
  if (Number.isNaN(x.getTime())) return '—';
  if (style === 'time') return x.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  if (style === 'datetime')
    return x.toLocaleString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  if (style === 'long')
    return x.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  return x.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
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

export const daysUntil = (iso: string) =>
  Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
