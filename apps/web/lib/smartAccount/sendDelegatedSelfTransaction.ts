import type {
  Address,
  Chain,
  Hash,
  Hex,
  PublicClient,
  TransactionSerializable,
  WalletClient,
} from 'viem'
import { serializeTransaction, keccak256, hexToSignature } from 'viem'
import { somniaTestnet } from '@/config/somnia-chain'

const EIP7702_DELEGATION_PREFIX = '0xef0100'

export async function isSomniaDelegatedAccount(
  publicClient: PublicClient,
  address: Address
): Promise<boolean> {
  if ((await publicClient.getChainId()) !== somniaTestnet.id) {
    return false
  }
  const code = await publicClient.getCode({ address })
  return Boolean(code?.toLowerCase().startsWith(EIP7702_DELEGATION_PREFIX))
}

async function signPreparedTransaction(
  walletClient: WalletClient,
  address: Address,
  chain: Chain | undefined,
  request: TransactionSerializable
): Promise<Hex> {
  try {
    return await walletClient.signTransaction({
      account: address,
      chain,
      ...request,
    } as Parameters<WalletClient['signTransaction']>[0])
  } catch (signTxError) {
    try {
      const serialized = serializeTransaction(request)
      const hash = keccak256(serialized)
      const sigHex = await walletClient.request({
        method: 'eth_sign',
        params: [address, hash],
      })
      const signature = hexToSignature(sigHex as Hex)
      return serializeTransaction(request, signature)
    } catch (ethSignError) {
      const signTxMsg =
        signTxError instanceof Error ? signTxError.message : String(signTxError)
      const ethSignMsg =
        ethSignError instanceof Error ? ethSignError.message : String(ethSignError)
      throw new Error(
        `Wallet cannot sign transactions (signTransaction: ${signTxMsg}; eth_sign: ${ethSignMsg})`
      )
    }
  }
}

export function isUnsupportedSigningError(message: string): boolean {
  const lower = message.toLowerCase()
  return (
    lower.includes('eth_signtransaction') ||
    lower.includes('eth_sign') ||
    lower.includes('does not exist') ||
    lower.includes('not supported') ||
    lower.includes('cannot sign')
  )
}

export async function sendDelegatedSelfTransaction({
  walletClient,
  publicClient,
  address,
  data,
}: {
  walletClient: WalletClient
  publicClient: PublicClient
  address: Address
  data: Hex
}): Promise<Hash> {
  const useRawBroadcast = await isSomniaDelegatedAccount(publicClient, address)
  const chain = walletClient.chain

  if (!useRawBroadcast) {
    return walletClient.sendTransaction({
      account: address,
      chain,
      to: address,
      data,
    })
  }

  const estimatedGas = await publicClient.estimateGas({
    account: address,
    to: address,
    data,
  })
  const gas = (estimatedGas * BigInt(120)) / BigInt(100)

  // Wallets that only support eth_sendTransaction (e.g. some WalletConnect paths).
  try {
    return await walletClient.sendTransaction({
      account: address,
      chain,
      to: address,
      data,
      gas,
    })
  } catch (sendError) {
    const sendMsg = sendError instanceof Error ? sendError.message : String(sendError)
    if (!isUnsupportedSigningError(sendMsg)) {
      throw sendError
    }
  }

  const request = await walletClient.prepareTransactionRequest({
    account: address,
    chain,
    to: address,
    data,
    gas,
  })

  const serializable = { ...request } as TransactionSerializable
  const signed = await signPreparedTransaction(
    walletClient,
    address,
    chain,
    serializable
  )
  return publicClient.sendRawTransaction({ serializedTransaction: signed })
}
