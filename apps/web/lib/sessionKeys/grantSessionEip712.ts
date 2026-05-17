import {
  encodeAbiParameters,
  encodePacked,
  keccak256,
  toBytes,
  type Address,
  type Hex,
} from 'viem'
import type { OnChainParams } from './types'

const DOMAIN_NAME = 'AgentDelegator'
const DOMAIN_VERSION = '1'

export const GRANT_SESSION_TYPES = {
  GrantSession: [
    { name: 'sessionKey', type: 'address' },
    { name: 'targetsHash', type: 'bytes32' },
    { name: 'selectorsHash', type: 'bytes32' },
    { name: 'validAfter', type: 'uint48' },
    { name: 'validUntil', type: 'uint48' },
    { name: 'contractsHash', type: 'bytes32' },
    { name: 'nonce', type: 'uint256' },
  ],
} as const

function hashAddressArray(targets: readonly Address[]): Hex {
  return keccak256(encodePacked(['address[]'], [targets]))
}

function hashSelectorArray(selectors: readonly Hex[]): Hex {
  return keccak256(encodePacked(['bytes4[]'], [selectors]))
}

function hashApprovedContracts(
  contracts: OnChainParams['approvedContracts']
): Hex {
  const tuples = contracts.map((c) => ({
    contractAddress: c.address,
    nameHash: keccak256(toBytes(c.domainName ?? '')),
    versionHash: keccak256(toBytes(c.domainVersion ?? '')),
  }))
  return keccak256(
    encodeAbiParameters(
      [
        {
          type: 'tuple[]',
          components: [
            { name: 'contractAddress', type: 'address' },
            { name: 'nameHash', type: 'bytes32' },
            { name: 'versionHash', type: 'bytes32' },
          ],
        },
      ],
      [tuples]
    )
  )
}

export function buildGrantSessionTypedData(params: {
  ownerAddress: Address
  chainId: number
  sessionKey: Address
  onChain: OnChainParams
  validAfter: number
  validUntil: number
  sessionNonce: bigint
}) {
  const targetsHash = hashAddressArray(params.onChain.allowedTargets)
  const selectorsHash = hashSelectorArray(params.onChain.allowedSelectors)
  const contractsHash = hashApprovedContracts(params.onChain.approvedContracts)

  return {
    domain: {
      name: DOMAIN_NAME,
      version: DOMAIN_VERSION,
      chainId: params.chainId,
      verifyingContract: params.ownerAddress,
    },
    types: GRANT_SESSION_TYPES,
    primaryType: 'GrantSession' as const,
    message: {
      sessionKey: params.sessionKey,
      targetsHash,
      selectorsHash,
      validAfter: params.validAfter,
      validUntil: params.validUntil,
      contractsHash,
      nonce: params.sessionNonce,
    },
  }
}
