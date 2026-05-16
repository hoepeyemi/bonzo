// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {
    IAgentRequester,
    IAgentRequesterHandler,
    Response,
    ResponseStatus,
    Request,
    ConsensusType
} from "../interfaces/somnia/ISomniaAgents.sol";

/// @dev Test double for the SomniaAgents platform contract.
contract MockSomniaAgents is IAgentRequester {
    uint256 public requestDeposit = 0.01 ether;
    uint256 private _nextRequestId = 1;

    struct PendingFulfillment {
        address callbackAddress;
        bytes4 callbackSelector;
        bool exists;
    }

    mapping(uint256 => PendingFulfillment) private _pending;

    function setRequestDeposit(uint256 deposit) external {
        requestDeposit = deposit;
    }

    function createRequest(
        uint256 agentId,
        address callbackAddress,
        bytes4 callbackSelector,
        bytes calldata payload
    ) external payable returns (uint256 requestId) {
        requestId = _nextRequestId++;
        _pending[requestId] = PendingFulfillment({
            callbackAddress: callbackAddress,
            callbackSelector: callbackSelector,
            exists: true
        });
        (agentId, payload);
    }

    /// @notice Simulate async validator consensus (call after the consumer marks the request pending).
    function fulfillRequest(uint256 requestId) external {
        PendingFulfillment memory pending = _pending[requestId];
        require(pending.exists, "no request");

        delete _pending[requestId];

        bytes memory result = abi.encode(uint256(42));
        Response[] memory responses = new Response[](1);
        responses[0] = Response({
            validator: address(0xBEEF),
            result: result,
            status: ResponseStatus.Success,
            receipt: 0,
            timestamp: block.timestamp,
            executionCost: 0
        });

        (bool ok,) = pending.callbackAddress.call(
            abi.encodeWithSelector(
                pending.callbackSelector,
                requestId,
                responses,
                ResponseStatus.Success,
                Request({
                id: requestId,
                requester: address(this),
                callbackAddress: pending.callbackAddress,
                callbackSelector: pending.callbackSelector,
                subcommittee: new address[](0),
                responses: responses,
                responseCount: 1,
                failureCount: 0,
                threshold: 1,
                createdAt: block.timestamp,
                deadline: block.timestamp + 1 hours,
                status: ResponseStatus.Success,
                consensusType: ConsensusType.Majority,
                remainingBudget: 0,
                perAgentBudget: 0
            })
            )
        );
        require(ok, "callback failed");
    }

    function createAdvancedRequest(
        uint256,
        address,
        bytes4,
        bytes calldata,
        uint256,
        uint256,
        ConsensusType,
        uint256
    ) external payable returns (uint256) {
        revert("not implemented");
    }

    function getRequest(uint256) external pure returns (Request memory) {
        revert("not implemented");
    }

    function hasRequest(uint256) external pure returns (bool) {
        return true;
    }

    function getRequestDeposit() external view returns (uint256) {
        return requestDeposit;
    }

    function getAdvancedRequestDeposit(uint256) external view returns (uint256) {
        return requestDeposit;
    }
}
