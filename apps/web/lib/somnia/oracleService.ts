import {
  createSomniaPublicClient,
  labelToHash,
  readLabeledOracleSnapshot,
  type Hex,
} from '@x402/contracts'
import { formatEther, formatUnits, type Address } from 'viem'
import { getConfiguredOracleFeeds, getDefaultOracleFeed, type SomniaOracleFeedConfig } from './config'
import {
  quoteLabeledOracleFetch,
  runLabeledOracleFetchWithKey,
  type SomniaOracleFetchResult,
} from './requestOracle'
import { requireSomniaAgentBridge } from './agents'

export type { SomniaOracleFeedConfig }

export interface OracleFeedSnapshot {
  label: string
  labelHash: Hex
  decimals: number
  url: string
  jsonSelector: string
  value: string
  valueFormatted: string
  requestId: string
  hasValue: boolean
  bridgeAddress: Address
  explorerBaseUrl: string
}

export interface OracleRefreshResult {
  feed: SomniaOracleFeedConfig
  quote: { depositWei: string; depositStt: string }
  fetch: SomniaOracleFetchResult
  snapshot: OracleFeedSnapshot
}

const EXPLORER = 'https://shannon-explorer.somnia.network'

export function getOracleExecutorKey(): Hex | undefined {
  const key = (
    process.env.SOMNIA_ORACLE_EXECUTOR_KEY ?? process.env.FACILITATOR_RELAYER_KEY
  )?.trim()
  if (!key) return undefined
  return (key.startsWith('0x') ? key : `0x${key}`) as Hex
}

export function resolveOracleFeed(label?: string): SomniaOracleFeedConfig {
  const feeds = getConfiguredOracleFeeds()
  if (label) {
    const match = feeds.find((f) => f.label === label)
    if (match) return match
    throw new Error(`Unknown oracle feed label: ${label}`)
  }
  const fallback = getDefaultOracleFeed()
  if (fallback) return fallback
  throw new Error(
    'No oracle feed configured. Set SOMNIA_ORACLE_URL and SOMNIA_ORACLE_SELECTOR in apps/web/.env.local'
  )
}

export async function readOracleFeedSnapshot(
  label: string,
  decimals?: number
): Promise<OracleFeedSnapshot> {
  const bridge = requireSomniaAgentBridge()
  const publicClient = createSomniaPublicClient()
  const feed = resolveOracleFeed(label)
  const dec = decimals ?? feed.decimals

  const { value, requestId, labelHash } = await readLabeledOracleSnapshot(
    publicClient,
    bridge,
    label
  )

  return {
    label,
    labelHash,
    decimals: dec,
    url: feed.url,
    jsonSelector: feed.jsonSelector,
    value: value.toString(),
    valueFormatted: formatUnits(value, dec),
    requestId: requestId.toString(),
    hasValue: value > 0n,
    bridgeAddress: bridge,
    explorerBaseUrl: EXPLORER,
  }
}

export async function listOracleFeedSnapshots(): Promise<OracleFeedSnapshot[]> {
  const feeds = getConfiguredOracleFeeds()
  if (feeds.length === 0) return []

  return Promise.all(feeds.map((f) => readOracleFeedSnapshot(f.label, f.decimals)))
}

export async function refreshOracleFeed(
  options: {
    label?: string
    url?: string
    jsonSelector?: string
    decimals?: number
  } = {}
): Promise<OracleRefreshResult> {
  const executorKey = getOracleExecutorKey()
  if (!executorKey) {
    throw new Error(
      'SOMNIA_ORACLE_EXECUTOR_KEY or FACILITATOR_RELAYER_KEY must be set on the server'
    )
  }

  const base = resolveOracleFeed(options.label)
  const feed: SomniaOracleFeedConfig = {
    label: base.label,
    url: options.url ?? base.url,
    jsonSelector: options.jsonSelector ?? base.jsonSelector,
    decimals: options.decimals ?? base.decimals,
  }

  const quote = await quoteLabeledOracleFetch(feed.label)
  const fetch = await runLabeledOracleFetchWithKey(executorKey, {
    label: feed.label,
    url: feed.url,
    jsonSelector: feed.jsonSelector,
    decimals: feed.decimals,
    pollTimeoutMs: Number(process.env.SOMNIA_ORACLE_POLL_TIMEOUT_MS ?? '300000'),
  })

  const snapshot: OracleFeedSnapshot = {
    label: feed.label,
    labelHash: labelToHash(feed.label),
    decimals: feed.decimals,
    url: feed.url,
    jsonSelector: feed.jsonSelector,
    value: fetch.value.toString(),
    valueFormatted: formatUnits(fetch.value, feed.decimals),
    requestId: fetch.requestId.toString(),
    hasValue: fetch.value > 0n,
    bridgeAddress: quote.bridgeAddress,
    explorerBaseUrl: EXPLORER,
  }

  return {
    feed,
    quote: {
      depositWei: quote.depositWei.toString(),
      depositStt: formatEther(quote.depositWei),
    },
    fetch,
    snapshot,
  }
}

export function serializeRefreshResult(result: OracleRefreshResult) {
  return {
    success: true,
    feed: result.feed,
    quote: result.quote,
    requestId: result.fetch.requestId.toString(),
    submitTxHash: result.fetch.submitTxHash,
    depositWei: result.fetch.depositWei.toString(),
    depositStt: formatEther(result.fetch.depositWei),
    snapshot: result.snapshot,
    explorerTxUrl: `${EXPLORER}/tx/${result.fetch.submitTxHash}`,
  }
}
