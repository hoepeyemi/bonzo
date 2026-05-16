// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @notice JSON API agent method surface (agent ID from Agent Explorer).
/// @dev https://agents.testnet.somnia.network
interface IJsonApiAgent {
    function fetchUint(string calldata url, string calldata selector, uint8 decimals)
        external
        returns (uint256);
}
