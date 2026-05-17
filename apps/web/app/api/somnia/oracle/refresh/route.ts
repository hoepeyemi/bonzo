import { NextResponse, type NextRequest } from 'next/server'
import {
  refreshOracleFeed,
  serializeRefreshResult,
} from '@/lib/somnia/oracleService'
import { requireOracleRefreshAuth } from '@/lib/somnia/requireOracleRefreshAuth'

/**
 * POST /api/somnia/oracle/refresh
 *
 * Pays native STT from the server executor key and updates the on-chain feed.
 * Requires sign-in OR SOMNIA_ORACLE_API_KEY (Bearer or x-somnia-oracle-api-key).
 *
 * Body: { label?, url?, jsonSelector?, decimals? }
 */
export async function POST(request: NextRequest) {
  const auth = await requireOracleRefreshAuth(request)
  if (auth instanceof NextResponse) return auth

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
}
