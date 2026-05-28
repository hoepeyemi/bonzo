// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IAgentRequester, IAgentRequesterHandler, Response, ResponseStatus, Request, ConsensusType} from "../interfaces/somnia/ISomniaAgents.sol";
import {IJsonApiAgent} from "../interfaces/somnia/IJsonApiAgent.sol";

/// @title Somnia Agent consumer for Bonzo
/// @notice Invokes Somnia Agents via the platform contract and handles async callbacks.
/// @dev https://metaversal.gitbook.io/agents/s8KLL5NzoS6LwJVIQCiT/invoking-agents/from-solidity
contract SomniaAgentConsumer is IAgentRequesterHandler {
    IAgentRequester public immutable platform;

    /// @notice Agent ID for IJsonApiAgent (from Agent Explorer).
    uint256 public immutable jsonApiAgentId;

    /// @notice Per-agent execution reward for JSON API fetches (configurable at deploy).
    uint256 public jsonApiRewardPerAgent;

    /// @notice Subcommittee size used for deposit quotes (default platform size is 3).
    uint256 public subcommitteeSize;

    enum AgentResponseKind {
        Uint,
        String,
        Bytes
    }

    struct RequestMeta {
        address initiator;
        AgentResponseKind kind;
    }

    mapping(uint256 => bool) private _pendingRequests;
    mapping(uint256 => RequestMeta) private _requestMeta;

    mapping(uint256 => uint256) public uintResults;
    mapping(uint256 => string) public stringResults;
    mapping(uint256 => bytes) public bytesResults;

    /// @notice Per-agent execution reward override (agentId => wei per validator).
    mapping(uint256 => uint256) public agentRewardPerAgent;

    event JsonApiRequested(uint256 indexed requestId, address indexed initiator, string url, string selector);
    event AgentUintCompleted(uint256 indexed requestId, uint256 value, ResponseStatus status);
    event AgentStringCompleted(uint256 indexed requestId, string value, ResponseStatus status);
    event AgentBytesCompleted(uint256 indexed requestId, bytes value, ResponseStatus status);
    event AgentRequestFailed(uint256 indexed requestId, ResponseStatus status);
    event JsonApiRewardUpdated(uint256 oldReward, uint256 newReward);
    event SubcommitteeSizeUpdated(uint256 oldSize, uint256 newSize);
    event AgentRewardUpdated(uint256 indexed agentId, uint256 rewardPerAgent);

    error OnlyPlatform();
    error UnknownRequest();
    error InsufficientDeposit(uint256 required, uint256 provided);
    error InvalidResponseHandler();

    constructor(
        address platform_,
        uint256 jsonApiAgentId_,
        uint256 jsonApiRewardPerAgent_,
        uint256 subcommitteeSize_
    ) {
        require(platform_ != address(0), "platform=0");
        platform = IAgentRequester(platform_);
        jsonApiAgentId = jsonApiAgentId_;
        jsonApiRewardPerAgent = jsonApiRewardPerAgent_ == 0 ? 0.03 ether : jsonApiRewardPerAgent_;
        subcommitteeSize = subcommitteeSize_ == 0 ? 3 : subcommitteeSize_;
    }

    /// @notice Update JSON API per-validator reward (owner: BonzoSomniaBridge / deployer).
    function setJsonApiRewardPerAgent(uint256 rewardPerAgent) external virtual {
        _requireBridgeOwner();
        emit JsonApiRewardUpdated(jsonApiRewardPerAgent, rewardPerAgent);
        jsonApiRewardPerAgent = rewardPerAgent;
    }

    function setSubcommitteeSize(uint256 newSize) external virtual {
        _requireBridgeOwner();
        require(newSize > 0, "size=0");
        emit SubcommitteeSizeUpdated(subcommitteeSize, newSize);
        subcommitteeSize = newSize;
    }

    function setAgentRewardPerAgent(uint256 agentId, uint256 rewardPerAgent) external virtual {
        _requireBridgeOwner();
        agentRewardPerAgent[agentId] = rewardPerAgent;
        emit AgentRewardUpdated(agentId, rewardPerAgent);
    }

    function _requireBridgeOwner() internal view {
        // Allow the bridge child contract or direct consumer owner pattern via self-call from bridge.
        require(msg.sender == address(this) || _isBonzoBridge(msg.sender), "not owner");
    }

    function _isBonzoBridge(address) internal view virtual returns (bool) {
        return false;
    }

    // ---- Typed callbacks (Somnia multiple-callback pattern) ----

    function handleUintResponse(
        uint256 requestId,
        Response[] memory responses,
        ResponseStatus status,
        Request memory
    ) external virtual {
        _finalizeResponse(requestId, responses, status, AgentResponseKind.Uint);
    }

    function handleStringResponse(
        uint256 requestId,
        Response[] memory responses,
        ResponseStatus status,
        Request memory
    ) external virtual {
        _finalizeResponse(requestId, responses, status, AgentResponseKind.String);
    }

    function handleBytesResponse(
        uint256 requestId,
        Response[] memory responses,
        ResponseStatus status,
        Request memory
    ) external virtual {
        _finalizeResponse(requestId, responses, status, AgentResponseKind.Bytes);
    }

    /// @inheritdoc IAgentRequesterHandler
    /// @dev Legacy entry; decodes uint256 (same as handleUintResponse).
    function handleResponse(
        uint256 requestId,
        Response[] memory responses,
        ResponseStatus status,
        Request memory
    ) external virtual {
        _finalizeResponse(requestId, responses, status, AgentResponseKind.Uint);
    }

    function _finalizeResponse(
        uint256 requestId,
        Response[] memory responses,
        ResponseStatus status,
        AgentResponseKind expectedKind
    ) internal {
        if (msg.sender != address(platform)) revert OnlyPlatform();
        if (!_pendingRequests[requestId]) revert UnknownRequest();

        RequestMeta memory meta = _requestMeta[requestId];
        if (AgentResponseKind(meta.kind) != expectedKind) revert InvalidResponseHandler();

        delete _pendingRequests[requestId];
        delete _requestMeta[requestId];

        if (status == ResponseStatus.Success && responses.length > 0) {
            if (expectedKind == AgentResponseKind.Uint) {
                uint256 value = abi.decode(responses[0].result, (uint256));
                uintResults[requestId] = value;
                emit AgentUintCompleted(requestId, value, status);
                return;
            }
            if (expectedKind == AgentResponseKind.String) {
                string memory value = abi.decode(responses[0].result, (string));
                stringResults[requestId] = value;
                emit AgentStringCompleted(requestId, value, status);
                return;
            }
            bytesResults[requestId] = responses[0].result;
            emit AgentBytesCompleted(requestId, responses[0].result, status);
            return;
        }

        emit AgentRequestFailed(requestId, status);
    }

    /// @notice Required deposit for a JSON API `fetchUint` request.
    function quoteJsonApiDeposit() public view returns (uint256) {
        return _quoteDeposit(jsonApiRewardPerAgent);
    }

    /// @notice Quote deposit for an arbitrary agent invocation.
    function quoteAgentDeposit(uint256 agentId, uint256 executionRewardPerAgent) public view returns (uint256) {
        uint256 reward = executionRewardPerAgent;
        if (reward == 0) {
            reward = agentRewardPerAgent[agentId];
        }
        if (reward == 0) {
            reward = jsonApiRewardPerAgent;
        }
        return _quoteDeposit(reward);
    }

    function _quoteDeposit(uint256 rewardPerAgent) internal view returns (uint256) {
        return platform.getRequestDeposit() + (rewardPerAgent * subcommitteeSize);
    }

    function requestJsonApiUint(
        string calldata url,
        string calldata jsonSelector,
        uint8 decimals
    ) public payable returns (uint256 requestId) {
        bytes memory payload = abi.encodeWithSelector(
            IJsonApiAgent.fetchUint.selector,
            url,
            jsonSelector,
            decimals
        );

        uint256 requiredDeposit = quoteJsonApiDeposit();
        if (msg.value < requiredDeposit) {
            revert InsufficientDeposit(requiredDeposit, msg.value);
        }

        requestId = platform.createRequest{value: msg.value}(
            jsonApiAgentId,
            address(this),
            this.handleUintResponse.selector,
            payload
        );

        _registerRequest(requestId, AgentResponseKind.Uint);
        emit JsonApiRequested(requestId, msg.sender, url, jsonSelector);
    }

    /// @notice Invoke any Somnia agent with an explicit typed callback selector.
    /// @param responseHandler Must be handleUintResponse, handleStringResponse, or handleBytesResponse.
    /// @param executionRewardPerAgent Per-validator reward; 0 uses agentRewardPerAgent mapping or jsonApi default.
    function requestAgent(
        uint256 agentId,
        bytes calldata payload,
        bytes4 responseHandler,
        uint256 executionRewardPerAgent
    ) public payable returns (uint256 requestId) {
        AgentResponseKind kind = _kindForHandler(responseHandler);
        uint256 requiredDeposit = quoteAgentDeposit(agentId, executionRewardPerAgent);

        return _createRequest(agentId, payload, responseHandler, kind, requiredDeposit);
    }

    /// @notice Advanced request with custom subcommittee (uses platform getAdvancedRequestDeposit).
    function requestAgentAdvanced(
        uint256 agentId,
        bytes calldata payload,
        bytes4 responseHandler,
        uint256 customSubcommitteeSize,
        uint256 threshold,
        ConsensusType consensusType,
        uint256 timeout,
        uint256 executionRewardPerAgent
    ) external payable returns (uint256 requestId) {
        AgentResponseKind kind = _kindForHandler(responseHandler);
        uint256 reward = executionRewardPerAgent;
        if (reward == 0) reward = agentRewardPerAgent[agentId];
        if (reward == 0) reward = jsonApiRewardPerAgent;

        uint256 requiredDeposit = platform.getAdvancedRequestDeposit(customSubcommitteeSize);
        if (reward * customSubcommitteeSize > requiredDeposit) {
            requiredDeposit = reward * customSubcommitteeSize;
        }
        if (msg.value < requiredDeposit) {
            revert InsufficientDeposit(requiredDeposit, msg.value);
        }

        requestId = platform.createAdvancedRequest{value: msg.value}(
            agentId,
            address(this),
            responseHandler,
            payload,
            customSubcommitteeSize,
            threshold,
            consensusType,
            timeout
        );

        _registerRequest(requestId, kind);
    }

    function _kindForHandler(bytes4 responseHandler) internal pure returns (AgentResponseKind) {
        if (responseHandler == this.handleUintResponse.selector) return AgentResponseKind.Uint;
        if (responseHandler == this.handleStringResponse.selector) return AgentResponseKind.String;
        if (responseHandler == this.handleBytesResponse.selector) return AgentResponseKind.Bytes;
        revert InvalidResponseHandler();
    }

    function _createRequest(
        uint256 agentId,
        bytes memory payload,
        bytes4 callbackSelector,
        AgentResponseKind kind,
        uint256 requiredDeposit
    ) internal returns (uint256 requestId) {
        if (msg.value < requiredDeposit) {
            revert InsufficientDeposit(requiredDeposit, msg.value);
        }

        requestId = platform.createRequest{value: msg.value}(
            agentId,
            address(this),
            callbackSelector,
            payload
        );

        _registerRequest(requestId, kind);
    }

    function _registerRequest(uint256 requestId, AgentResponseKind kind) internal {
        _pendingRequests[requestId] = true;
        _requestMeta[requestId] = RequestMeta({initiator: msg.sender, kind: kind});
    }

    function requestInitiator(uint256 requestId) external view returns (address) {
        return _requestMeta[requestId].initiator;
    }

    function responseKind(uint256 requestId) external view returns (AgentResponseKind) {
        return _requestMeta[requestId].kind;
    }

    /// @notice Legacy alias for uintResults.
    function results(uint256 requestId) external view returns (uint256) {
        return uintResults[requestId];
    }

    function isPending(uint256 requestId) external view returns (bool) {
        return _pendingRequests[requestId];
    }

    receive() external payable {}
}
