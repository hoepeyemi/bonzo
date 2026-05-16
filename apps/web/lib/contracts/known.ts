import type { Address } from 'viem'
import { USDC_E_CONFIG } from '@x402/payment'

const SOMNIA_TESTNET_ID = 50312

/**
 * Known contract information for UI display and session key configuration
 */
export interface KnownContract {
  address: Address
  name: string
  description: string
  category: 'payment' | 'defi' | 'nft' | 'other'
}

/**
 * Known contracts by chain ID
 */
export const KNOWN_CONTRACTS: Record<number, Record<string, KnownContract>> = {
  [SOMNIA_TESTNET_ID]: {
    'usdc': {
      address: USDC_E_CONFIG[SOMNIA_TESTNET_ID].address,
      name: 'STT',
      description: 'Somnia testnet token for x402 payments',
      category: 'payment',
    },
  },
}

/**
 * Get all known contracts for a chain
 */
export function getKnownContracts(chainId: number): KnownContract[] {
  return Object.values(KNOWN_CONTRACTS[chainId] || {})
}

/**
 * Get a specific known contract by key
 */
export function getKnownContract(chainId: number, key: string): KnownContract | undefined {
  return KNOWN_CONTRACTS[chainId]?.[key]
}

/**
 * Get known contracts by category
 */
export function getKnownContractsByCategory(
  chainId: number,
  category: KnownContract['category']
): KnownContract[] {
  return getKnownContracts(chainId).filter((c) => c.category === category)
}

/**
 * Get the default approved contracts for x402 payments
 */
export function getDefaultApprovedContracts(chainId: number): KnownContract[] {
  const usdc = getKnownContract(chainId, 'usdc')
  return usdc ? [usdc] : []
}

/**
 * Check if an address is a known contract
 */
export function isKnownContract(chainId: number, address: Address): boolean {
  const contracts = getKnownContracts(chainId)
  return contracts.some((c) => c.address.toLowerCase() === address.toLowerCase())
}

/**
 * Get contract name by address (for display)
 */
export function getContractName(chainId: number, address: Address): string | undefined {
  const contracts = getKnownContracts(chainId)
  const contract = contracts.find((c) => c.address.toLowerCase() === address.toLowerCase())
  return contract?.name
}
