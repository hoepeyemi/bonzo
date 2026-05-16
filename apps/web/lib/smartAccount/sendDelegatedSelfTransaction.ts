import type { Address, Hash, Hex, PublicClient, WalletClient } from 'viem'
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

  let signed: Hex
  try {
    // Wagmi's WalletClient typing may omit signTransaction; runtime supports it on most wallets.
    signed = await (
      walletClient as WalletClient
    ).signTransaction({
      ...request,
      account: address,
      chain,
    })
  } catch (signError) {
    const message =
      signError instanceof Error ? signError.message : String(signError)
    throw new Error(
      `Your wallet cannot sign transactions for Somnia EIP-7702 accounts. ` +
        `Try Rabby with experimental features, or contact support. (${message})`
    )
  }

  return publicClient.sendRawTransaction({ serializedTransaction: signed })
}
