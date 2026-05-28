/**
 * Link AgentDelegator (via self-call) to the deployed BonzoSomniaBridge.
 *
 * Prerequisite: smart account enabled (EIP-7702). Run enable-smart-account.ts first.
 *
 * Usage:
 *   SOMNIA_AGENT_BRIDGE=0xcaa3228c7c8f82581228cba5867f4a84ae0f5a80 \
 *   npx hardhat run scripts/configure-delegator-somnia-bridge.ts --network somniaTestnet
 */
import hre from "hardhat";
import { encodeFunctionData, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";

async function main() {
  const bridge = process.env.SOMNIA_AGENT_BRIDGE?.trim() as Address | undefined;
  if (!bridge) {
    console.error("Set SOMNIA_AGENT_BRIDGE to your BonzoSomniaBridge address");
    process.exit(1);
  }

  const raw = (process.env.PRIVATE_KEY ?? process.env.HACKATHON_KEY)?.trim();
  if (!raw) {
    console.error("Set PRIVATE_KEY or HACKATHON_KEY");
    process.exit(1);
  }

  const key = (raw.startsWith("0x") ? raw : `0x${raw}`) as Hex;
  const account = privateKeyToAccount(key);

  const connection = await hre.network.connect();
  const publicClient = await connection.viem.getPublicClient();
  const walletClient = await connection.viem.getWalletClients().then((w) => w[0]);

  const delegatorAddress = account.address;
  const data = encodeFunctionData({
    abi: [
      {
        name: "setSomniaAgentBridge",
        type: "function",
        inputs: [{ name: "bridge", type: "address" }],
        outputs: [],
      },
    ],
    functionName: "setSomniaAgentBridge",
    args: [bridge],
  });

  console.log("Setting Somnia bridge on delegator:", delegatorAddress);
  console.log("Bridge:", bridge);

  const hash = await walletClient.sendTransaction({
    account,
    chain: publicClient.chain,
    to: delegatorAddress,
    data,
  });

  console.log("Transaction:", hash);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log("Status:", receipt.status);

  const configured = await publicClient.readContract({
    address: delegatorAddress,
    abi: [
      {
        name: "getSomniaAgentBridge",
        type: "function",
        stateMutability: "view",
        inputs: [],
        outputs: [{ type: "address" }],
      },
    ],
    functionName: "getSomniaAgentBridge",
  });

  console.log("getSomniaAgentBridge():", configured);
}

main().catch(console.error);
