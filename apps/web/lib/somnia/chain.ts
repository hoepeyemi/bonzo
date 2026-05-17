import { createPublicClient, createWalletClient, http, type Hex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { somniaTestnet } from '@/config/somnia-chain'

const rpcUrl = somniaTestnet.rpcUrls.default.http[0]

export function createSomniaPublicClient() {
  return createPublicClient({
    chain: somniaTestnet,
    transport: http(rpcUrl),
  })
}

export function createSomniaWalletFromKey(privateKey: Hex) {
  const account = privateKeyToAccount(privateKey)
  const transport = http(rpcUrl)
  return {
    account,
    walletClient: createWalletClient({ account, chain: somniaTestnet, transport }),
    publicClient: createPublicClient({ chain: somniaTestnet, transport }),
  }
}
