'use client';

import { BriefcaseBusiness, Briefcase, Building2, CalendarDays, HandCoins, Hammer, HeartHandshake, Landmark, Megaphone, PieChart, PiggyBank, RefreshCw, Store, TrendingUp, Users, type LucideProps } from 'lucide-react';
const MAP = { BriefcaseBusiness, Briefcase, Building2, CalendarDays, HandCoins, Hammer, HeartHandshake, Landmark, Megaphone, PieChart, PiggyBank, RefreshCw, Store, TrendingUp, Users };
export function DynIcon({ name, ...p }: { name: string } & LucideProps) {
  const I = MAP[name as keyof typeof MAP] ?? Users;
  return <I {...p} />;
}