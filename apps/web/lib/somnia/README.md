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
