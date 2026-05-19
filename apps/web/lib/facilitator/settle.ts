import {
  createPublicClient,
  createWalletClient,
  encodeFunctionData,
  http,
  type Address,
  type Hex,
  type PublicClient,
  type WalletClient,
  type Account,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { somniaTestnet } from '@/config/somnia-chain'
import type {
  PaymentHeader,
  PaymentRequirements,
  SettleResult,
  FeeConfig,
} from './types'
import { detectSignatureType } from './detect'
import { unwrapEIP6492 } from './unwrap'
import { getChainConfig, parseChainId } from './chains'
import { getDefaultFeeConfig, calculateNetAmount } from './fee'
import { verifyPayment } from './verify'
import { paymentNonceRepository } from '@/lib/repositories'

/**
 * EIP-3009 ABI for transferWithAuthorization
 */
const USDC_EIP3009_ABI = [
  {
    name: 'transferWithAuthorization',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'validAfter', type: 'uint256' },
      { name: 'validBefore', type: 'uint256' },
      { name: 'nonce', type: 'bytes32' },
      { name: 'signature', type: 'bytes' },
    ],
    outputs: [],
  },
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const

/** OpenZeppelin ERC20InsufficientBalance(address,uint256,uint256) */
const ERC20_INSUFFICIENT_BALANCE_SELECTOR = '0xe450d38c'

function formatSettlementRevert(error: unknown): string {
  if (error instanceof Error) {
    const cause = error.cause as { signature?: string; raw?: string } | undefined
    const sig = cause?.signature ?? (error.message.includes(ERC20_INSUFFICIENT_BALANCE_SELECTOR)
      ? ERC20_INSUFFICIENT_BALANCE_SELECTOR
      : undefined)
    if (sig === ERC20_INSUFFICIENT_BALANCE_SELECTOR) {
      return (
        'Insufficient x402 payment token balance on the payer smart account. ' +
        'Mint STT (x402) to your EIP-7702 wallet address (Dashboard → Generate Smart Account → Mint), not only to your EOA.'
      )
    }
  }
  return error instanceof Error ? error.message : 'Settlement transaction failed'
}

/**
 * Floor gas estimate from calldata size (EIP-2028-style per-byte cost).
 * - 4 gas per zero byte
 * - 16 gas per non-zero byte
 * - Plus 21000 base transaction gas
 */
function calculateFloorGas(calldata: Hex): bigint {
  const data = calldata.slice(2) // Remove '0x' prefix
  let calldataGas = BigInt(0)

  for (let i = 0; i < data.length; i += 2) {
    const byte = parseInt(data.slice(i, i + 2), 16)
    calldataGas += byte === 0 ? BigInt(4) : BigInt(16)
  }

  const baseTxGas = BigInt(21000)
  return baseTxGas + calldataGas
}

/**
 * Get the viem chain object for a chain ID
 */
function getViemChain(chainId: number) {
  if (chainId === 50312) return somniaTestnet
  throw new Error(`Unsupported chain: ${chainId}`)
}

/**
 * Forward settlement to the configured x402 facilitator
 */
async function settleWithOfficialFacilitator(
  facilitatorUrl: string,
  paymentHeaderBase64: string,
  paymentRequirements: PaymentRequirements
): Promise<SettleResult> {
  const settlementRequest = {
    x402Version: 1,
    paymentHeader: paymentHeaderBase64,
    paymentRequirements,
  }

  console.log('[Facilitator] Forwarding settlement to official facilitator:', facilitatorUrl)

  try {
    const response = await fetch(`${facilitatorUrl}/settle`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X402-Version': '1',
      },
      body: JSON.stringify(settlementRequest),
    })

    const responseText = await response.text()
    console.log('[Facilitator] Official facilitator settlement response:', responseText)

    if (!response.ok) {
      return {
        success: false,
        error: `Settlement failed: ${response.status} ${responseText}`,
      }
    }

    const result = JSON.parse(responseText)

    if (result.event === 'payment.settled' && result.txHash) {
      return {
        success: true,
        txHash: result.txHash,
      }
    }

    return {
      success: false,
      error: 'Unexpected facilitator response',
    }
  } catch (error) {
    console.error('[Facilitator] Official facilitator settlement failed:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Settlement request failed',
    }
  }
}

/**
 * Settle a smart account payment directly on-chain
 */
async function settleSmartAccountPayment(
  walletClient: WalletClient,
  publicClient: PublicClient,
  header: PaymentHeader,
  feeConfig: FeeConfig,
  chain: typeof somniaTestnet,
  account: Account
): Promise<SettleResult> {
  const payload = header.payload

  // Unwrap EIP-6492 to get inner signature
  const innerSignature = unwrapEIP6492(payload.signature as Hex)

  // Calculate fee (for logging, we'll collect it in a future iteration)
  const amount = BigInt(payload.value)
  const { netAmount, fee } = calculateNetAmount(amount, feeConfig)

  console.log('[Facilitator] Settling smart account payment:', {
    from: payload.from,
    to: payload.to,
    amount: amount.toString(),
    fee: fee.toString(),
    netAmount: netAmount.toString(),
    innerSignatureLength: innerSignature.length,
  })

  try {
    const balance = await publicClient.readContract({
      address: payload.asset as Address,
      abi: USDC_EIP3009_ABI,
      functionName: 'balanceOf',
      args: [payload.from as Address],
    })

    if (balance < amount) {
      return {
        success: false,
        error:
          `Insufficient x402 payment token balance: payer ${payload.from} has ${balance.toString()} ` +
          `but payment requires ${amount.toString()} (smallest units). ` +
          'Mint STT (x402) to your smart account wallet, then retry.',
      }
    }

    // Execute transferWithAuthorization directly
    // Note: For hackathon, we send full amount to recipient
    // Fee collection would be done in a separate step or via a splitter contract
    const args = [
      payload.from as Address,
      payload.to as Address,
      amount,
      BigInt(payload.validAfter),
      BigInt(payload.validBefore),
      payload.nonce as Hex,
      innerSignature,
    ] as const

    // Encode calldata to calculate Ethermint floor gas
    const calldata = encodeFunctionData({
      abi: USDC_EIP3009_ABI,
      functionName: 'transferWithAuthorization',
      args,
    })

    // Calculate floor gas (Ethermint enforces minimum based on calldata size)
    const floorGas = calculateFloorGas(calldata)

    // Get EVM execution gas estimate
    const estimatedGas = await publicClient.estimateContractGas({
      address: payload.asset as Address,
      abi: USDC_EIP3009_ABI,
      functionName: 'transferWithAuthorization',
      args,
      account: account.address,
    })

    // Use the higher of floor gas or estimated gas
    const gasLimit = estimatedGas > floorGas ? estimatedGas : floorGas

    console.log('[Facilitator] Gas calculation:', {
      floorGas: floorGas.toString(),
      estimatedGas: estimatedGas.toString(),
      gasLimit: gasLimit.toString(),
    })

    const hash = await walletClient.writeContract({
      chain,
      account,
      address: payload.asset as Address,
      abi: USDC_EIP3009_ABI,
      functionName: 'transferWithAuthorization',
      args,
      gas: gasLimit,
    })

    console.log('[Facilitator] Settlement transaction submitted:', hash)

    // Wait for confirmation
    const receipt = await publicClient.waitForTransactionReceipt({
      hash,
      confirmations: 1,
    })

    console.log('[Facilitator] Settlement confirmed in block:', receipt.blockNumber)

    return {
      success: true,
      txHash: receipt.transactionHash,
    }
  } catch (error) {
    console.error('[Facilitator] Smart account settlement failed:', error)
    return {
      success: false,
      error: formatSettlementRevert(error),
    }
  }
}

/**
 * Settle a payment
 *
 * - For EOA signatures: Forward to NEXT_PUBLIC_X402_FACILITATOR_URL when set
 * - For smart account signatures: Execute transferWithAuthorization directly
 *
 * Should only be called AFTER target API returns success
 */
export async function settlePayment(
  paymentHeaderBase64: string,
  header: PaymentHeader,
  expectedAmount: number,
  expectedRecipient: Address
): Promise<{ txHash: Hex } | null> {
  const chainId = parseChainId(header.network)
  const chainConfig = getChainConfig(chainId)

  if (!chainConfig) {
    console.error('[Facilitator] Unsupported chain for settlement:', chainId)
    return null
  }

  // Detect signature type
  const signatureType = detectSignatureType(header.payload.signature as Hex)

  console.log('[Facilitator] Settling payment:', {
    signatureType,
    chainId,
    from: header.payload.from,
    to: header.payload.to,
    amount: header.payload.value,
  })

  if (signatureType === 'eoa' && chainConfig.officialFacilitatorUrl) {
    const paymentRequirements: PaymentRequirements = {
      scheme: 'exact',
      network: chainConfig.name,
      payTo: expectedRecipient,
      asset: header.payload.asset as Address,
      maxAmountRequired: expectedAmount.toString(),
      maxTimeoutSeconds: 300,
      description: 'API access payment',
      mimeType: 'application/json',
    }

    const facilitatorResult = await settleWithOfficialFacilitator(
      chainConfig.officialFacilitatorUrl,
      paymentHeaderBase64,
      paymentRequirements
    )

    if (facilitatorResult.success && facilitatorResult.txHash) {
      console.log('[Facilitator] Payment settled via facilitator! TxHash:', facilitatorResult.txHash)
      return { txHash: facilitatorResult.txHash }
    }
  }

  // On-chain EIP-3009 settlement (EOA and smart-account signatures; relayer pays gas)
  const relayerKey = process.env.FACILITATOR_RELAYER_KEY
  if (!relayerKey) {
    console.error('[Facilitator] FACILITATOR_RELAYER_KEY not configured')
    return null
  }

  const chain = getViemChain(chainId)
  const account = privateKeyToAccount(relayerKey as Hex)

  const publicClient = createPublicClient({
    chain,
    transport: http(chainConfig.rpcUrl),
  })

  const walletClient = createWalletClient({
    account,
    chain,
    transport: http(chainConfig.rpcUrl),
  })

  const feeConfig = getDefaultFeeConfig()

  const result = await settleSmartAccountPayment(
    walletClient,
    publicClient,
    header,
    feeConfig,
    chain,
    account
  )

  if (!result.success || !result.txHash) {
    console.error('[Facilitator] Settlement failed:', result.error)
    return null
  }

  console.log('[Facilitator] Payment settled! TxHash:', result.txHash)

  return { txHash: result.txHash }
}
