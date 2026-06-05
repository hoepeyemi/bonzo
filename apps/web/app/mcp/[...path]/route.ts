import { NextRequest } from 'next/server'
import { proxyToMcpServer } from '@/lib/mcp-proxy'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface RouteParams {
  params: Promise<{ path: string[] }>
}

async function handle(request: NextRequest, { params }: RouteParams) {
  const { path } = await params
  return proxyToMcpServer(request, `/mcp/${path.join('/')}`)
}

export async function GET(request: NextRequest, context: RouteParams) {
  return handle(request, context)
}

export async function POST(request: NextRequest, context: RouteParams) {
  return handle(request, context)
}

export async function DELETE(request: NextRequest, context: RouteParams) {
  return handle(request, context)
}

export async function OPTIONS(request: NextRequest, context: RouteParams) {
  return handle(request, context)
}
