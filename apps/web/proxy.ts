import { NextRequest, NextResponse } from 'next/server'

function shouldTrace(pathname: string): boolean {
  return (
    pathname.startsWith('/api/oauth/') ||
    pathname.startsWith('/authorize') ||
    pathname.startsWith('/.well-known/') ||
    pathname.startsWith('/mcp/') ||
    pathname.startsWith('/api/mcp-servers/') ||
    pathname === '/authorize'
  )
}

function makeRequestId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

export function proxy(request: NextRequest) {
  if (!shouldTrace(request.nextUrl.pathname)) {
    return NextResponse.next()
  }

  const requestId = request.headers.get('x-request-id') || makeRequestId()
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-request-id', requestId)

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  })

  response.headers.set('x-request-id', requestId)

  console.log('[Web Trace] request:start', {
    requestId,
    method: request.method,
    pathname: request.nextUrl.pathname,
    search: request.nextUrl.search,
    host: request.headers.get('host'),
    origin: request.headers.get('origin'),
    referer: request.headers.get('referer'),
    userAgent: request.headers.get('user-agent'),
    xForwardedHost: request.headers.get('x-forwarded-host'),
    xForwardedProto: request.headers.get('x-forwarded-proto'),
  })

  return response
}

export const config = {
  matcher: [
    '/api/oauth/:path*',
    '/authorize',
    '/.well-known/:path*',
    '/mcp/:path*',
    '/api/mcp-servers/:path*',
  ],
}
