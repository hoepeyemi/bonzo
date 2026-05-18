'use client'

import { useState, useCallback, useMemo } from 'react'
import { useWalletClient, usePublicClient, useConnection, useSignTypedData } from 'wagmi'
import { decodeEventLog, encodeFunctionData, hashTypedData, type Address, type Hash, type Hex } from 'viem'
import { agentDelegatorAbi } from '@x402/contracts'
import { generateSessionKey } from '@/lib/sessionKeys'
import {
  sendDelegatedSelfTransaction,
  isUnsupportedSigningError,
} from '@/lib/smartAccount/sendDelegatedSelfTransaction'
import { buildGrantSessionTypedData } from '@/lib/sessionKeys/grantSessionEip712'
import { relayGrantSessionWithSignature } from '@/lib/sessionKeys/grantSessionRelay'
import type { SessionScope } from '@/lib/sessionKeys/types'
import { serializeScope } from '@/lib/sessionKeys/types'
import { flattenScopesToOnChainParams, toContractArgs } from '@/lib/sessionKeys/flattenScopes'
import { getDefaultGrantScopes } from '@/lib/sessionKeys/scopeTemplates'

export interface ApprovedContract {
  address: `0x${string}`
  name?: string
}

export interface GrantSessionParams {
  validityDays: number
  scopes?: SessionScope[]
  approvedContracts?: ApprovedContract[]
}

export type GrantSessionStatus =
  | 'idle'
  | 'generating'
  | 'signing'
  | 'confirming'
  | 'saving'
  | 'success'
  | 'error'

export interface UseGrantSessionReturn {
  status: GrantSessionStatus
  error: string | null
  sessionId: string | null
  grantSession: (params: GrantSessionParams) => Promise<string>
  reset: () => void
  isLoading: boolean
}

function parseSessionGrantedFromReceipt(
  logs: { data: Hex; topics: readonly Hex[] }[]
): Hex | null {
  for (const log of logs) {
    try {
      const decoded = decodeEventLog({
        abi: agentDelegatorAbi,
        data: log.data,
        topics: [...log.topics] as [signature: Hex, ...args: Hex[]],
      })
      if (decoded.eventName === 'SessionGranted') {
        return (decoded.args as { sessionId: Hex }).sessionId
      }
    } catch {
      // not our event
    }
  }
  return null
}

export function useGrantSession(): UseGrantSessionReturn {
  const { address, chainId } = useConnection()
  const { data: walletClient } = useWalletClient()
  const publicClient = usePublicClient()
  const { signTypedDataAsync } = useSignTypedData()

  const [status, setStatus] = useState<GrantSessionStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)

  const grantSession = useCallback(async (params: GrantSessionParams): Promise<string> => {
    if (!walletClient || !publicClient || !address || !chainId) {
      throw new Error('Wallet not connected')
    }

    setStatus('generating')
    setError(null)
    setSessionId(null)

    try {
      const { address: sessionKeyAddress, encryptedPrivateKey } = await generateSessionKey()

      const validAfter = Math.floor(Date.now() / 1000)
      const validUntil = validAfter + params.validityDays * 24 * 60 * 60
      const scopes = params.scopes ?? getDefaultGrantScopes(chainId)
      const onChainParams = flattenScopesToOnChainParams(scopes)
      const contractArgs = toContractArgs(onChainParams)

      setStatus('signing')

      const grantCalldata = encodeFunctionData({
        abi: agentDelegatorAbi,
        functionName: 'grantSession',
        args: [
          sessionKeyAddress,
          contractArgs.allowedTargets,
          contractArgs.allowedSelectors,
          validAfter,
          validUntil,
          contractArgs.approvedContracts,
        ],
      })

      let txHash: Hash
      let newSessionId: Hex

      try {
        txHash = await sendDelegatedSelfTransaction({
          walletClient,
          publicClient,
          address: address as Address,
          data: grantCalldata,
        })
        setStatus('confirming')
        const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash })
        if (receipt.status !== 'success') {
          throw new Error('Transaction failed')
        }
        const parsed = parseSessionGrantedFromReceipt(receipt.logs)
        if (!parsed) {
          throw new Error('SessionGranted event not found in transaction logs')
        }
        newSessionId = parsed
      } catch (directError) {
        const msg =
          directError instanceof Error ? directError.message : String(directError)
        if (!isUnsupportedSigningError(msg)) {
          throw directError
        }

        // Fallback: EIP-712 + relayer (MetaMask / WalletConnect signTypedData).
        const sessionNonce = await publicClient.readContract({
          address: address as Address,
          abi: agentDelegatorAbi,
          functionName: 'getSessionNonce',
        })

        const typedData = buildGrantSessionTypedData({
          ownerAddress: address as Address,
          chainId,
          sessionKey: sessionKeyAddress,
          onChain: onChainParams,
          validAfter,
          validUntil,
          sessionNonce,
        })

        // Somnia blocks signTypedData for EIP-7702 delegated accounts
        // ("External signature requests cannot use internal accounts as the verifying contract").
        // Use signMessage with raw hash (viem signs without prefix when raw is specified).
        let signature: Hex
        if (chainId === 50312) {
          const hash = hashTypedData(typedData)
          // viem's signMessage with { raw } signs the raw bytes without Ethereum prefix
          signature = await walletClient.signMessage({
            account: address as Address,
            message: { raw: hash },
          })
        } else {
          signature = await signTypedDataAsync({
            domain: typedData.domain,
            types: typedData.types,
            primaryType: typedData.primaryType,
            message: typedData.message,
          })
        }

        setStatus('confirming')
        const relay = await relayGrantSessionWithSignature({
          ownerAddress: address as Address,
          sessionKeyAddress,
          onChainParams,
          validAfter,
          validUntil,
          sessionNonce: sessionNonce.toString(),
          signature,
        })

        txHash = relay.txHash as Hash
        newSessionId = relay.sessionId as Hex
      }

      setStatus('saving')

      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: newSessionId,
          sessionKeyAddress,
          encryptedPrivateKey,
          scopes: scopes.map(serializeScope),
          onChainParams,
          allowedTargets: contractArgs.allowedTargets,
          allowedSelectors: contractArgs.allowedSelectors,
          validAfter: new Date(validAfter * 1000).toISOString(),
          validUntil: new Date(validUntil * 1000).toISOString(),
          approvedContracts: onChainParams.approvedContracts,
        }),
      })

      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || 'Failed to save session to server')
      }

      setSessionId(newSessionId)
      setStatus('success')
      return newSessionId
    } catch (err) {
      console.error('[grantSession] Failed:', err)
      const message = err instanceof Error ? err.message : 'Failed to grant session'
      const hint = message.includes('grantSessionWithSignature')
        ? message
        : `${message}. On Somnia, re-enable EIP-7702 to the latest AgentDelegator (0xd19…1DA9) if you delegated to an older implementation.`
      setError(hint)
      setStatus('error')
      throw err
    }
  }, [walletClient, publicClient, address, chainId, signTypedDataAsync])

  const reset = useCallback(() => {
    setStatus('idle')
    setError(null)
    setSessionId(null)
  }, [])

  return useMemo(
    () => ({
      status,
      error,
      sessionId,
      grantSession,
      reset,
      isLoading: ['generating', 'signing', 'confirming', 'saving'].includes(status),
    }),
    [status, error, sessionId, grantSession, reset]
  )
}
