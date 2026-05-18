'use client'

import { useCallback, useState } from 'react'
import { useAccount, usePublicClient, useWalletClient } from 'wagmi'
import { getUsdceConfigSafe } from '@/config/tokens'
import { somniaTestnet } from '@/config/somnia-chain'
import {
  DEFAULT_MINT_HUMAN_AMOUNT,
  formatMintPaymentTokenError,
  mintPaymentToken,
} from '@/lib/payment/paymentToken'
import type { Address, Hash } from 'viem'

export type MintX402Status = 'idle' | 'pending' | 'success' | 'error'

export interface UseMintX402PaymentTokenOptions {
  /** Human-readable amount (e.g. "100" = 100 STT). Default 100. */
  humanAmount?: string
  /** Mint to this address; defaults to connected wallet. */
  recipient?: Address
}

export function useMintX402PaymentToken(options: UseMintX402PaymentTokenOptions = {}) {
  const { address, chainId } = useAccount()
  const { data: walletClient } = useWalletClient()
  const publicClient = usePublicClient()

  const [status, setStatus] = useState<MintX402Status>('idle')
  const [error, setError] = useState<string | null>(null)
  const [txHash, setTxHash] = useState<Hash | null>(null)

  const paymentToken = chainId ? getUsdceConfigSafe(chainId) : undefined
  const isTestnet = chainId === somniaTestnet.id

  const mint = useCallback(async (): Promise<Hash> => {
    if (!walletClient || !publicClient) {
      throw new Error('Wallet not connected')
    }
    const recipient = options.recipient ?? address
    if (!recipient) {
      throw new Error('Wallet address required')
    }
    if (!paymentToken?.address) {
      throw new Error('Payment token not configured (NEXT_PUBLIC_USDCE_ADDRESS)')
    }

    setStatus('pending')
    setError(null)
    setTxHash(null)

    try {
      const hash = await mintPaymentToken({
        walletClient,
        publicClient,
        tokenAddress: paymentToken.address,
        recipient,
        humanAmount: options.humanAmount ?? DEFAULT_MINT_HUMAN_AMOUNT,
      })
      setTxHash(hash)
      setStatus('success')
      return hash
    } catch (err) {
      const message = formatMintPaymentTokenError(err)
      setError(message)
      setStatus('error')
      throw new Error(message)
    }
  }, [
    walletClient,
    publicClient,
    address,
    options.recipient,
    options.humanAmount,
    paymentToken?.address,
  ])

  const reset = useCallback(() => {
    setStatus('idle')
    setError(null)
    setTxHash(null)
  }, [])

  return {
    mint,
    reset,
    status,
    error,
    txHash,
    isLoading: status === 'pending',
    paymentTokenAddress: paymentToken?.address,
    canMint: Boolean(isTestnet && paymentToken?.address && walletClient),
  }
}
