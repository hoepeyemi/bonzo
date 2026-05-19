'use client'

import { Coins, Loader2, ExternalLink } from 'lucide-react'
import { useAccount, useBalance, useReadContract } from 'wagmi'
import { erc20Abi, formatUnits } from 'viem'
import { Button } from '@/components/ui/button'
import { getUsdceConfigSafe } from '@/config/tokens'
import { PAYMENT_DECIMALS } from '@/config/currency'
import { somniaTestnet } from '@/config/somnia-chain'
import { DEFAULT_MINT_HUMAN_AMOUNT } from '@/lib/payment/paymentToken'
import { useMintX402PaymentToken } from '../model/useMintX402PaymentToken'

/**
 * Fund the connected wallet's x402 payment token (EIP-3009 ERC-20).
 * Shown when smart account is already enabled — mint is otherwise only in GenerateWalletModal.
 */
export function X402FundSection() {
  const { address, chainId } = useAccount()
  const paymentTokenConfig = chainId ? getUsdceConfigSafe(chainId) : undefined
  const paymentTokenAddress = paymentTokenConfig?.address
  const isSomniaTestnet = chainId === somniaTestnet.id

  const { data: nativeBalance, isLoading: isNativeLoading } = useBalance({
    address,
    query: { enabled: !!address },
  })

  const { data: decimals } = useReadContract({
    abi: erc20Abi,
    address: paymentTokenAddress,
    functionName: 'decimals',
    query: { enabled: !!paymentTokenAddress },
  })

  const tokenDecimals = decimals !== undefined ? Number(decimals) : PAYMENT_DECIMALS

  const {
    data: paymentBalance,
    isLoading: isPaymentLoading,
    refetch: refetchPaymentBalance,
  } = useReadContract({
    abi: erc20Abi,
    address: paymentTokenAddress,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!paymentTokenAddress },
  })

  const {
    mint,
    isLoading: isMinting,
    error: mintError,
    canMint,
    txHash: mintTxHash,
  } = useMintX402PaymentToken({ humanAmount: DEFAULT_MINT_HUMAN_AMOUNT })

  if (!isSomniaTestnet || !address || !paymentTokenAddress) {
    return null
  }

  const formattedPayment =
    paymentBalance !== undefined
      ? Number(formatUnits(paymentBalance, tokenDecimals)).toFixed(4)
      : '—'
  const formattedNative =
    nativeBalance !== undefined
      ? Number(formatUnits(nativeBalance.value, nativeBalance.decimals)).toFixed(4)
      : '—'
  const hasNativeGas = nativeBalance !== undefined && nativeBalance.value > BigInt(0)
  const hasPaymentToken = paymentBalance !== undefined && paymentBalance > BigInt(0)
  const explorerUrl = `https://shannon-explorer.somnia.network/address/${address}`

  const handleMint = async () => {
    await mint()
    await refetchPaymentBalance()
  }

  return (
    <div className="rounded-lg border bg-muted/30 p-4 space-y-3 mt-4">
      <div className="flex items-start gap-2">
        <Coins className="size-4 text-muted-foreground mt-0.5 shrink-0" />
        <div className="space-y-1 flex-1 min-w-0">
          <p className="text-sm font-medium">x402 payment balance</p>
          <p className="text-xs text-muted-foreground">
            API payments use the EIP-3009 token on your connected wallet (
            <span className="font-mono">{address.slice(0, 6)}…{address.slice(-4)}</span>
            ). This is the same address as your smart account when EIP-7702 is enabled.
          </p>
        </div>
      </div>

      {isPaymentLoading || isNativeLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Checking balances…
        </div>
      ) : (
        <div className="text-sm space-y-1">
          <p>
            <strong>STT (x402):</strong> {formattedPayment}
            {!hasPaymentToken && ' — mint below to pay for APIs'}
          </p>
          <p className="text-muted-foreground">
            <strong>STT (gas):</strong> {formattedNative}
            {!hasNativeGas && ' — get faucet STT for gas'}
          </p>
        </div>
      )}

      {canMint && hasNativeGas && (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="w-full"
          disabled={isMinting}
          onClick={() => void handleMint()}
        >
          {isMinting ? (
            <>
              <Loader2 className="size-4 mr-2 animate-spin" />
              Minting…
            </>
          ) : (
            <>Mint {DEFAULT_MINT_HUMAN_AMOUNT} STT (x402) to this wallet</>
          )}
        </Button>
      )}

      {canMint && !hasNativeGas && (
        <p className="text-xs text-amber-700 dark:text-amber-300">
          You need native STT for gas before minting the x402 payment token.
        </p>
      )}

      {mintError && <p className="text-xs text-destructive">{mintError}</p>}
      {mintTxHash && (
        <p className="text-xs font-mono break-all text-muted-foreground">Mint tx: {mintTxHash}</p>
      )}

      <a
        href={explorerUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-xs text-primary underline"
      >
        View wallet on Somnia explorer
        <ExternalLink className="size-3" />
      </a>
    </div>
  )
}
