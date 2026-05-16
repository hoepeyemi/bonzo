import type { Address } from 'viem'
import { USDC_E_CONFIG } from '@x402/payment'

const SOMNIA_TESTNET_ID = 50312

/**
 * Well-known token for selection in OAuth consent flows
 */
export interface WellKnownToken {
  address: Address
  symbol: string
  name: string
  decimals: number
  logoUrl?: string
  chainId: number
}

/**
 * Well-known tokens per chain
 */
const WELL_KNOWN_TOKENS_BY_CHAIN: Record<number, WellKnownToken[]> = {
  [SOMNIA_TESTNET_ID]: [
    {
      address: USDC_E_CONFIG[SOMNIA_TESTNET_ID].address,
      symbol: USDC_E_CONFIG[SOMNIA_TESTNET_ID].symbol,
      name: 'Somnia Testnet Token',
      decimals: USDC_E_CONFIG[SOMNIA_TESTNET_ID].decimals,
      chainId: SOMNIA_TESTNET_ID,
    },
  ],
}

/**
 * Get well-known tokens for a specific chain
 */
export function getWellKnownTokens(chainId: number): WellKnownToken[] {
  return WELL_KNOWN_TOKENS_BY_CHAIN[chainId] ?? []
}

/**
 * Get a specific well-known token by address
 */
export function getWellKnownToken(address: Address, chainId: number): WellKnownToken | undefined {
  const tokens = getWellKnownTokens(chainId)
  return tokens.find((t) => t.address.toLowerCase() === address.toLowerCase())
}

/**
 * Check if an address is a well-known token
 */
export function isWellKnownToken(address: Address, chainId: number): boolean {
  return getWellKnownToken(address, chainId) !== undefined
}

/**
 * Token info for scope configuration
 */
export interface TokenSelection {
  address: Address
  symbol: string
  name: string
  decimals: number
}

export function toTokenSelection(token: WellKnownToken): TokenSelection {
  return {
    address: token.address,
    symbol: token.symbol,
    name: token.name,
    decimals: token.decimals,
  }
}
