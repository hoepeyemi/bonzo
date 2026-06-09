# x402 MCP Server

Express.js server implementing the Model Context Protocol (MCP) for AI agent integration. Exposes marketplace APIs and workflows as MCP tools that AI agents can discover and execute.

## Features

- **MCP Protocol** - Streamable HTTP transport with session management
- **OAuth 2.0** - Protected resource with RFC 8414/9470 metadata discovery
- **Proxy Tools** - Wrap marketplace APIs as MCP tools with x402 payment handling
- **Workflow Tools** - Execute multi-step workflows (HTTP calls + on-chain transactions)
- **Multi-tenant** - Slug-based routing for multiple MCP server configurations

## Environment Setup

The MCP server shares environment variables with the web app. Required variables:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string (shared with web) |
| `REDIS_URL` | Redis connection string (optional) |
| `NEXT_APP_URL` | URL of the web app (default: `http://localhost:3000`) |
| `MCP_PUBLIC_URL` | Public URL where agents should connect for MCP traffic. In Docker deployment, set this to the web origin that proxies `/mcp/*` (for example, `https://app.example.com`), not the internal container URL |
| `PORT` | Server port (default: `3001`) |
| `CHAIN_ID` | Somnia Shannon testnet chain ID — `50312` |
| `SERVER_PRIVATE_KEY` | RSA private key for decrypting session keys |
| `MCP_CLIENT_SECRET` | OAuth client secret for the MCP platform client |
| `USDCE_ADDRESS` | Optional x402 payment token override. Set this to the same value as the web app's `NEXT_PUBLIC_USDCE_ADDRESS` when using a non-default Somnia EIP-3009 token |

## Running

```bash
# Development (port 3001)
pnpm dev

# Production build
pnpm build
pnpm start
```

## Docker

Build from the repository root:

```bash
docker build -f Dockerfile.mcp -t bottie-mcp .
```

Run the container on port 3001 with your MCP environment file:

```bash
docker run --rm -p 3001:3001 --env-file apps/mcp-server/.env bottie-mcp
```

When deployed beside the web container, the MCP server is reached internally at:

```text
http://bottie-mcp-server:3001
```

But OAuth metadata must advertise the public web origin:

```dotenv
NEXT_APP_URL=https://your-web-origin
MCP_PUBLIC_URL=https://your-web-origin
```

Then the connector URL is:

```text
https://your-web-origin/mcp/<server-slug>
```

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /health` | Health check |
| `POST /mcp/:slug` | MCP JSON-RPC endpoint |
| `GET /mcp/:slug` | SSE streaming for MCP sessions |
| `DELETE /mcp/:slug` | Terminate MCP session |
| `GET /.well-known/oauth-authorization-server` | OAuth metadata |
| `GET /.well-known/oauth-protected-resource` | Protected resource metadata |
| `GET /mcp/:slug/.well-known/*` | Slug-specific OAuth discovery |

## Local Testing with Tunnels

For testing with external MCP clients, expose the server via cloudflared:

```bash
cloudflared tunnel --url http://localhost:3001
```

## Architecture

```
src/
├── server.ts       # Express app setup and MCP session handling
├── index.ts        # Server entry point
├── auth/           # OAuth token validation
├── tools/          # Tool registry and handlers
│   ├── registry.ts      # Load tools from database
│   ├── proxy-tool.ts    # API proxy tool factory
│   └── workflow-tool.ts # Workflow tool factory
└── workflows/      # Workflow execution engine
    ├── engine.ts        # Core workflow executor
    ├── resolver.ts      # JSONPath expression resolution
    └── steps/           # Step type handlers (http, onchain)
```

---

## Production Notes

Hosted MCP clients should connect through the public web origin:

```text
https://your-web-origin/mcp/<server-slug>
```

In Docker, the web app proxies `/mcp/*` and OAuth discovery routes to this MCP server over the Docker network. Configure the MCP server with the public web origin, not the internal container URL:

```dotenv
NEXT_APP_URL=https://your-web-origin
MCP_PUBLIC_URL=https://your-web-origin
```

The x402 payment token must match the token used by the web app when it grants payment sessions:

```dotenv
CHAIN_ID=50312
USDCE_ADDRESS=0xb0f86e408ea86fdab40c67addf5ac9faed09780d
NEXT_PUBLIC_USDCE_ADDRESS=0xb0f86e408ea86fdab40c67addf5ac9faed09780d
```

When payment signing is using the correct token, logs include:

```text
[SignPayment] Payment token address: 0xb0f86e408ea86fdab40c67addf5ac9faed09780d
```

Settlement requires a relayer key in the running container:

```dotenv
FACILITATOR_RELAYER_KEY=0x...
```

Verify the runtime env, not only the host file:

```bash
sudo docker exec bottie-mcp-server printenv FACILITATOR_RELAYER_KEY
sudo docker exec bottie-mcp-server printenv USDCE_ADDRESS
```

If Claude offers to use web search after invoking a connector, it usually means the MCP tool ran and then failed during x402 settlement or upstream execution. Check `bottie-mcp-server` logs for the backend error.
