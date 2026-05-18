import { somniaTestnet } from '@/config/somnia-chain'
import type { Address, Hash, PublicClient, WalletClient } from 'viem'
import { erc20Abi, parseUnits } from 'viem'

/** MockERC20WithEIP3009 — public mint on Somnia testnet. */
export const paymentTokenMintAbi = [
  {
    type: 'function',
    name: 'mint',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
  },
] as const

export const DEFAULT_MINT_HUMAN_AMOUNT = '100'

/** Somnia rejects txs when wallet/RPC supplies gas below ~21k; mint needs more. */
const MIN_GAS_FLOOR = BigInt(100_000)

export async function readPaymentTokenDecimals(
  publicClient: PublicClient,
  tokenAddress: Address
): Promise<number> {
  const decimals = await publicClient.readContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: 'decimals',
  })
  return Number(decimals)
}

export async function estimateMintGas(
  publicClient: PublicClient,
  tokenAddress: Address,
  recipient: Address,
  amount: bigint,
  sender: Address
): Promise<bigint> {
  const estimated = await publicClient.estimateContractGas({
    address: tokenAddress,
    abi: paymentTokenMintAbi,
    functionName: 'mint',
    args: [recipient, amount],
    account: sender,
  })
  const withBuffer = (estimated * BigInt(120)) / BigInt(100)
  return withBuffer > MIN_GAS_FLOOR ? withBuffer : MIN_GAS_FLOOR
}

/**
 * Mint x402 payment tokens to `recipient` using the connected wallet (Rabby, etc.).
 * Anyone can call mint on MockERC20WithEIP3009 — deployer key not required.
 */
export async function mintPaymentToken({
  walletClient,
  publicClient,
  tokenAddress,
  recipient,
  humanAmount = DEFAULT_MINT_HUMAN_AMOUNT,
}: {
  walletClient: WalletClient
  publicClient: PublicClient
  tokenAddress: Address
  recipient: Address
  humanAmount?: string
}): Promise<Hash> {
  const account = walletClient.account
  if (!account) {
    throw new Error('Wallet account is required')
  }

  const decimals = await readPaymentTokenDecimals(publicClient, tokenAddress)
  const amount = parseUnits(humanAmount, decimals)

  const gas = await estimateMintGas(
    publicClient,
    tokenAddress,
    recipient,
    amount,
    account.address
  )

  const hash = await walletClient.writeContract({
    chain: somniaTestnet,
    account,
    address: tokenAddress,
    abi: paymentTokenMintAbi,
    functionName: 'mint',
    args: [recipient, amount],
    gas,
  })

  const receipt = await publicClient.waitForTransactionReceipt({ hash })
  if (receipt.status !== 'success') {
    throw new Error(`Mint transaction failed: ${hash}`)
  }

  return hash
}

/** User-friendly errors for wallet mint failures. */
export function formatMintPaymentTokenError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err)
  if (/user rejected|user denied|rejected the request/i.test(message)) {
    return 'Transaction cancelled in Rabby. If you saw "gas limit is less than 21000", refresh the page and try Mint again (gas is now estimated for Somnia).'
  }
  if (/less than 21000|gas limit/i.test(message)) {
    return 'Wallet gas limit too low for Somnia. Refresh the page and retry — the app estimates gas before sending.'
  }
  if (/insufficient funds|insufficient balance/i.test(message)) {
    return 'Not enough native STT for gas. Get testnet STT from the Somnia faucet, then retry mint.'
  }
  return message.length > 200 ? `${message.slice(0, 200)}…` : message
}
