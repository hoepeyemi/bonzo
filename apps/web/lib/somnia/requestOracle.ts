import type { Hex } from 'viem'
import { formatEther } from 'viem'
import {
  createSomniaPublicClient,
  createSomniaWalletFromKey,
  labelToHash,
  quoteJsonApiDepositWei,
  requestLabeledOracleFetch,
  type SomniaOracleFetchParams,
  type SomniaOracleFetchResult,
} from '@x402/contracts'
import { getSomniaAgentsConfig, requireSomniaAgentBridge } from './agents'

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
  const publicClient = createSomniaPublicClient()
  const depositWei = await quoteJsonApiDepositWei(publicClient, bridge)
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
  const { walletClient, publicClient } = createSomniaWalletFromKey(privateKey)
  const bridge = requireSomniaAgentBridge(params.chainId)
  return requestLabeledOracleFetch(walletClient, publicClient, {
    ...params,
    bridgeAddress: bridge,
  })
}

export function getSomniaOracleEnvDefaults(chainId?: number) {
  const { bridgeAddress, agentExplorerUrl, jsonApiAgentId } = getSomniaAgentsConfig(chainId)
  return { bridgeAddress, agentExplorerUrl, jsonApiAgentId }
}
