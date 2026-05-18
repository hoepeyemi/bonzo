# Hardhat — AgentDelegator & Somnia Agents

## Somnia Agents integration

> **Agents ≠ payments.** Somnia Agents fetch off-chain data on-chain; x402 uses STT on chain 50312 separately.  
> **Path A:** call `AgentFabricSomniaBridge` directly. **Path B:** AgentDelegator `0xd19BB4bD6C565A0128E18b480c055De43f7F1DA9` (Somnia 50312) — re-7702 per user, then configure bridge.

AgentFabric can invoke [Somnia Agents](https://metaversal.gitbook.io/agents/s8KLL5NzoS6LwJVIQCiT/invoking-agents/quickstart) from Solidity for async off-chain data (JSON API, oracles, etc.).

| Contract | Role |
| --- | --- |
| `SomniaAgents` platform | `0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776` (testnet) |
| `AgentFabricSomniaBridge` | Deploy per network; wraps `createRequest` + callbacks |
| `SomniaAgentConsumer` | Base consumer (JSON API helper + generic `requestAgent`) |

**Deploy bridge (testnet):**

```bash
# Pick agent ID from https://agents.testnet.somnia.network → method → Solidity tab
JSON_API_AGENT_ID=<agent-id> npx hardhat run scripts/deploy-somnia-agent-bridge.ts --network somniaTestnet
```

Add `NEXT_PUBLIC_SOMNIA_AGENT_BRIDGE_ADDRESS` and `NEXT_PUBLIC_JSON_API_AGENT_ID` to `apps/web/.env.local`.

Session keys can allowlist the bridge address in `allowedTargets` to call `requestLabeledFetch` from workflows.

**AgentDelegator integration — Path B** (implementation `0xd19BB4bD6C565A0128E18b480c055De43f7F1DA9`; users must re-7702 + run configure script):

- `setSomniaAgentBridge(address)` — owner self-call
- `grantSessionWithSomniaBridge(...)` — auto-appends bridge to `allowedTargets`
- `invokeSomniaLabeledFetch(...)` — forward through configured bridge

```bash
SOMNIA_AGENT_BRIDGE=0xcaa3228c7c8f82581228cba5867f4a84ae0f5a80 \
npx hardhat run scripts/configure-delegator-somnia-bridge.ts --network somniaTestnet
```

**Typed agent callbacks:** `requestAgent(agentId, payload, responseHandler, executionRewardPerAgent)` where `responseHandler` is `handleUintResponse`, `handleStringResponse`, or `handleBytesResponse`. Deposits use `getRequestDeposit()` + configurable per-agent rewards (not a hardcoded 0.03 ether at runtime).

### Request a labeled oracle (programmatic)

```bash
# hardhat/.env: HACKATHON_KEY=0x...
SOMNIA_ORACLE_URL="https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd" \
SOMNIA_ORACLE_SELECTOR="bitcoin.usd" \
SOMNIA_ORACLE_LABEL="btc-usd" \
pnpm --filter hardhat somnia:oracle
```

Or from the web API (auth + server key with native STT):

```bash
curl http://localhost:3000/api/somnia/oracle/refresh -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SOMNIA_ORACLE_API_KEY" \
  -d '{"label":"btc-usd"}'
```

Library: `@x402/contracts` → `quoteJsonApiDepositAtBridge`, `requestLabeledOracleFetchWithKey`.

---

# AgentDelegator Contract

A smart account contract implementing ERC-7702 delegation with session key support. The AgentDelegator enables EOA wallets to delegate limited permissions to session keys (agents) for specific operations without exposing the owner's private key.

## Overview

The AgentDelegator contract allows users to:

- **Delegate authority** to session keys with scoped permissions (allowed targets, selectors, time bounds)
- **Sign EIP-1271 signatures** on behalf of the smart account using session keys
- **Execute transactions** via ERC-4337 UserOperations or direct `executeWithSession` calls
- **Approve contracts** for EIP-1271 signature validation with domain-specific configuration

## Session Keys

Sessions are created by the account owner and define what a session key is allowed to do:

```solidity
struct Session {
    address sessionKey;        // The delegated key address
    address[] allowedTargets;  // Contracts the session can interact with
    bytes4[] allowedSelectors; // Function selectors allowed (empty = all)
    uint48 validAfter;         // Start timestamp
    uint48 validUntil;         // Expiration timestamp
    bool active;               // Can be revoked by owner
}
```

Each session also has a list of **approved contracts** for EIP-1271 signatures, stored with their EIP-712 domain info (name hash, version hash).

## EIP-712 Signature Formats

The contract supports three signature formats, distinguished by length:

### 65 bytes: EOA Owner Signature

Standard ECDSA signature from the account owner. Grants full access to all operations.

### 97 bytes: ERC-4337 Session Signature

Used for UserOperation validation in the ERC-4337 flow.

```
Format: sessionId (32 bytes) + ecdsaSignature (65 bytes)
```

The session key signs an EIP-712 typed message:

```solidity
bytes32 constant ERC4337_SESSION_SIGNATURE_TYPEHASH =
    keccak256("ERC4337SessionSignature(bytes32 sessionId,bytes32 userOpHash)");

// Session key signs:
bytes32 structHash = keccak256(abi.encode(
    ERC4337_SESSION_SIGNATURE_TYPEHASH,
    sessionId,
    userOpHash
));
bytes32 digest = hashTypedDataV4(structHash);
```

### 149 bytes: EIP-1271 Session Signature

Used for off-chain signature validation (e.g., USDC permit signatures for x402 payments).

```
Format: sessionId (32) + verifyingContract (20) + structHash (32) + ecdsaSignature (65)
```

This format prevents domain confusion attacks by requiring the session key to prove knowledge of the exact EIP-712 domain used:

1. The caller provides the `verifyingContract` address and original `structHash`
2. The contract looks up the pre-registered domain info (name, version) for that contract
3. The contract recomputes the expected hash: `keccak256("\x19\x01" || domainSeparator || structHash)`
4. If the recomputed hash matches the `hash` parameter, the preimage is verified
5. The session key's signature is validated over its own typed message:

```solidity
bytes32 constant SESSION_SIGNATURE_TYPEHASH =
    keccak256("SessionSignature(address verifyingContract,bytes32 structHash)");

// Session key signs:
bytes32 sessionStructHash = keccak256(abi.encode(
    SESSION_SIGNATURE_TYPEHASH,
    verifyingContract,
    structHash
));
bytes32 digest = hashTypedDataV4(sessionStructHash);
```

## Security Model

The EIP-1271 session signature design provides several security guarantees:

1. **Domain binding**: Session keys can only sign for pre-approved contracts with known EIP-712 domains
2. **Preimage verification**: The contract verifies the hash was actually constructed from the claimed domain and struct hash
3. **Scope limitation**: Sessions are restricted to specific targets and function selectors
4. **Time bounds**: Sessions have explicit validity windows enforced on-chain
5. **Revocability**: The account owner can revoke sessions at any time

## Usage

### Running Tests

```shell
npx hardhat test
```

### Deployment

1. Copy `.env.example` to `.env` and set **`HACKATHON_KEY`** to your deployer private key (`0x` + 64 hex chars). Deployment does **not** use the Hardhat keystore.

2. Deploy with Ignition:

```shell
npx hardhat ignition deploy ignition/modules/AgentDelegator.ts --network somniaTestnet
```

Optional: set **`SOMNIA_EXPLORER_API_KEY`** in `.env` if you use `ignition deploy --verify` or contract verification tasks.

You can also export `HACKATHON_KEY` in the shell instead of using `.env`.

## Contract Architecture

- **ERC-7702**: Enables EOA delegation to the smart account logic
- **ERC-7821**: Batch execution support with ERC-7579 encoding
- **ERC-4337**: Account abstraction compatibility via `validateUserOp`
- **ERC-1271**: Smart contract signature validation for off-chain signing
- **ERC-7201**: Namespaced storage to avoid collisions
