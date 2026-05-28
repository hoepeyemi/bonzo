import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const AgentDelegatorV2Module = buildModule("AgentDelegatorV2Module", (m) => {
  const agentDelegator = m.contract("AgentDelegator");

  return { agentDelegator };
});

export default AgentDelegatorV2Module;
