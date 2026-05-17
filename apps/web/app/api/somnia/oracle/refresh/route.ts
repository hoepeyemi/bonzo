import { NextResponse, type NextRequest } from 'next/server'
import { withAuth } from '@/lib/auth'
import {
  refreshOracleFeed,
  serializeRefreshResult,
} from '@/lib/somnia/oracleService'

/**
 * POST /api/somnia/oracle/refresh
 *
 * Pays native STT from the server executor key and updates the on-chain feed.
 * Requires auth. Body: { label?, url?, jsonSelector?, decimals? }
 */
export const POST = withAuth(async (_user, request) => {
  try {
    const body = await request.json().catch(() => ({}))
    const result = await refreshOracleFeed({
      label: body.label as string | undefined,
      url: body.url as string | undefined,
      jsonSelector: body.jsonSelector as string | undefined,
      decimals: body.decimals != null ? Number(body.decimals) : undefined,
    })

    return NextResponse.json(serializeRefreshResult(result))
  } catch (error) {
    console.error('[somnia/oracle/refresh]', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
})
