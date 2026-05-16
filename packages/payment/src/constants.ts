import type { Address } from 'viem'
import type { ChainConfig, SupportedChainId, NetworkId, TokenConfig } from './types'

/**
 * USDC (EIP-3009) on Somnia Shannon testnet.
 * Override with NEXT_PUBLIC_USDCE_ADDRESS in the web app if you deploy a mock token.
 * Domain name/version must match the token’s EIP-712 metadata on-chain.
 */
export const USDC_E_CONFIG: Record<SupportedChainId, TokenConfig> = {
  50312: {
    address: '0x28BEc7E30E6faee657a03e19Bf1128AaD7632A00' as Address,
    symbol: 'USDC',
    decimals: 6,
    domainName: 'USD Coin',
    domainVersion: '2',
  },
} as const

/**
 * Chain configurations
 */
export const CHAIN_CONFIGS: Record<SupportedChainId, ChainConfig> = {
  50312: {
    chainId: 50312,
    networkId: 'somnia-testnet',
    usdce: USDC_E_CONFIG[50312],
    rpcUrl: 'https://api.infra.testnet.somnia.network',
    /** Set NEXT_PUBLIC_X402_FACILITATOR_URL in the web app; no public Somnia facilitator in this package */
    officialFacilitatorUrl: null,
  },
} as const

/**
 * Chain ID to network ID mapping
 */
export const CHAIN_TO_NETWORK: Record<SupportedChainId, NetworkId> = {
  50312: 'somnia-testnet',
} as const

/**
 * Network ID to chain ID mapping
 */
export const NETWORK_TO_CHAIN: Record<NetworkId, SupportedChainId> = {
  'somnia-testnet': 50312,
} as const

/**
 * Default chain ID (Shannon testnet)
 */
export const DEFAULT_CHAIN_ID: SupportedChainId = 50312

/**
 * EIP-712 types for SessionSignature (AgentDelegator)
 */
export const SESSION_SIGNATURE_TYPES = {
  SessionSignature: [
    { name: 'verifyingContract', type: 'address' },
    { name: 'structHash', type: 'bytes32' },
  ],
} as const

/**
 * EIP-712 types for TransferWithAuthorization (EIP-3009)
 */
export const TRANSFER_WITH_AUTHORIZATION_TYPES = {
  TransferWithAuthorization: [
    { name: 'from', type: 'address' },
    { name: 'to', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'validAfter', type: 'uint256' },
    { name: 'validBefore', type: 'uint256' },
    { name: 'nonce', type: 'bytes32' },
  ],
} as const

/**
 * Type hash for TransferWithAuthorization
 */
export const TRANSFER_WITH_AUTHORIZATION_TYPEHASH =
  'TransferWithAuthorization(address from,address to,uint256 value,uint256 validAfter,uint256 validBefore,bytes32 nonce)'
