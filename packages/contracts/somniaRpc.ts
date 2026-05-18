/**
 * Somnia Shannon testnet (50312) JSON-RPC endpoints.
 *
 * `api.infra.testnet.somnia.network` is the official URL but can time out on some
 * networks; fallbacks are public providers. Override with `SOMNIA_RPC_URL` in `.env`.
 *
 * @see https://docs.somnia.network/developer/network-info
 */
export const SOMNIA_TESTNET_RPC_URLS = [
  'https://dream-rpc.somnia.network',
  'https://somnia-json-rpc.stakely.io',
  'https://api.infra.testnet.somnia.network',
] as const

/** Primary RPC (first fallback list entry, or env override). */
export function resolveSomniaTestnetRpcUrl(): string {
  const override = process.env.SOMNIA_RPC_URL?.trim()
  if (override) return override
  return SOMNIA_TESTNET_RPC_URLS[0]
}

/** Ordered URLs for viem `fallback` transport (env override replaces the whole list). */
export function getSomniaTestnetRpcUrls(): readonly string[] {
  const override = process.env.SOMNIA_RPC_URL?.trim()
  if (override) return [override]
  return SOMNIA_TESTNET_RPC_URLS
}
