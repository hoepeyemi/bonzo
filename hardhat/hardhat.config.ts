import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import hardhatToolboxViemPlugin from "@nomicfoundation/hardhat-toolbox-viem";
import { defineConfig } from "hardhat/config";

const projectDir = dirname(fileURLToPath(import.meta.url));
// Load `hardhat/.env` — deployment uses env vars only (no Hardhat keystore required).
dotenv.config({ path: resolve(projectDir, ".env") });

function deployerPrivateKeys(): string[] {
  const raw = process.env.HACKATHON_KEY?.trim();
  if (!raw) return [];
  const key = raw.startsWith("0x") ? raw : `0x${raw}`;
  return [key];
}

// Only needed for `ignition deploy --verify` / `verify` tasks; can be empty for deploy-only.
const somniaExplorerApiKey = process.env.SOMNIA_EXPLORER_API_KEY?.trim() ?? "";

export default defineConfig({
  plugins: [hardhatToolboxViemPlugin],
  solidity: {
    profiles: {
      default: {
        version: "0.8.29",
        settings: {
          evmVersion: "prague",
          optimizer: {
            enabled: true,
            runs: 200,
          },
          viaIR: true,
        },
      },
      production: {
        version: "0.8.29",
        settings: {
          evmVersion: "prague",
          optimizer: {
            enabled: true,
            runs: 200,
          },
          viaIR: true,
        },
      },
    },
  },

  networks: {
    somniaTestnet: {
      type: "http",
      chainType: "l1",
      url: "https://api.infra.testnet.somnia.network",
      chainId: 50312,
      accounts: deployerPrivateKeys(),
    },
  },

  chainDescriptors: {
    50312: {
      name: "somnia-testnet",
      hardforkHistory: {
        cancun: { blockNumber: 0 },
      },
      blockExplorers: {
        etherscan: {
          name: "Somnia Shannon Explorer",
          url: "https://shannon-explorer.somnia.network",
          apiUrl: "https://shannon-explorer.somnia.network/api", // adjust if using a different verify API
        },
      },
    },
  },

  verify: {
    etherscan: {
      apiKey: somniaExplorerApiKey,
    },
  },
});
