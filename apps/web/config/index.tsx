import { cookieStorage, createStorage } from '@wagmi/core'
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi'
import { mainnet, sepolia } from '@reown/appkit/networks'
import { somniaTestnet } from '@/config/somnia-chain'

// Get project ID from environment
export const projectId = process.env.NEXT_PUBLIC_REOWN_PROJECT_ID

if (!projectId) {
  console.warn('NEXT_PUBLIC_REOWN_PROJECT_ID is not set. Get one at https://cloud.reown.com/')
}

// Networks: Somnia Shannon testnet + common L1s for SIWX
export const networks = [somniaTestnet, mainnet, sepolia]

// Create wagmi adapter
export const wagmiAdapter = new WagmiAdapter({
  storage: createStorage({
    storage: cookieStorage,
  }),
  ssr: true,
  projectId: projectId ?? '',
  networks,
})

// Export wagmi config for use in providers
export const config = wagmiAdapter.wagmiConfig
