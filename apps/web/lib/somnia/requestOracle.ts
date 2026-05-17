import type { Hex } from 'viem'
import { formatEther } from 'viem'
import { labelToHash } from '@x402/contracts'
import { requireSomniaAgentBridge } from './agents'
import {
  quoteJsonApiDepositWei,
  requestLabeledOracleFetch,
  type SomniaOracleFetchParams,
  type SomniaOracleFetchResult,
} from './fetchLabeledOracle'

export type { SomniaOracleFetchParams, SomniaOracleFetchResult }
export { labelToHash, quoteJsonApiDepositWei, requestLabeledOracleFetch }

export interface SomniaOracleQuote {
  depositWei: bigint
  depositStt: string
  bridgeAddress: `0x${string}`
  labelHash: Hex
}

/** Read deposit required for a labeled JSON API fetch (no transaction). */
export async function quoteLabeledOracleFetch(
  label: string,
  chainId?: number
): Promise<SomniaOracleQuote> {
  const bridge = requireSomniaAgentBridge(chainId)
  const depositWei = await quoteJsonApiDepositWei(bridge)
  return {
    depositWei,
    depositStt: formatEther(depositWei),
    bridgeAddress: bridge,
    labelHash: labelToHash(label),
  }
}

/** Run labeled fetch using a server-side private key (automation / scripts). */
export async function runLabeledOracleFetchWithKey(
  privateKey: Hex,
  params: Omit<SomniaOracleFetchParams, 'bridgeAddress'> & { chainId?: number }
): Promise<SomniaOracleFetchResult> {
  const bridge = requireSomniaAgentBridge(params.chainId)
  return requestLabeledOracleFetch(privateKey, {
    label: params.label,
    url: params.url,
    jsonSelector: params.jsonSelector,
    decimals: params.decimals,
    bridgeAddress: bridge,
    depositBufferBps: params.depositBufferBps,
    pollIntervalMs: params.pollIntervalMs,
    pollTimeoutMs: params.pollTimeoutMs,
  })
}
