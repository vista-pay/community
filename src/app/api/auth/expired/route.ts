import { NextResponse } from 'next/server';
import { clearSession } from '@/lib/session';

/**
 * The exit from a dead session.
 *
 * A Server Component cannot clear cookies, so a layout that discovers a dead
 * session has nowhere to put that fact — it redirects to /signin, the
 * middleware sees the stale flag cookie still saying "signed in", and bounces
 * straight back. That is an infinite loop with no way out but clearing site
 * data by hand. This route handler can clear them, so the layout redirects
 * here instead.
 */
export async function GET(request: Request) {
  await clearSession();

  const url = new URL('/signin', request.url);
  url.searchParams.set('expired', '1');
  return NextResponse.redirect(url);
}
