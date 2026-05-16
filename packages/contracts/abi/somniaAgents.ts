/**
 * Somnia Agents integration ABIs.
 * Regenerate from hardhat artifacts after contract changes.
 */

export const somniaAgentsPlatformAbi = [
  {
    type: 'function',
    name: 'getRequestDeposit',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'getAdvancedRequestDeposit',
    stateMutability: 'view',
    inputs: [{ name: 'subcommitteeSize', type: 'uint256' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'createRequest',
    stateMutability: 'payable',
    inputs: [
      { name: 'agentId', type: 'uint256' },
      { name: 'callbackAddress', type: 'address' },
      { name: 'callbackSelector', type: 'bytes4' },
      { name: 'payload', type: 'bytes' },
    ],
    outputs: [{ type: 'uint256' }],
  },
] as const

export const somniaAgentBridgeAbi = [
  {
    type: 'function',
    name: 'quoteJsonApiDeposit',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'quoteAgentDeposit',
    stateMutability: 'view',
    inputs: [
      { name: 'agentId', type: 'uint256' },
      { name: 'executionRewardPerAgent', type: 'uint256' },
    ],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'requestJsonApiUint',
    stateMutability: 'payable',
    inputs: [
      { name: 'url', type: 'string' },
      { name: 'jsonSelector', type: 'string' },
      { name: 'decimals', type: 'uint8' },
    ],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'requestLabeledFetch',
    stateMutability: 'payable',
    inputs: [
      { name: 'label', type: 'bytes32' },
      { name: 'url', type: 'string' },
      { name: 'jsonSelector', type: 'string' },
      { name: 'decimals', type: 'uint8' },
    ],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'requestAgent',
    stateMutability: 'payable',
    inputs: [
      { name: 'agentId', type: 'uint256' },
      { name: 'payload', type: 'bytes' },
      { name: 'responseHandler', type: 'bytes4' },
      { name: 'executionRewardPerAgent', type: 'uint256' },
    ],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'requestAgentAdvanced',
    stateMutability: 'payable',
    inputs: [
      { name: 'agentId', type: 'uint256' },
      { name: 'payload', type: 'bytes' },
      { name: 'responseHandler', type: 'bytes4' },
      { name: 'customSubcommitteeSize', type: 'uint256' },
      { name: 'threshold', type: 'uint256' },
      { name: 'consensusType', type: 'uint8' },
      { name: 'timeout', type: 'uint256' },
      { name: 'executionRewardPerAgent', type: 'uint256' },
    ],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'setJsonApiRewardPerAgent',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'rewardPerAgent', type: 'uint256' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'uintResults',
    stateMutability: 'view',
    inputs: [{ name: 'requestId', type: 'uint256' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'stringResults',
    stateMutability: 'view',
    inputs: [{ name: 'requestId', type: 'uint256' }],
    outputs: [{ type: 'string' }],
  },
  {
    type: 'function',
    name: 'bytesResults',
    stateMutability: 'view',
    inputs: [{ name: 'requestId', type: 'uint256' }],
    outputs: [{ type: 'bytes' }],
  },
  {
    type: 'function',
    name: 'latestByLabel',
    stateMutability: 'view',
    inputs: [{ name: 'label', type: 'bytes32' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'isPending',
    stateMutability: 'view',
    inputs: [{ name: 'requestId', type: 'uint256' }],
    outputs: [{ type: 'bool' }],
  },
  {
    type: 'function',
    name: 'handleUintResponse',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'requestId', type: 'uint256' },
      {
        name: 'responses',
        type: 'tuple[]',
        components: [
          { name: 'validator', type: 'address' },
          { name: 'result', type: 'bytes' },
          { name: 'status', type: 'uint8' },
          { name: 'receipt', type: 'uint256' },
          { name: 'timestamp', type: 'uint256' },
          { name: 'executionCost', type: 'uint256' },
        ],
      },
      { name: 'status', type: 'uint8' },
      { name: 'details', type: 'bytes' },
    ],
    outputs: [],
  },
  {
    type: 'event',
    name: 'LabeledFetchCompleted',
    inputs: [
      { name: 'label', type: 'bytes32', indexed: true },
      { name: 'requestId', type: 'uint256', indexed: true },
      { name: 'value', type: 'uint256', indexed: false },
    ],
  },
] as const

export const agentDelegatorSomniaAbi = [
  {
    type: 'function',
    name: 'setSomniaAgentBridge',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'bridge', type: 'address' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'getSomniaAgentBridge',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'grantSessionWithSomniaBridge',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'sessionKey', type: 'address' },
      { name: 'allowedTargets', type: 'address[]' },
      { name: 'allowedSelectors', type: 'bytes4[]' },
      { name: 'validAfter', type: 'uint48' },
      { name: 'validUntil', type: 'uint48' },
      {
        name: 'approvedContracts',
        type: 'tuple[]',
        components: [
          { name: 'contractAddress', type: 'address' },
          { name: 'nameHash', type: 'bytes32' },
          { name: 'versionHash', type: 'bytes32' },
        ],
      },
    ],
    outputs: [{ type: 'bytes32' }],
  },
  {
    type: 'function',
    name: 'invokeSomniaLabeledFetch',
    stateMutability: 'payable',
    inputs: [
      { name: 'label', type: 'bytes32' },
      { name: 'url', type: 'string' },
      { name: 'jsonSelector', type: 'string' },
      { name: 'decimals', type: 'uint8' },
    ],
    outputs: [{ type: 'uint256' }],
  },
] as const
