import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { SESSION_FLAG_COOKIE } from '@/lib/constants';

const PUBLIC = ['/signin', '/welcome', '/onboarding'];

/**
 * Routing guard only.
 *
 * The flag cookie carries no credential — it just says a session exists, so
 * the middleware can route without reading the HttpOnly token. Every actual
 * authorisation decision is the API's.
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const signedIn = Boolean(req.cookies.get(SESSION_FLAG_COOKIE)?.value);
  const isPublic = PUBLIC.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (!signedIn && !isPublic) {
    const url = req.nextUrl.clone();
    url.pathname = '/signin';
    if (pathname !== '/') url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  if (signedIn && pathname === '/signin') {
    const url = req.nextUrl.clone();
    url.pathname = '/dashboard';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next|favicon.ico|.*\\.(?:png|svg|jpg|jpeg|webp|ico)|api/).*)'],
};
