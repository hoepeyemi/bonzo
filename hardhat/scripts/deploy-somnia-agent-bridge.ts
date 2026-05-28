/**
 * Deploy BonzoSomniaBridge on Somnia testnet.
 *
 * Usage:
 *   JSON_API_AGENT_ID=<id from Agent Explorer> npx hardhat run scripts/deploy-somnia-agent-bridge.ts --network somniaTestnet
 */
import hre from "hardhat";

async function main() {
  const jsonApiAgentId = process.env.JSON_API_AGENT_ID?.trim();
  if (!jsonApiAgentId || jsonApiAgentId === "0") {
    console.error("Set JSON_API_AGENT_ID from https://agents.testnet.somnia.network");
    process.exit(1);
  }

  const connection = await hre.network.connect();
  const rewardPerAgent = process.env.SOMNIA_JSON_API_REWARD_PER_AGENT?.trim();
  const subcommitteeSize = process.env.SOMNIA_SUBCOMMITTEE_SIZE?.trim();

  const bridge = await connection.viem.deployContract("BonzoSomniaBridge", [
    BigInt(jsonApiAgentId),
    rewardPerAgent ? BigInt(rewardPerAgent) : 0n,
    subcommitteeSize ? BigInt(subcommitteeSize) : 0n,
  ]);

  console.log("BonzoSomniaBridge deployed:", bridge.address);
  console.log("SomniaAgents platform (testnet): 0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776");
  console.log("");
  console.log("Add to apps/web .env:");
  console.log(`NEXT_PUBLIC_SOMNIA_AGENT_BRIDGE_ADDRESS=${bridge.address}`);
  console.log(`NEXT_PUBLIC_JSON_API_AGENT_ID=${jsonApiAgentId}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
