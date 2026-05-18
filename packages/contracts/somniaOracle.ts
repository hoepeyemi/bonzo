import {
  createPublicClient,
  createWalletClient,
  decodeEventLog,
  formatEther,
  http,
  keccak256,
  toBytes,
  type Address,
  type Hash,
  type Hex,
  type PublicClient,
  type TransactionReceipt,
  type WalletClient,
} from 'viem'
import { privateKeyToAccount, type PrivateKeyAccount } from 'viem/accounts'
import { somniaAgentBridgeAbi } from './abi/somniaAgents.js'
import { getSomniaAgentBridgeAddress } from './addresses.js'
import { resolveSomniaTestnetRpcUrl, getSomniaTestnetRpcUrls } from './somniaRpc.js'

export const SOMNIA_TESTNET_RPC = resolveSomniaTestnetRpcUrl()

export const somniaTestnetChain = {
  id: 50312,
  name: 'Somnia Testnet',
  nativeCurrency: { name: 'STT', symbol: 'STT', decimals: 18 },
  rpcUrls: { default: { http: [...getSomniaTestnetRpcUrls()] } },
} as const

export interface SomniaOracleFetchParams {
  /** Human-readable label; hashed to bytes32 on-chain (e.g. `stt-usd`). */
  label: string
  url: string
  /** JSON path selector for the JsonApi agent (e.g. `bitcoin.usd`). */
  jsonSelector: string
  decimals?: number
  bridgeAddress?: Address
  chainId?: number
  rpcUrl?: string
  /** Extra deposit on top of quote (basis points). Default 1000 = 10%. */
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

export function labelToHash(label: string): Hex {
  return keccak256(toBytes(label))
}

export function createSomniaPublicClient(rpcUrl: string = SOMNIA_TESTNET_RPC) {
  return createPublicClient({
    chain: somniaTestnetChain,
    transport: http(rpcUrl),
  })
}

export function createSomniaWalletFromKey(
  privateKey: Hex,
  rpcUrl: string = SOMNIA_TESTNET_RPC
): { account: PrivateKeyAccount; walletClient: WalletClient; publicClient: PublicClient } {
  const account = privateKeyToAccount(privateKey)
  const transport = http(rpcUrl)
  const publicClient = createPublicClient({ chain: somniaTestnetChain, transport })
  const walletClient = createWalletClient({ account, chain: somniaTestnetChain, transport })
  return { account, walletClient, publicClient }
}

export async function quoteJsonApiDepositWei(
  publicClient: PublicClient,
  bridgeAddress: Address
): Promise<bigint> {
  return publicClient.readContract({
    address: bridgeAddress,
    abi: somniaAgentBridgeAbi,
    functionName: 'quoteJsonApiDeposit',
  })
}

/** Quote deposit using an internal RPC client (no viem types cross package boundary). */
export async function quoteJsonApiDepositAtBridge(
  bridgeAddress: Address,
  rpcUrl: string = SOMNIA_TESTNET_RPC
): Promise<bigint> {
  const publicClient = createSomniaPublicClient(rpcUrl)
  return quoteJsonApiDepositWei(publicClient, bridgeAddress)
}

export interface LabeledOracleSnapshot {
  labelHash: Hex
  value: bigint
  requestId: bigint
}

/** Read cached oracle value from the bridge (no STT cost). */
export async function readLabeledOracleSnapshot(
  publicClient: PublicClient,
  bridgeAddress: Address,
  label: string
): Promise<LabeledOracleSnapshot> {
  const labelHash = labelToHash(label)
  const [value, requestId] = await Promise.all([
    publicClient.readContract({
      address: bridgeAddress,
      abi: somniaAgentBridgeAbi,
      functionName: 'latestByLabel',
      args: [labelHash],
    }),
    publicClient.readContract({
      address: bridgeAddress,
      abi: somniaAgentBridgeAbi,
      functionName: 'latestRequestIdByLabel',
      args: [labelHash],
    }),
  ])
  return { labelHash, value, requestId }
}

/** Read cached label value using an internal RPC client. */
export async function readLabeledOracleSnapshotAtBridge(
  bridgeAddress: Address,
  label: string,
  rpcUrl: string = SOMNIA_TESTNET_RPC
): Promise<LabeledOracleSnapshot> {
  const publicClient = createSomniaPublicClient(rpcUrl)
  return readLabeledOracleSnapshot(publicClient, bridgeAddress, label)
}

/**
 * Submit a labeled fetch, poll for the result, and return on-chain value.
 * Creates viem clients internally — preferred entrypoint for apps and scripts.
 */
export async function requestLabeledOracleFetchWithKey(
  privateKey: Hex,
  params: SomniaOracleFetchParams
): Promise<SomniaOracleFetchResult> {
  const rpcUrl = params.rpcUrl ?? SOMNIA_TESTNET_RPC
  const { walletClient, publicClient } = createSomniaWalletFromKey(privateKey, rpcUrl)
  return requestLabeledOracleFetch(walletClient, publicClient, params)
}

export async function requestLabeledOracleFetch(
  walletClient: WalletClient,
  publicClient: PublicClient,
  params: SomniaOracleFetchParams
): Promise<SomniaOracleFetchResult> {
  const chainId = params.chainId ?? 50312
  const bridge =
    params.bridgeAddress ?? getSomniaAgentBridgeAddress(chainId)
  const labelHash = labelToHash(params.label)
  const decimals = params.decimals ?? 8
  const bufferBps = params.depositBufferBps ?? 1000
  const pollIntervalMs = params.pollIntervalMs ?? 5000
  const pollTimeoutMs = params.pollTimeoutMs ?? 300_000

  const account = walletClient.account
  if (!account) {
    throw new Error('walletClient.account is required')
  }

  const quotedDeposit = await quoteJsonApiDepositWei(publicClient, bridge)
  const depositWei =
    quotedDeposit + (quotedDeposit * BigInt(bufferBps)) / BigInt(10000)

  const balance = await publicClient.getBalance({ address: account.address })
  if (balance < depositWei) {
    throw new Error(
      `Insufficient native STT: need ${formatEther(depositWei)} STT, have ${formatEther(balance)} STT`
    )
  }

  const submitTxHash = await walletClient.writeContract({
    chain: somniaTestnetChain,
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

  return {
    requestId,
    submitTxHash,
    depositWei,
    value,
    labelHash,
  }
}

async function pollOracleResult(
  publicClient: PublicClient,
  bridge: Address,
  labelHash: Hex,
  requestId: bigint,
  opts: { pollIntervalMs: number; pollTimeoutMs: number }
): Promise<bigint> {
  const started = Date.now()

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

    if (!pending && latestId === requestId && latestValue > 0n) {
      return latestValue
    }

    if (!pending) {
      const direct = await publicClient.readContract({
        address: bridge,
        abi: somniaAgentBridgeAbi,
        functionName: 'uintResults',
        args: [requestId],
      })
      if (direct > 0n) return direct
    }

    await sleep(opts.pollIntervalMs)
  }

  throw new Error(
    `Timed out after ${opts.pollTimeoutMs}ms waiting for Somnia agent response (requestId=${requestId})`
  )
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
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
