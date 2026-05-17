import type { Address, Hex } from 'viem'
import type { OnChainParams } from './types'

export interface GrantSessionRelayRequest {
  ownerAddress: Address
  sessionKeyAddress: Address
  onChainParams: OnChainParams
  validAfter: number
  validUntil: number
  sessionNonce: string
  signature: Hex
}

export interface GrantSessionRelayResponse {
  success: boolean
  sessionId: string
  txHash: string
}

export async function relayGrantSessionWithSignature(
  body: GrantSessionRelayRequest
): Promise<GrantSessionRelayResponse> {
  const res = await fetch('/api/sessions/grant-relay', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok) {
    throw new Error(data.error ?? 'Failed to relay grant session')
  }
  return data as GrantSessionRelayResponse
}
