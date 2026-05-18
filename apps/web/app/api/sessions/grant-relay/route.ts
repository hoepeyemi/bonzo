import { NextResponse, type NextRequest } from 'next/server'
import {
  createPublicClient,
  createWalletClient,
  decodeEventLog,
  encodeFunctionData,
  hashTypedData,
  recoverMessageAddress,
  keccak256,
  toBytes,
  http,
  type Address,
  type Hex,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { agentDelegatorAbi } from '@x402/contracts'
import { somniaTestnet } from '@/config/somnia-chain'
import { toContractArgs } from '@/lib/sessionKeys/flattenScopes'
import { buildGrantSessionTypedData } from '@/lib/sessionKeys/grantSessionEip712'
import type { OnChainParams } from '@/lib/sessionKeys/types'

/**
 * POST /api/sessions/grant-relay
 *
 * Submits grantSessionWithSignature to the owner's EIP-7702 account.
 * Owner must have signed EIP-712 typed data (wallet signTypedData).
 */
export async function POST(request: NextRequest) {
  try {
    const relayerKey = process.env.FACILITATOR_RELAYER_KEY
    if (!relayerKey) {
      return NextResponse.json(
        { error: 'FACILITATOR_RELAYER_KEY not configured' },
        { status: 500 }
      )
    }

    const body = await request.json()
    const ownerAddress = body.ownerAddress as Address | undefined
    const sessionKeyAddress = body.sessionKeyAddress as Address | undefined
    const onChainParams = body.onChainParams as OnChainParams | undefined
    const signature = body.signature as Hex | undefined
    const validAfter = Number(body.validAfter)
    const validUntil = Number(body.validUntil)

    if (!ownerAddress || !sessionKeyAddress || !onChainParams || !signature) {
      return NextResponse.json(
        { error: 'ownerAddress, sessionKeyAddress, onChainParams, and signature are required' },
        { status: 400 }
      )
    }

    const contractArgs = toContractArgs(onChainParams)
    const calldata = encodeFunctionData({
      abi: agentDelegatorAbi,
      functionName: 'grantSessionWithSignature',
      args: [
        sessionKeyAddress,
        contractArgs.allowedTargets,
        contractArgs.allowedSelectors,
        validAfter,
        validUntil,
        contractArgs.approvedContracts,
        signature,
      ],
    })

    const rpcUrl = somniaTestnet.rpcUrls.default.http[0]
    const account = privateKeyToAccount(
      (relayerKey.startsWith('0x') ? relayerKey : `0x${relayerKey}`) as Hex
    )
    const publicClient = createPublicClient({
      chain: somniaTestnet,
      transport: http(rpcUrl),
    })
    const walletClient = createWalletClient({
      account,
      chain: somniaTestnet,
      transport: http(rpcUrl),
    })

    // Debug: verify signature recovery before sending
    const typedData = buildGrantSessionTypedData({
      ownerAddress,
      chainId: somniaTestnet.id,
      sessionKey: sessionKeyAddress,
      onChain: onChainParams,
      validAfter,
      validUntil,
      sessionNonce: BigInt(body.sessionNonce),
    })
    
    const eip712Hash = hashTypedData(typedData)
    
    // Try recovery with Ethereum message prefix (what personal_sign uses)
    const prefixedMessage = keccak256(
      new Uint8Array([
        ...toBytes('\x19Ethereum Signed Message:\n32'),
        ...toBytes(eip712Hash),
      ])
    )
    
    const recovered = await recoverMessageAddress({
      message: { raw: eip712Hash },
      signature,
    })
    
    console.log('[grant-relay] Signature verification:')
    console.log('  Expected signer:', ownerAddress)
    console.log('  Recovered (raw):', recovered)
    console.log('  EIP-712 hash:', eip712Hash)
    console.log('  Signature:', signature)
    
    if (recovered.toLowerCase() !== ownerAddress.toLowerCase()) {
      return NextResponse.json(
        {
          error: `Signature verification failed. Expected ${ownerAddress}, recovered ${recovered}`,
        },
        { status: 400 }
      )
    }

    const hash = await walletClient.sendTransaction({
      account,
      chain: somniaTestnet,
      to: ownerAddress,
      data: calldata,
    })

    const receipt = await publicClient.waitForTransactionReceipt({ hash })
    if (receipt.status !== 'success') {
      return NextResponse.json(
        { error: 'grantSessionWithSignature transaction reverted' },
        { status: 500 }
      )
    }

    let sessionId: Hex | null = null
    for (const log of receipt.logs) {
      try {
        const decoded = decodeEventLog({
          abi: agentDelegatorAbi,
          data: log.data,
          topics: log.topics,
        })
        if (decoded.eventName === 'SessionGranted') {
          sessionId = (decoded.args as { sessionId: Hex }).sessionId
          break
        }
      } catch {
        // skip
      }
    }

    if (!sessionId) {
      return NextResponse.json(
        {
          error:
            'SessionGranted event not found. Ensure AgentDelegator is redeployed with grantSessionWithSignature.',
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      sessionId,
      txHash: hash,
    })
  } catch (error) {
    console.error('[sessions/grant-relay]', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
