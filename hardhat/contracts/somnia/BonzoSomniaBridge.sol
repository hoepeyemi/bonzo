// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {SomniaAgentConsumer} from "./SomniaAgentConsumer.sol";
import {SomniaAgentsPlatform} from "./SomniaAgentsPlatform.sol";
import {Response, ResponseStatus, Request} from "../interfaces/somnia/ISomniaAgents.sol";

/// @title Bonzo Somnia Agents bridge
/// @notice On-chain entrypoint for workflows; configurable rewards; typed agent callbacks.
contract BonzoSomniaBridge is SomniaAgentConsumer {
    address public owner;

    mapping(uint256 => bytes32) private _requestLabels;

    mapping(bytes32 => uint256) public latestByLabel;
    mapping(bytes32 => uint256) public latestRequestIdByLabel;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event LabeledFetchRequested(bytes32 indexed label, uint256 indexed requestId, string url);
    event LabeledFetchCompleted(bytes32 indexed label, uint256 indexed requestId, uint256 value);

    error NotOwner();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(
        uint256 jsonApiAgentId_,
        uint256 jsonApiRewardPerAgent_,
        uint256 subcommitteeSize_
    )
        SomniaAgentConsumer(
            SomniaAgentsPlatform.forChainId(block.chainid),
            jsonApiAgentId_,
            jsonApiRewardPerAgent_,
            subcommitteeSize_
        )
    {
        owner = msg.sender;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "owner=0");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    function _isBonzoBridge(address caller) internal view override returns (bool) {
        return caller == owner;
    }

    function requestLabeledFetch(
        bytes32 label,
        string calldata url,
        string calldata jsonSelector,
        uint8 decimals
    ) external payable returns (uint256 requestId) {
        requestId = this.requestJsonApiUint{value: msg.value}(url, jsonSelector, decimals);
        _requestLabels[requestId] = label;
        emit LabeledFetchRequested(label, requestId, url);
    }

    function handleUintResponse(
        uint256 requestId,
        Response[] memory responses,
        ResponseStatus status,
        Request memory
    ) external override(SomniaAgentConsumer) {
        bytes32 label = _requestLabels[requestId];
        _finalizeResponse(requestId, responses, status, AgentResponseKind.Uint);

        if (label == bytes32(0)) return;
        delete _requestLabels[requestId];

        if (status != ResponseStatus.Success) return;

        uint256 value = uintResults[requestId];
        latestByLabel[label] = value;
        latestRequestIdByLabel[label] = requestId;
        emit LabeledFetchCompleted(label, requestId, value);
    }
}
