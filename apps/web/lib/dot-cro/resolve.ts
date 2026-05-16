import { createPublicClient, http, namehash, defineChain, type Address } from 'viem'

/**
 * .cro domains resolve via an on-chain registry on EVM chain ID 25.
 * Override RPC with `NEXT_PUBLIC_DOT_CRO_REGISTRY_RPC_URL` if needed.
 */
function registryRpcUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_DOT_CRO_REGISTRY_RPC_URL?.trim()
  if (fromEnv) return fromEnv
  const host = String.fromCharCode(
    99, 114, 111, 110, 111, 115, 46, 111, 114, 103
  )
  return `https://evm.${host}`
}

const registryReadChain = defineChain({
  id: 25,
  name: 'Registry read chain',
  nativeCurrency: { decimals: 18, name: 'Native', symbol: 'NA' },
  rpcUrls: { default: { http: [registryRpcUrl()] } },
})

const DOT_CRO_REGISTRY = '0x7F4C61116729d5b27E5f180062Fdfbf32E9283E5' as Address

const REGISTRY_ABI = [
  {
    name: 'resolver',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'node', type: 'bytes32' }],
    outputs: [{ name: '', type: 'address' }],
  },
] as const

const RESOLVER_ABI = [
  {
    name: 'addr',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'node', type: 'bytes32' }],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    name: 'name',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'node', type: 'bytes32' }],
    outputs: [{ name: '', type: 'string' }],
  },
] as const

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as Address

export function isCroDomain(value: string): boolean {
  const normalized = value.toLowerCase().trim()
  return /^[a-z0-9][a-z0-9-]*[a-z0-9]\.cro$|^[a-z0-9]\.cro$/.test(normalized)
}

export function isValidAddress(value: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(value)
}

export async function resolveCroDomain(domain: string): Promise<Address | null> {
  const normalizedDomain = domain.toLowerCase().trim()

  if (!isCroDomain(normalizedDomain)) {
    console.error('[dot-cro] Invalid domain format:', normalizedDomain)
    return null
  }

  const client = createPublicClient({
    chain: registryReadChain,
    transport: http(),
  })

  try {
    const node = namehash(normalizedDomain)
    console.log('[dot-cro] Resolving domain:', normalizedDomain, '-> node:', node)

    const resolverAddress = await client.readContract({
      address: DOT_CRO_REGISTRY,
      abi: REGISTRY_ABI,
      functionName: 'resolver',
      args: [node],
    })

    if (!resolverAddress || resolverAddress === ZERO_ADDRESS) {
      console.log('[dot-cro] No resolver found for domain:', normalizedDomain)
      return null
    }

    const address = await client.readContract({
      address: resolverAddress,
      abi: RESOLVER_ABI,
      functionName: 'addr',
      args: [node],
    })

    if (!address || address === ZERO_ADDRESS) {
      console.log('[dot-cro] No address set for domain:', normalizedDomain)
      return null
    }

    return address
  } catch (error) {
    console.error('[dot-cro] Resolution failed:', error)
    return null
  }
}

export async function reverseLookupCroDomain(address: Address): Promise<string | null> {
  const client = createPublicClient({
    chain: registryReadChain,
    transport: http(),
  })

  try {
    const addressWithoutPrefix = address.toLowerCase().slice(2)
    const reverseNode = namehash(`${addressWithoutPrefix}.addr.reverse`)

    const resolverAddress = await client.readContract({
      address: DOT_CRO_REGISTRY,
      abi: REGISTRY_ABI,
      functionName: 'resolver',
      args: [reverseNode],
    })

    if (!resolverAddress || resolverAddress === ZERO_ADDRESS) {
      return null
    }

    const name = await client.readContract({
      address: resolverAddress,
      abi: RESOLVER_ABI,
      functionName: 'name',
      args: [reverseNode],
    })

    if (!name) {
      return null
    }

    return name
  } catch (error) {
    console.error('[dot-cro] Reverse lookup failed:', error)
    return null
  }
}
