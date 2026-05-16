// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title SomniaAgents platform contract addresses
/// @notice https://metaversal.gitbook.io/agents/s8KLL5NzoS6LwJVIQCiT/invoking-agents/quickstart
library SomniaAgentsPlatform {
    /// Somnia mainnet (chain ID 5031)
    address internal constant MAINNET = 0x5E5205CF39E766118C01636bED000A54D93163E6;

    /// Somnia Shannon testnet (chain ID 50312)
    address internal constant TESTNET = 0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776;

    function forChainId(uint256 chainId) internal pure returns (address platform) {
        if (chainId == 5031) return MAINNET;
        if (chainId == 50312) return TESTNET;
        revert("SomniaAgents: unsupported chain");
    }
}
