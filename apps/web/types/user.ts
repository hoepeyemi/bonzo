import type { Address } from 'viem'

export interface UserBalance {
  native: bigint
  usdce: bigint
}

export interface UserSession {
  walletAddress: Address
  chainId: number
  isAuthenticated: boolean
}

export interface UserState {
  session: UserSession | null
  balance: UserBalance | null
  isLoading: boolean
  isBalanceLoading: boolean
  error: string | null
  /** Wallet connected but not on a supported Somnia network */
  isWrongNetwork: boolean
  /** Chain the app expects (from `NEXT_PUBLIC_CHAIN_ID`, default Somnia testnet) */
  appChainId: number
}

export interface UserOperations {
  signOut: () => Promise<void>
  refreshBalance: () => Promise<void>
  refreshSession: () => Promise<void>
}
