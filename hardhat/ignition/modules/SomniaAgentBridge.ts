import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

/**
 * Deploy AgentFabricSomniaBridge.
 *
 * Set JSON_API_AGENT_ID in the environment to the agent ID from:
 * https://agents.testnet.somnia.network
 */
const SomniaAgentBridgeModule = buildModule("SomniaAgentBridgeModule", (m) => {
  const jsonApiAgentId = m.getParameter(
    "jsonApiAgentId",
    process.env.JSON_API_AGENT_ID ?? "0"
  );

  const jsonApiRewardPerAgent = m.getParameter("jsonApiRewardPerAgent", 0);
  const subcommitteeSize = m.getParameter("subcommitteeSize", 0);

  const bridge = m.contract("AgentFabricSomniaBridge", [
    jsonApiAgentId,
    jsonApiRewardPerAgent,
    subcommitteeSize,
  ]);

  return { bridge };
});

export default SomniaAgentBridgeModule;
