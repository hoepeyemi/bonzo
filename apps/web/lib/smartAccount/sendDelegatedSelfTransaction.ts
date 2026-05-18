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

/**
 * Returns true when the address is an EIP-7702 delegated account on Somnia.
 * Somnia treats these as "internal accounts" and rejects wallet eth_sendTransaction
 * self-calls that include calldata (e.g. grantSession).
 */
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

/**
 * Sign a prepared transaction for broadcast via eth_sendRawTransaction.
 *
 * 1. eth_signTransaction (Rabby experimental, some wallets)
 * 2. eth_sign on keccak256(RLP(unsigned)) — MetaMask, WalletConnect, etc.
 */
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
        `Could not sign the session transaction. ` +
          `signTransaction: ${signTxMsg}. eth_sign: ${ethSignMsg}. ` +
          `Try Rabby (Settings → Experimental → eth_signTransaction) or approve the eth_sign prompt in your wallet.`
      )
    }
  }
}

/**
 * Send a transaction from a delegated EOA to itself with calldata.
 *
 * On Somnia, wallet providers reject eth_sendTransaction when to === from and data
 * is non-empty on delegated accounts. Signing locally and broadcasting via
 * eth_sendRawTransaction works (execution is valid per eth_estimateGas).
 */
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

  const request = await walletClient.prepareTransactionRequest({
    account: address,
    chain,
    to: address,
    data,
    gas,
  })

  const serializable = { ...request } as TransactionSerializable

  try {
    const signed = await signPreparedTransaction(
      walletClient,
      address,
      chain,
      serializable
    )
    return publicClient.sendRawTransaction({ serializedTransaction: signed })
  } catch (rawPathError) {
    // Some wallets only expose sendTransaction; worth one attempt before failing.
    try {
      return await walletClient.sendTransaction({
        account: address,
        chain,
        to: address,
        data,
        gas,
      })
    } catch {
      throw rawPathError
    }
  }
}
