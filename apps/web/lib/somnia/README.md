# Somnia integration (web server)

**Somnia chain** (STT, x402, 7702) ≠ **Somnia Agents** (oracles). See [`docs/somnia-agents.md`](../../../../docs/somnia-agents.md).

| Module | Role |
| ------ | ---- |
| `config.ts` | Feed definitions from env |
| `agents.ts` | Bridge address resolution |
| `requestOracle.ts` | Thin wrappers over `@x402/contracts` |
| `oracleService.ts` | App-level read/refresh + JSON serialization |
| `requireOracleRefreshAuth.ts` | Session or API key for paid refresh |

On-chain logic is only in `packages/contracts/somniaOracle.ts` — do not duplicate fetch/poll here.

**API:** `GET /api/somnia/oracle`, `POST /api/somnia/oracle/refresh` (auth required for refresh).

---

## Environment

Somnia Agents are used for oracle-style off-chain data requests. x402 payments are separate and use STT/session signatures on Somnia chain ID `50312`.

```dotenv
NEXT_PUBLIC_SOMNIA_AGENT_BRIDGE_ADDRESS=0xcaa3228c7c8f82581228cba5867f4a84ae0f5a80
NEXT_PUBLIC_JSON_API_AGENT_ID=13174292974160097713
JSON_API_AGENT_ID=13174292974160097713
SOMNIA_ORACLE_URL=https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd
SOMNIA_ORACLE_SELECTOR=bitcoin.usd
SOMNIA_ORACLE_LABEL=btc-usd
SOMNIA_ORACLE_DECIMALS=8
```

Do not treat the Somnia Agent bridge as the x402 payment token or facilitator. Payment setup is documented in the web and MCP server READMEs.
