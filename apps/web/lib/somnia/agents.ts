import type { Address } from 'viem'
import {
  getSomniaAgentsPlatformAddress,
  getSomniaAgentBridgeAddress,
  somniaAgentBridgeAbi,
} from '@x402/contracts'
import { getAppChainId } from '@/config/tokens'

/**
 * Somnia Agents configuration for the web app.
 * @see https://metaversal.gitbook.io/agents/s8KLL5NzoS6LwJVIQCiT/invoking-agents/quickstart
 */
export function getSomniaAgentsConfig(chainId: number = getAppChainId()) {
  const platformAddress = getSomniaAgentsPlatformAddress(chainId)
  const bridgeFromEnv = process.env.NEXT_PUBLIC_SOMNIA_AGENT_BRIDGE_ADDRESS as Address | undefined
  let bridgeAddress: Address | undefined = bridgeFromEnv
  if (!bridgeAddress) {
    try {
      bridgeAddress = getSomniaAgentBridgeAddress(chainId)
    } catch {
      bridgeAddress = undefined
    }
  }
  const jsonApiAgentId = process.env.NEXT_PUBLIC_JSON_API_AGENT_ID

  return {
    platformAddress,
    bridgeAddress,
    jsonApiAgentId: jsonApiAgentId ? BigInt(jsonApiAgentId) : undefined,
    agentExplorerUrl:
      chainId === 50312
        ? 'https://agents.testnet.somnia.network'
        : 'https://agents.somnia.network',
  }
}

export { somniaAgentBridgeAbi }

export type SomniaAgentsConfig = ReturnType<typeof getSomniaAgentsConfig>

export function requireSomniaAgentBridge(chainId?: number): Address {
  const bridge = getSomniaAgentsConfig(chainId).bridgeAddress
  if (!bridge) {
    throw new Error(
      'NEXT_PUBLIC_SOMNIA_AGENT_BRIDGE_ADDRESS is not set. Deploy BonzoSomniaBridge first.'
    )
  }
  return bridge
}
