import { defineChain } from 'viem'

/**
 * Somnia Shannon testnet — https://docs.somnia.network/developer/network-info.md
 */
export const somniaTestnet = defineChain({
  id: 50312,
  name: 'Somnia Testnet',
  network: 'somnia-testnet',
  nativeCurrency: { name: 'Somnia Test Token', symbol: 'STT', decimals: 18 },
  rpcUrls: {
    default: {
      http: [
        'https://dream-rpc.somnia.network',
        'https://somnia-json-rpc.stakely.io',
        'https://api.infra.testnet.somnia.network',
      ],
      webSocket: ['wss://api.infra.testnet.somnia.network/ws'],
    },
    public: {
      http: [
        'https://dream-rpc.somnia.network',
        'https://somnia-json-rpc.stakely.io',
        'https://api.infra.testnet.somnia.network',
      ],
      webSocket: ['wss://api.infra.testnet.somnia.network/ws'],
    },
  },
  blockExplorers: {
    default: {
      name: 'Somnia Shannon Explorer',
      url: 'https://shannon-explorer.somnia.network',
    },
  },
})
