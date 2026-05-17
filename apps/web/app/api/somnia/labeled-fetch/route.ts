import { NextResponse, type NextRequest } from 'next/server'
import { formatEther } from 'viem'
import {
  refreshOracleFeed,
  serializeRefreshResult,
} from '@/lib/somnia/oracleService'
import { quoteLabeledOracleFetch } from '@/lib/somnia/requestOracle'

/**
 * POST /api/somnia/labeled-fetch
 *
 * Legacy alias for POST /api/somnia/oracle/refresh (no auth).
 * Body optional when SOMNIA_ORACLE_* env is set: { label?, url?, jsonSelector?, decimals? }
 */
export async function POST(request: NextRequest) {
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
    console.error('[somnia/labeled-fetch]', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const label =
      new URL(request.url).searchParams.get('label') ?? 'btc-usd'
    const quote = await quoteLabeledOracleFetch(label)
    return NextResponse.json({
      quote: {
        depositWei: quote.depositWei.toString(),
        depositStt: quote.depositStt,
        bridgeAddress: quote.bridgeAddress,
        labelHash: quote.labelHash,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
