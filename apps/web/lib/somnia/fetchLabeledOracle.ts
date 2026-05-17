import { labelToHash, somniaAgentBridgeAbi } from '@x402/contracts'
import { somniaTestnet } from '@/config/somnia-chain'
import {
  decodeEventLog,
  formatEther,
  type Address,
  type Hash,
  type Hex,
  type TransactionReceipt,
} from 'viem'
import { createSomniaPublicClient, createSomniaWalletFromKey } from './chain'

export interface SomniaOracleFetchParams {
  label: string
  url: string
  jsonSelector: string
  decimals?: number
  bridgeAddress: Address
  depositBufferBps?: number
  pollIntervalMs?: number
  pollTimeoutMs?: number
}

export interface SomniaOracleFetchResult {
  requestId: bigint
  submitTxHash: Hash
  depositWei: bigint
  value: bigint
  labelHash: Hex
}

export async function quoteJsonApiDepositWei(bridgeAddress: Address): Promise<bigint> {
  const publicClient = createSomniaPublicClient()
  return publicClient.readContract({
    address: bridgeAddress,
    abi: somniaAgentBridgeAbi,
    functionName: 'quoteJsonApiDeposit',
  })
}

export async function requestLabeledOracleFetch(
  privateKey: Hex,
  params: SomniaOracleFetchParams
): Promise<SomniaOracleFetchResult> {
  const { walletClient, publicClient, account } = createSomniaWalletFromKey(privateKey)

  const bridge = params.bridgeAddress
  const labelHash = labelToHash(params.label)
  const decimals = params.decimals ?? 8
  const bufferBps = params.depositBufferBps ?? 1000
  const pollIntervalMs = params.pollIntervalMs ?? 5000
  const pollTimeoutMs = params.pollTimeoutMs ?? 300_000

  const quotedDeposit = await quoteJsonApiDepositWei(bridge)
  const depositWei =
    quotedDeposit + (quotedDeposit * BigInt(bufferBps)) / BigInt(10000)

  const balance = await publicClient.getBalance({ address: account.address })
  if (balance < depositWei) {
    throw new Error(
      `Insufficient native STT: need ${formatEther(depositWei)} STT, have ${formatEther(balance)} STT`
    )
  }

  const submitTxHash = await walletClient.writeContract({
    chain: somniaTestnet,
    account,
    address: bridge,
    abi: somniaAgentBridgeAbi,
    functionName: 'requestLabeledFetch',
    args: [labelHash, params.url, params.jsonSelector, decimals],
    value: depositWei,
  })

  const submitReceipt = await publicClient.waitForTransactionReceipt({
    hash: submitTxHash,
  })
  if (submitReceipt.status !== 'success') {
    throw new Error(`requestLabeledFetch reverted: ${submitTxHash}`)
  }

  const requestId = parseRequestIdFromReceipt(submitReceipt, bridge, labelHash)
  const value = await pollOracleResult(publicClient, bridge, labelHash, requestId, {
    pollIntervalMs,
    pollTimeoutMs,
  })

  return { requestId, submitTxHash, depositWei, value, labelHash }
}

async function pollOracleResult(
  publicClient: ReturnType<typeof createSomniaPublicClient>,
  bridge: Address,
  labelHash: Hex,
  requestId: bigint,
  opts: { pollIntervalMs: number; pollTimeoutMs: number }
): Promise<bigint> {
  const started = Date.now()
  const zero = BigInt(0)

  while (Date.now() - started < opts.pollTimeoutMs) {
    const pending = await publicClient.readContract({
      address: bridge,
      abi: somniaAgentBridgeAbi,
      functionName: 'isPending',
      args: [requestId],
    })

    const latestId = await publicClient.readContract({
      address: bridge,
      abi: somniaAgentBridgeAbi,
      functionName: 'latestRequestIdByLabel',
      args: [labelHash],
    })

    const latestValue = await publicClient.readContract({
      address: bridge,
      abi: somniaAgentBridgeAbi,
      functionName: 'latestByLabel',
      args: [labelHash],
    })

    if (!pending && latestId === requestId && latestValue > zero) {
      return latestValue
    }

    if (!pending) {
      const direct = await publicClient.readContract({
        address: bridge,
        abi: somniaAgentBridgeAbi,
        functionName: 'uintResults',
        args: [requestId],
      })
      if (direct > zero) return direct
    }

    await new Promise((resolve) => setTimeout(resolve, opts.pollIntervalMs))
  }

  throw new Error(
    `Timed out after ${opts.pollTimeoutMs}ms waiting for Somnia agent response (requestId=${requestId})`
  )
}

function parseRequestIdFromReceipt(
  receipt: TransactionReceipt,
  bridge: Address,
  labelHash: Hex
): bigint {
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== bridge.toLowerCase()) continue
    try {
      const decoded = decodeEventLog({
        abi: somniaAgentBridgeAbi,
        data: log.data,
        topics: log.topics,
      })
      if (decoded.eventName === 'LabeledFetchRequested') {
        const args = decoded.args as { requestId: bigint; label: Hex }
        if (args.label.toLowerCase() === labelHash.toLowerCase()) {
          return args.requestId
        }
      }
    } catch {
      // not our event
    }
  }

  throw new Error(
    'LabeledFetchRequested event not found in submit receipt; check bridge address and transaction status'
  )
}
