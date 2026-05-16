import type { Address } from 'viem'
import { USDC_E_CONFIG } from '@x402/payment'
import { somniaTestnet } from '@/config/somnia-chain'

export interface TokenConfig {
  address: Address
  symbol: string
  decimals: number
}

export interface ChainTokens {
  usdce: TokenConfig
  native: {
    symbol: string
    decimals: number
  }
}

function usdceAddressForChain(chainId: number): Address {
  const base = USDC_E_CONFIG[chainId as keyof typeof USDC_E_CONFIG]?.address
  if (chainId === somniaTestnet.id) {
    const fromEnv = process.env.NEXT_PUBLIC_USDCE_ADDRESS as Address | undefined
    if (fromEnv) return fromEnv
  }
  return base as Address
}

export const tokens: Record<number, ChainTokens> = {
  [somniaTestnet.id]: {
    usdce: {
      address: usdceAddressForChain(somniaTestnet.id),
      symbol: USDC_E_CONFIG[50312].symbol,
      decimals: USDC_E_CONFIG[50312].decimals,
    },
    native: {
      symbol: 'STT',
      decimals: 18,
    },
  },
} as const

export function isChainSupported(chainId: number): boolean {
  return chainId in tokens
}

export function getTokens(chainId: number): ChainTokens {
  const chainTokens = tokens[chainId]
  if (!chainTokens) {
    throw new Error(`Unsupported chain: ${chainId}`)
  }
  return chainTokens
}

export function getUsdceConfig(chainId: number): TokenConfig {
  return getTokens(chainId).usdce
}

export function getUsdceConfigSafe(chainId: number): TokenConfig | null {
  return tokens[chainId]?.usdce ?? null
}

export function getNativeConfig(chainId: number): ChainTokens['native'] {
  return getTokens(chainId).native
}

export const defaultChainId = somniaTestnet.id

/** App target chain from env (defaults to Somnia Shannon testnet). */
export function getAppChainId(): number {
  const fromEnv = parseInt(process.env.NEXT_PUBLIC_CHAIN_ID ?? '', 10)
  if (!Number.isNaN(fromEnv) && isChainSupported(fromEnv)) {
    return fromEnv
  }
  return defaultChainId
}
