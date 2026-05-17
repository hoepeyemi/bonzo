/**
 * Quote STT deposit and invoke a labeled JSON API Somnia agent via AgentFabricSomniaBridge.
 *
 * Usage:
 *   pnpm --filter hardhat somnia:oracle
 *
 * Environment (hardhat/.env):
 *   HACKATHON_KEY, SOMNIA_ORACLE_URL, SOMNIA_ORACLE_SELECTOR, SOMNIA_ORACLE_LABEL, ...
 */
import {
  labelToHash,
  quoteJsonApiDepositAtBridge,
  requestLabeledOracleFetchWithKey,
} from "@x402/contracts";
import { formatEther, type Address, type Hex } from "viem";

async function main() {
  const raw = (process.env.PRIVATE_KEY ?? process.env.HACKATHON_KEY)?.trim();
  if (!raw) {
    console.error("Set PRIVATE_KEY or HACKATHON_KEY in hardhat/.env");
    process.exit(1);
  }

  const url = process.env.SOMNIA_ORACLE_URL?.trim();
  const jsonSelector = process.env.SOMNIA_ORACLE_SELECTOR?.trim();
  if (!url || !jsonSelector) {
    console.error("Set SOMNIA_ORACLE_URL and SOMNIA_ORACLE_SELECTOR");
    console.error("Example from https://agents.testnet.somnia.network (Solidity tab)");
    process.exit(1);
  }

  const label = process.env.SOMNIA_ORACLE_LABEL?.trim() ?? "btc-usd";
  const decimals = Number(process.env.SOMNIA_ORACLE_DECIMALS ?? "8");
  const bridge = (process.env.SOMNIA_AGENT_BRIDGE?.trim() ??
    "0xcaa3228c7c8f82581228cba5867f4a84ae0f5a80") as Address;

  const key = (raw.startsWith("0x") ? raw : `0x${raw}`) as Hex;

  console.log("Bridge:", bridge);
  console.log("Label:", label, "→", labelToHash(label));

  const quoted = await quoteJsonApiDepositAtBridge(bridge);
  console.log("quoteJsonApiDeposit:", formatEther(quoted), "STT");

  console.log("\nSubmitting requestLabeledFetch...");
  const result = await requestLabeledOracleFetchWithKey(key, {
    bridgeAddress: bridge,
    label,
    url,
    jsonSelector,
    decimals,
    pollTimeoutMs: Number(process.env.SOMNIA_ORACLE_POLL_TIMEOUT_MS ?? "300000"),
  });

  console.log("\n--- Result ---");
  console.log("submitTxHash:", result.submitTxHash);
  console.log("requestId:", result.requestId.toString());
  console.log("depositPaid:", formatEther(result.depositWei), "STT");
  console.log("value (uint):", result.value.toString());
  console.log("value (formatted):", Number(result.value) / 10 ** decimals);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
