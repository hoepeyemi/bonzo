// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @notice AgentFabric bridge surface for session keys and AgentDelegator forwarding.
interface IAgentFabricSomniaBridge {
    function quoteJsonApiDeposit() external view returns (uint256);

    function requestJsonApiUint(
        string calldata url,
        string calldata jsonSelector,
        uint8 decimals
    ) external payable returns (uint256 requestId);

    function requestLabeledFetch(
        bytes32 label,
        string calldata url,
        string calldata jsonSelector,
        uint8 decimals
    ) external payable returns (uint256 requestId);

    function requestAgent(
        uint256 agentId,
        bytes calldata payload,
        bytes4 responseHandler,
        uint256 executionRewardPerAgent
    ) external payable returns (uint256 requestId);
}
