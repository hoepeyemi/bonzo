/**
 * Deployed Contract Addresses
 *
 * Source: hardhat/ignition/deployments/chain-{id}/deployed_addresses.json
 */

import type { Address } from 'viem'

/**
 * AgentDelegator contract addresses by chain ID
 */
export const AGENT_DELEGATOR_ADDRESS: Record<number, Address> = {
  // Somnia Shannon testnet — Path A delegator (no invokeSomniaLabeledFetch; use bridge directly)
  50312: '0x399A377CAAE39Ef521782197C3A4c7159a7274cC',
} as const

/**
 * Get AgentDelegator address for a specific chain
 * @throws if contract is not deployed on the chain
 */
export function getAgentDelegatorAddress(chainId: number): Address {
  const address = AGENT_DELEGATOR_ADDRESS[chainId]
  if (!address) {
    throw new Error(`AgentDelegator not deployed on chain ${chainId}`)
  }
  return address
}

/**
 * Check if AgentDelegator is deployed on a chain
 */
export function isAgentDelegatorDeployed(chainId: number): boolean {
  return chainId in AGENT_DELEGATOR_ADDRESS
}

/**
 * SomniaAgents platform contract (invoke agents on-chain).
 * @see https://metaversal.gitbook.io/agents/s8KLL5NzoS6LwJVIQCiT/invoking-agents/quickstart
 */
export const SOMNIA_AGENTS_PLATFORM_ADDRESS: Record<number, Address> = {
  5031: '0x5E5205CF39E766118C01636bED000A54D93163E6',
  50312: '0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776',
} as const

/**
 * AgentFabricSomniaBridge — deploy via hardhat/scripts/deploy-somnia-agent-bridge.ts
 */
export const SOMNIA_AGENT_BRIDGE_ADDRESS: Record<number, Address> = {
  50312: '0xcaa3228c7c8f82581228cba5867f4a84ae0f5a80',
} as const

export function getSomniaAgentsPlatformAddress(chainId: number): Address {
  const address = SOMNIA_AGENTS_PLATFORM_ADDRESS[chainId]
  if (!address) {
    throw new Error(`SomniaAgents platform not configured for chain ${chainId}`)
  }
  return address
}

export function getSomniaAgentBridgeAddress(chainId: number): Address {
  const address = SOMNIA_AGENT_BRIDGE_ADDRESS[chainId]
  if (!address) {
    throw new Error(`Somnia agent bridge not configured for chain ${chainId}`)
  }
  return address
}

export function isSomniaAgentBridgeDeployed(chainId: number): boolean {
  return chainId in SOMNIA_AGENT_BRIDGE_ADDRESS
}
