import type { Hex } from 'viem'
import { toFunctionSelector } from 'viem'

/**
 * Selectors for BonzoSomniaBridge — use in session execute scopes.
 */
export const SOMNIA_BRIDGE_SELECTORS = {
  requestLabeledFetch: toFunctionSelector(
    'requestLabeledFetch(bytes32,string,string,uint8)'
  ) as Hex,
  requestJsonApiUint: toFunctionSelector(
    'requestJsonApiUint(string,string,uint8)'
  ) as Hex,
  quoteJsonApiDeposit: toFunctionSelector('quoteJsonApiDeposit()') as Hex,
  requestAgent: toFunctionSelector(
    'requestAgent(uint256,bytes,bytes4,uint256)'
  ) as Hex,
} as const

/** AgentDelegator Somnia integration selectors */
export const AGENT_DELEGATOR_SOMNIA_SELECTORS = {
  invokeSomniaLabeledFetch: toFunctionSelector(
    'invokeSomniaLabeledFetch(bytes32,string,string,uint8)'
  ) as Hex,
  grantSessionWithSomniaBridge: toFunctionSelector(
    'grantSessionWithSomniaBridge(address,address[],bytes4[],uint48,uint48,(address,bytes32,bytes32)[])'
  ) as Hex,
  setSomniaAgentBridge: toFunctionSelector('setSomniaAgentBridge(address)') as Hex,
} as const
