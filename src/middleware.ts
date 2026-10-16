import { NextResponse, type NextRequest } from 'next/server';
import { DECOY_PATHS } from '@/lib/shadow-challenges';

function tryBase64Decode(segment: string): string | null {
  try {
    // Basic length/charset check
    if (!/^[-A-Za-z0-9_+=\/]+$/.test(segment)) return null;
    const text = Buffer.from(segment.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
    if (!text) return null;
    return text;
  } catch {
    return null;
  }
}

function tryHexDecode(segment: string): string | null {
  try {
    if (!/^[0-9a-fA-F]+$/.test(segment) || segment.length % 2 !== 0) return null;
    const text = Buffer.from(segment, 'hex').toString('utf8');
    return text || null;
  } catch {
    return null;
  }
}

function rot13(text: string): string {
  return text.replace(/[a-zA-Z]/g, (c) => {
    const base = c <= 'Z' ? 65 : 97;
    return String.fromCharCode(((c.charCodeAt(0) - base + 13) % 26) + base);
  });
}

/**
 * Routing hint only: does the request carry something that looks like an admin
 * session cookie? The real check (database lookup) happens in the /bikram page
 * and in every admin API route, so a forged cookie gains nothing here.
 */
function hasValidSession(request: NextRequest): boolean {
  const token = request.cookies.get('admin_session')?.value;
  return typeof token === 'string' && /^[A-Za-z0-9_-]{40,60}$/.test(token);
}

/**
 * Add security headers to the response.
 */
function addSecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  return response;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isAuthenticated = hasValidSession(request);
  const headers = (response: NextResponse) => {
    addSecurityHeaders(response);
    if (!['/', '/blog', '/sitemap.xml', '/robots.txt'].includes(pathname) && !pathname.startsWith('/blog/')) response.headers.set('X-Robots-Tag', 'noindex, nofollow');
    return response;
  };

  if ((DECOY_PATHS as readonly string[]).includes(pathname)) {
    const response = headers(NextResponse.next());
    response.headers.set('X-Robots-Tag', 'noindex, nofollow');
    return response;
  }

  // Allow public access portal (obfuscated)
  if (pathname === '/b1kr4m-5h4d0w') {
    return headers(NextResponse.next());
  }

  // Allow direct access to bikram route (admin dashboard) - REAL ACCESS
  if (pathname === '/bikram') {
    return headers(NextResponse.next());
  }

  // Allow access to admin route - DEAD END (always fails PIN)
  if (pathname === '/admin') {
    return headers(NextResponse.next());
  }

  // Obfuscated paths support: decode last path segment via base64, hex, or rot13
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length === 1) {
    const seg = segments[0];
    const decoded =
      tryBase64Decode(seg) ||
      tryHexDecode(seg) ||
      rot13(seg);

    if (decoded === 'admin' || decoded === '/admin') {
      // Require session for direct admin, otherwise show portal
      if (isAuthenticated) return headers(NextResponse.rewrite(new URL('/admin', request.url)));
      return headers(NextResponse.rewrite(new URL('/b1kr4m-5h4d0w', request.url)));
    }
    if (decoded === 'admin/access' || decoded === '/admin/access') {
      return headers(NextResponse.rewrite(new URL('/b1kr4m-5h4d0w', request.url)));
    }
    if (decoded === 'bikram' || decoded === '/bikram') {
      // Obfuscated bikram access
      if (isAuthenticated) return headers(NextResponse.rewrite(new URL('/bikram', request.url)));
      return headers(NextResponse.rewrite(new URL('/b1kr4m-5h4d0w', request.url)));
    }
  }

  // Additional obfuscated bikram paths (more secure)
  if (pathname === '/Ym1rcmFt' || pathname === '/62696b72616d' || pathname === '/ovxenz' || pathname === '/b1kr4m') {
    if (isAuthenticated) return headers(NextResponse.rewrite(new URL('/bikram', request.url)));
    return headers(NextResponse.rewrite(new URL('/b1kr4m-5h4d0w', request.url)));
  }

  return headers(NextResponse.next());
}

export const config = {
  matcher: [
    '/bikram',
    '/admin',
    '/b1kr4m-5h4d0w',
    '/Ym1rcmFt',
    '/62696b72616d', 
    '/ovxenz',
    '/b1kr4m',
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
