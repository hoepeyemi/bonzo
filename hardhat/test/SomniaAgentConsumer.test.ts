import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import { parseEther } from "viem";
import { getViemAndProvider } from "./helpers/setup.js";

describe("SomniaAgentConsumer", async function () {
  let viem: Awaited<ReturnType<typeof getViemAndProvider>>["viem"];
  let owner: Awaited<ReturnType<typeof viem.getWalletClients>>[0];

  beforeEach(async function () {
    const ctx = await getViemAndProvider();
    viem = ctx.viem;
    const wallets = await viem.getWalletClients();
    owner = wallets[0];
  });

  it("invokes JSON API agent and stores uint callback result", async function () {
    const platform = await viem.deployContract("MockSomniaAgents");
    await platform.write.setRequestDeposit([parseEther("0.01")]);

    const consumer = await viem.deployContract("SomniaAgentConsumer", [
      platform.address,
      1n,
      parseEther("0.03"),
      3n,
    ]);

    const deposit = await consumer.read.quoteJsonApiDeposit();

    await owner.writeContract({
      address: consumer.address,
      abi: consumer.abi,
      functionName: "requestJsonApiUint",
      args: ["https://example.com/data", "price", 8],
      value: deposit,
    });

    const requestId = 1n;

    await owner.writeContract({
      address: platform.address,
      abi: platform.abi,
      functionName: "fulfillRequest",
      args: [requestId],
    });

    const result = await consumer.read.uintResults([requestId]);
    assert.equal(result, 42n);
    assert.equal(await consumer.read.isPending([requestId]), false);
  });

  it("quotes agent deposit from platform getRequestDeposit + configurable reward", async function () {
    const platform = await viem.deployContract("MockSomniaAgents");
    await platform.write.setRequestDeposit([parseEther("0.01")]);

    const consumer = await viem.deployContract("SomniaAgentConsumer", [
      platform.address,
      1n,
      parseEther("0.05"),
      3n,
    ]);

    const quote = await consumer.read.quoteJsonApiDeposit();
    assert.equal(quote, parseEther("0.01") + parseEther("0.05") * 3n);
  });
});
