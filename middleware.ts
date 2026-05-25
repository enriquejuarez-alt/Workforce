import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PUBLIC_PATHS = ['/login', '/acceso-denegado']

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow public paths and static files
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // Check token in cookie (if set) or skip (localStorage auth is client-side)
  // Since we use localStorage for auth, middleware just passes through
  // and client components handle redirects
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api).*)'],
}
