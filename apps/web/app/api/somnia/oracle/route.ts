import { NextResponse, type NextRequest } from 'next/server'
import { formatEther } from 'viem'
import {
  getConfiguredOracleFeeds,
  listOracleFeedSnapshots,
  readOracleFeedSnapshot,
  resolveOracleFeed,
} from '@/lib/somnia/oracleService'
import { quoteLabeledOracleFetch } from '@/lib/somnia/requestOracle'

/**
 * GET /api/somnia/oracle
 *
 * - ?label=btc-usd — read latest on-chain value (free)
 * - no label — list all configured feeds with latest values
 * - ?quote=1&label= — deposit quote only
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const label = searchParams.get('label') ?? undefined
    const quoteOnly = searchParams.get('quote') === '1'

    if (quoteOnly) {
      const feed = resolveOracleFeed(label)
      const quote = await quoteLabeledOracleFetch(feed.label)
      return NextResponse.json({
        label: feed.label,
        quote: {
          depositWei: quote.depositWei.toString(),
          depositStt: formatEther(quote.depositWei),
          bridgeAddress: quote.bridgeAddress,
          labelHash: quote.labelHash,
        },
      })
    }

    if (label) {
      const snapshot = await readOracleFeedSnapshot(label)
      return NextResponse.json({ feed: snapshot })
    }

    const configured = getConfiguredOracleFeeds()
    const feeds = await listOracleFeedSnapshots()

    return NextResponse.json({
      configured: configured.map((f) => ({
        label: f.label,
        url: f.url,
        jsonSelector: f.jsonSelector,
        decimals: f.decimals,
      })),
      feeds,
    })
  } catch (error) {
    console.error('[somnia/oracle GET]', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
