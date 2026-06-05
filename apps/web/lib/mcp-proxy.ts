import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'

const HOP_BY_HOP_HEADERS = [
  'connection',
  'content-encoding',
  'content-length',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
]

const BODYLESS_METHODS = new Set(['GET', 'HEAD'])

function getRequestId(request: NextRequest): string {
  return request.headers.get('x-request-id') || randomBytes(8).toString('hex')
}

function getMcpUpstreamUrl(): string {
  return (
    process.env.MCP_INTERNAL_URL ||
    process.env.MCP_UPSTREAM_URL ||
    process.env.MCP_PUBLIC_URL ||
    'http://localhost:3001'
  ).replace(/\/$/, '')
}

function sanitizeRequestHeaders(request: NextRequest, upstream: URL, requestId: string): Headers {
  const headers = new Headers(request.headers)

  for (const header of HOP_BY_HOP_HEADERS) {
    headers.delete(header)
  }

  headers.set('host', upstream.host)
  headers.set('x-request-id', requestId)
  headers.set('x-forwarded-host', request.headers.get('host') || request.nextUrl.host)
  headers.set('x-forwarded-proto', request.headers.get('x-forwarded-proto') || request.nextUrl.protocol.replace(':', ''))
  headers.set('x-forwarded-for', request.headers.get('x-forwarded-for') || '')

  return headers
}

function sanitizeResponseHeaders(response: Response, requestId: string): Headers {
  const headers = new Headers(response.headers)

  for (const header of HOP_BY_HOP_HEADERS) {
    headers.delete(header)
  }

  headers.set('x-request-id', requestId)
  return headers
}

export async function proxyToMcpServer(request: NextRequest, upstreamPath: string): Promise<NextResponse> {
  const requestId = getRequestId(request)
  const upstreamBase = getMcpUpstreamUrl()
  const upstream = new URL(upstreamPath, upstreamBase)
  upstream.search = request.nextUrl.search

  const startedAt = Date.now()

  console.log('[MCP Web Proxy] request:start', {
    requestId,
    method: request.method,
    publicPath: `${request.nextUrl.pathname}${request.nextUrl.search}`,
    upstream: upstream.toString(),
    host: request.headers.get('host'),
    userAgent: request.headers.get('user-agent'),
    hasAuthorization: Boolean(request.headers.get('authorization')),
    hasSessionId: Boolean(request.headers.get('mcp-session-id')),
  })

  try {
    const init: RequestInit = {
      method: request.method,
      headers: sanitizeRequestHeaders(request, upstream, requestId),
      redirect: 'manual',
      cache: 'no-store',
    }

    if (!BODYLESS_METHODS.has(request.method)) {
      init.body = await request.arrayBuffer()
    }

    const upstreamResponse = await fetch(upstream, init)
    const headers = sanitizeResponseHeaders(upstreamResponse, requestId)

    console.log('[MCP Web Proxy] request:finish', {
      requestId,
      method: request.method,
      publicPath: `${request.nextUrl.pathname}${request.nextUrl.search}`,
      upstreamStatus: upstreamResponse.status,
      durationMs: Date.now() - startedAt,
      hasWwwAuthenticate: upstreamResponse.headers.has('www-authenticate'),
      hasSessionId: upstreamResponse.headers.has('mcp-session-id'),
    })

    return new NextResponse(upstreamResponse.body, {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers,
    })
  } catch (error) {
    console.error('[MCP Web Proxy] request:error', {
      requestId,
      method: request.method,
      publicPath: `${request.nextUrl.pathname}${request.nextUrl.search}`,
      upstream: upstream.toString(),
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error),
    })

    return NextResponse.json({
      error: 'mcp_upstream_unavailable',
      error_description: 'Unable to reach the internal MCP server',
      request_id: requestId,
    }, {
      status: 502,
      headers: {
        'x-request-id': requestId,
      },
    })
  }
}
