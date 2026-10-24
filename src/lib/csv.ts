export interface CsvMember { name: string; phone: string; email: string; row: number; error?: string }

export const CSV_TEMPLATE = 'full_name,phone,email\nAmaka Obi,+234 803 000 1111,amaka@example.com\nTunde Bakare,+234 806 000 2222,';

/** Minimal CSV reader for member imports: expects full_name, phone, email columns. */
export function parseMembersCsv(text: string): CsvMember[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return [];
  const header = lines[0]!.toLowerCase().split(',').map((h) => h.trim());
  const hasHeader = header.some((h) => /name|phone|email/.test(h));
  const idx = (k: RegExp, fallback: number) => { const i = header.findIndex((h) => k.test(h)); return hasHeader && i >= 0 ? i : fallback; };
  const ni = idx(/name/, 0), pi = idx(/phone|mobile/, 1), ei = idx(/mail/, 2);
  return lines.slice(hasHeader ? 1 : 0).map((l, i) => {
    const c = l.split(',').map((x) => x.trim().replace(/^"|"$/g, ''));
    const m: CsvMember = { name: c[ni] ?? '', phone: c[pi] ?? '', email: c[ei] ?? '', row: i + (hasHeader ? 2 : 1) };
    if (!m.name) m.error = 'Missing name';
    else if (!m.phone && !m.email) m.error = 'Needs a phone or email';
    else if (m.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(m.email)) m.error = 'Invalid email';
    return m;
  });
}

/**
 * Turns rows into a CSV file and hands it to the browser.
 *
 * Every field is quoted and inner quotes doubled: a member's name containing
 * a comma would otherwise shift every column after it, and an export that
 * silently corrupts itself is worse than no export.
 */
export function downloadCsv(filename: string, rows: Array<Record<string, string | number | null>>) {
  if (!rows.length) return;

  const headers = Object.keys(rows[0]!);
  const escape = (v: string | number | null) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = [
    headers.map(escape).join(','),
    ...rows.map((row) => headers.map((h) => escape(row[h] ?? '')).join(',')),
  ].join('\n');

  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
