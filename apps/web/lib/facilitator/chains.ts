import type { Address } from 'viem'
import type { ChainConfig, PaymentRequirements } from './types'
import {
  CHAIN_CONFIGS as SHARED_CHAIN_CONFIGS,
  DEFAULT_CHAIN_ID,
  getNetworkFromChainId as sharedGetNetworkFromChainId,
  parseChainId as sharedParseChainId,
  isSupportedChain,
} from '@x402/payment'
import { getUsdceConfig } from '@/config/tokens'

/** Default chain ID (Somnia Shannon testnet) */
export const defaultChainId = DEFAULT_CHAIN_ID

function facilitatorUrlForChain(chainId: number): string | null {
  if (chainId !== 50312) return null
  const u = process.env.NEXT_PUBLIC_X402_FACILITATOR_URL?.trim()
  return u || null
}

/**
 * Chain configurations for the facilitator
 */
function usdceAddressForChain(chainId: number): Address {
  return getUsdceConfig(chainId).address
}

export const chainConfigs: Record<number, ChainConfig> = {
  50312: {
    chainId: 50312,
    name: 'somnia-testnet',
    officialFacilitatorUrl: facilitatorUrlForChain(50312),
    usdcAddress: usdceAddressForChain(50312),
    rpcUrl: SHARED_CHAIN_CONFIGS[50312].rpcUrl,
  },
}

/**
 * Get chain configuration by chain ID
 */
export function getChainConfig(chainId: number): ChainConfig | null {
  return chainConfigs[chainId] ?? null
}

/**
 * Parse network string to chain ID
 */
export function parseChainId(network: string): number {
  return sharedParseChainId(network)
}

/**
 * Get network string from chain ID
 */
export function getNetworkFromChainId(chainId: number): string {
  if (isSupportedChain(chainId)) {
    return sharedGetNetworkFromChainId(chainId)
  }
  return `eip155:${chainId}`
}

/**
 * Get STT payment token address for a chain.
 * Uses NEXT_PUBLIC_USDCE_ADDRESS on Somnia when set (must match session grant scopes).
 */
export function getUsdceAddress(chainId: number = defaultChainId): Address {
  return getUsdceConfig(chainId).address
}

/**
 * Payment details for building requirements
 */
export interface PaymentDetails {
  amount: number
  asset: Address
  recipient: Address
  chainId: number
  description?: string
  mimeType?: string
  maxTimeoutSeconds?: number
}

/**
 * Build payment requirements for 402 response
 */
export function buildPaymentRequirements(details: PaymentDetails): PaymentRequirements {
  const network = getNetworkFromChainId(details.chainId)

  return {
    scheme: 'exact',
    network,
    payTo: details.recipient,
    asset: details.asset,
    maxAmountRequired: details.amount.toString(),
    maxTimeoutSeconds: details.maxTimeoutSeconds ?? 300,
    description: details.description,
    mimeType: details.mimeType,
  }
}
