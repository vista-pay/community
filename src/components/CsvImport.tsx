'use client';

import { useRef, useState } from 'react';
import { CheckCircle2, FileSpreadsheet, XCircle } from 'lucide-react';
import { Badge, Button } from '@/components/ui';
import { CSV_TEMPLATE, parseMembersCsv, type CsvMember } from '@/lib/csv';

const SAMPLE = CSV_TEMPLATE + '\nZainab Musa,+234 809 000 3333,zainab@example.com\nChinedu Okeke,,chinedu@example\n,+234 802 000 4444,\nFolasade Ojo,+234 805 000 5555,folasade@example.com';

export function CsvImport({ onImport }: { onImport: (rows: CsvMember[]) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<CsvMember[] | null>(null);
  const [fileName, setFileName] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const load = (text: string, name: string) => {
    const r = parseMembersCsv(text);
    if (!r.length) { setErr('That file has no rows. Use the template: full_name, phone, email.'); return; }
    setErr(null); setRows(r); setFileName(name);
  };
  const valid = rows?.filter((r) => !r.error) ?? [];
  return (
    <div>
      {!rows ? (
        <div className="flex flex-col items-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50 px-4 py-8 text-center">
          <FileSpreadsheet className="h-7 w-7 text-slate-400" />
          <p className="mt-2 text-sm font-medium text-navy-900">Import members from a CSV file</p>
          <p className="mt-1 text-[13px] text-slate-500">Columns: <code className="rounded bg-white px-1 text-xs">full_name, phone, email</code>. Each row needs a phone or email.</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Button size="sm" variant="secondary" onClick={() => ref.current?.click()}>Choose CSV file</Button>
            <Button size="sm" variant="ghost" onClick={() => load(SAMPLE, 'sample-members.csv')}>Use a sample file</Button>
          </div>
          {err && <p role="alert" className="mt-3 text-[13px] text-red-600">{err}</p>}
          <input ref={ref} type="file" accept=".csv,text/csv" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f) load(await f.text(), f.name); e.target.value = ''; }} />
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
            <p className="text-sm font-medium text-navy-900">{fileName}</p>
            <div className="flex gap-2"><Badge tone="green">{valid.length} ready</Badge>{rows.length - valid.length > 0 && <Badge tone="red">{rows.length - valid.length} need fixing</Badge>}</div>
          </div>
          <ul className="max-h-56 divide-y divide-slate-100 overflow-y-auto">
            {rows.map((r) => (
              <li key={r.row} className="flex items-center gap-3 px-4 py-2 text-[13px]">
                {r.error ? <XCircle className="h-4 w-4 shrink-0 text-red-500" /> : <CheckCircle2 className="h-4 w-4 shrink-0 text-brand-600" />}
                <span className="w-10 shrink-0 text-xs text-slate-400 tnum">Row {r.row}</span>
                <span className="min-w-0 flex-1 truncate text-navy-900">{r.name || <em className="text-slate-400">No name</em>} <span className="text-slate-500">· {r.phone || r.email || '—'}</span></span>
                {r.error && <span className="shrink-0 text-xs text-red-600">{r.error}</span>}
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 bg-slate-50/60 px-4 py-3">
            <Button size="sm" variant="ghost" onClick={() => setRows(null)}>Choose another file</Button>
            <Button size="sm" disabled={!valid.length} onClick={() => { onImport(valid); setRows(null); }}>Import {valid.length} member{valid.length === 1 ? '' : 's'}</Button>
          </div>
        </div>
      )}
    </div>
  );
}