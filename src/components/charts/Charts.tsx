'use client';

import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { money } from '@/lib/format';

export const C = { green: '#059669', greenSoft: '#A7F3D0', navy: '#1F3770', navySoft: '#A9BBDD', gold: '#C9932A', slate: '#94A3B8', red: '#DC2626', amber: '#D97706' };
const axis = { fontSize: 11, fill: '#64748B' };

function Tip({ active, payload, label, currency = true }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string; currency?: boolean }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-pop">
      <p className="mb-1 font-medium text-navy-900">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="flex items-center gap-2 text-slate-600">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />{p.name}: <span className="tnum font-medium text-navy-900">{currency ? money(p.value) : p.value.toLocaleString()}</span>
        </p>
      ))}
    </div>
  );
}

type Series = { key: string; name: string; color: string; dashed?: boolean };

export function AreaTrend<T extends object>({ data, x, series, height = 240, currency = true }: { data: T[]; x: keyof T & string; series: Series[]; height?: number; currency?: boolean }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          {series.map((s) => (
            <linearGradient key={s.key} id={`g-${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity={0.22} /><stop offset="100%" stopColor={s.color} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid stroke="#EEF2F7" vertical={false} />
        <XAxis dataKey={x} tick={axis} axisLine={false} tickLine={false} />
        <YAxis tick={axis} axisLine={false} tickLine={false} width={52} tickFormatter={(v) => (currency ? money(v, 'NGN', { compact: true }) : String(v))} />
        <Tooltip content={<Tip currency={currency} />} />
        {series.map((s) => (
          <Area key={s.key} type="monotone" dataKey={s.key} name={s.name} stroke={s.color} strokeWidth={2} strokeDasharray={s.dashed ? '4 4' : undefined} fill={s.dashed ? 'transparent' : `url(#g-${s.key})`} dot={false} activeDot={{ r: 4 }} />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function Bars<T extends object>({ data, x, series, height = 240, stacked, currency = true }: { data: T[]; x: keyof T & string; series: Series[]; height?: number; stacked?: boolean; currency?: boolean }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={2}>
        <CartesianGrid stroke="#EEF2F7" vertical={false} />
        <XAxis dataKey={x} tick={axis} axisLine={false} tickLine={false} />
        <YAxis tick={axis} axisLine={false} tickLine={false} width={52} tickFormatter={(v) => (currency ? money(v, 'NGN', { compact: true }) : String(v))} />
        <Tooltip content={<Tip currency={currency} />} cursor={{ fill: '#F1F5F9' }} />
        {series.length > 1 && <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />}
        {series.map((s) => <Bar key={s.key} dataKey={s.key} name={s.name} fill={s.color} radius={stacked ? 0 : [4, 4, 0, 0]} stackId={stacked ? 'a' : undefined} maxBarSize={28} />)}
      </BarChart>
    </ResponsiveContainer>
  );
}

export function Lines<T extends object>({ data, x, series, height = 240, currency = false }: { data: T[]; x: keyof T & string; series: Series[]; height?: number; currency?: boolean }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="#EEF2F7" vertical={false} />
        <XAxis dataKey={x} tick={axis} axisLine={false} tickLine={false} />
        <YAxis tick={axis} axisLine={false} tickLine={false} width={44} tickFormatter={(v) => (currency ? money(v, 'NGN', { compact: true }) : String(v))} />
        <Tooltip content={<Tip currency={currency} />} />
        {series.map((s) => <Line key={s.key} dataKey={s.key} name={s.name} stroke={s.color} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />)}
      </LineChart>
    </ResponsiveContainer>
  );
}

export function Donut({ data, height = 180, center }: { data: { name: string; value: number; color: string }[]; height?: number; center?: { label: string; value: string } }) {
  return (
    <div className="relative" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius="68%" outerRadius="95%" paddingAngle={2} stroke="none" startAngle={90} endAngle={-270}>
            {data.map((d) => <Cell key={d.name} fill={d.color} />)}
          </Pie>
          <Tooltip content={<Tip />} />
        </PieChart>
      </ResponsiveContainer>
      {center && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="tnum text-base font-semibold text-navy-900">{center.value}</span>
          <span className="text-[11px] text-slate-500">{center.label}</span>
        </div>
      )}
    </div>
  );
}

export function Legendary({ items }: { items: { name: string; color: string; value?: string }[] }) {
  return (
    <ul className="space-y-2">
      {items.map((i) => (
        <li key={i.name} className="flex items-center justify-between gap-3 text-[13px]">
          <span className="flex items-center gap-2 text-slate-600"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: i.color }} />{i.name}</span>
          {i.value && <span className="tnum font-medium text-navy-900">{i.value}</span>}
        </li>
      ))}
    </ul>
  );
}