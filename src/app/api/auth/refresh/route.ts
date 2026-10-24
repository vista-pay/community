import { NextResponse } from 'next/server';
import { refreshSession } from '@/lib/session';

export async function POST() {
  const token = await refreshSession();
  return NextResponse.json({ authenticated: Boolean(token) }, { status: token ? 200 : 401 });
}
