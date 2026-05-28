/**
 * Enable EIP-7702 Smart Account
 *
 * This script enables the smart account by signing an EIP-7702 authorization
 * and sending a transaction with the authorization list.
 *
 * Usage:
 *   PRIVATE_KEY=0x... npx hardhat run scripts/enable-smart-account.ts --network somniaTestnet
 *
 * Note: EIP-7702 signAuthorization requires a local account (direct private key access),
 * not a JSON-RPC account. This is why we read the private key from environment directly.
 */

import hre from "hardhat";
import { privateKeyToAccount } from "viem/accounts";
import {
  createWalletClient,
  createPublicClient,
  http,
  defineChain,
  type Address,
  type Hex,
} from "viem";

const somniaTestnet = defineChain({
  id: 50312,
  name: "Somnia Testnet",
  nativeCurrency: { name: "STT", symbol: "STT", decimals: 18 },
  rpcUrls: { default: { http: ["https://api.infra.testnet.somnia.network"] } },
});

// AgentDelegator contract address by chain
const AGENT_DELEGATOR_ADDRESSES: Record<number, Address> = {
  50312: "0x0b8bC9dd22D1D69F820B724fe10Cb401A1300BE9",
};

async function main() {
  const privateKey = (process.env.PRIVATE_KEY ?? process.env.HACKATHON_KEY) as Hex | undefined;
  if (!privateKey) {
    console.error("Error: PRIVATE_KEY or HACKATHON_KEY environment variable not set.");
    console.error("");
    console.error("Usage:");
    console.error("  npx hardhat run scripts/enable-smart-account.ts --network somniaTestnet");
    console.error("");
    console.error("Set HACKATHON_KEY in hardhat/.env (or PRIVATE_KEY in the shell).");
    process.exit(1);
  }

  const account = privateKeyToAccount(
    privateKey.startsWith("0x") ? privateKey : (`0x${privateKey}` as Hex)
  );

  const connection = await hre.network.connect();
  const publicClientHh = await connection.viem.getPublicClient();
  const chainId = await publicClientHh.getChainId();

  console.log("Chain ID:", chainId);
  console.log("Account address:", account.address);

  const contractAddress = AGENT_DELEGATOR_ADDRESSES[chainId];
  if (!contractAddress) {
    throw new Error(`AgentDelegator not deployed on chain ${chainId}`);
  }

  const chain = chainId === 50312 ? somniaTestnet : undefined;
  const rpcUrl = "https://api.infra.testnet.somnia.network";

  if (!chain) {
    throw new Error(`Unsupported chain ID: ${chainId}`);
  }

  const publicClient = createPublicClient({
    chain,
    transport: http(rpcUrl),
  });

  const walletClient = createWalletClient({
    account,
    chain,
    transport: http(rpcUrl),
  });

  const nonce = await publicClient.getTransactionCount({
    address: account.address,
  });
  console.log("Current nonce:", nonce);

  const currentCode = await publicClient.getCode({ address: account.address });
  if (currentCode) {
    const expectedPrefix = `0xef0100${contractAddress.slice(2).toLowerCase()}`;
    if (currentCode.toLowerCase() === expectedPrefix.toLowerCase()) {
      console.log("\n✅ Smart account is already enabled!");
      console.log("Current delegation:", currentCode);
      return;
    }
    console.log("Account has existing code:", currentCode);
  }

  console.log("\nEnabling smart account...");
  console.log("Delegating to:", contractAddress);

  const authorization = await walletClient.signAuthorization({
    contractAddress,
    executor: "self",
  });

  console.log("Authorization signed:", {
    address: authorization.address,
    chainId: authorization.chainId,
    nonce: authorization.nonce,
  });

  // Somnia charges ~1.57M gas per EIP-7702 authorization (see Somnia gas docs).
  const estimatedGas = await publicClient.estimateGas({
    account: account.address,
    to: account.address,
    data: "0x",
    authorizationList: [authorization],
  });
  const gas = (estimatedGas * 120n) / 100n;
  console.log("Gas estimate:", estimatedGas.toString(), "using:", gas.toString());

  const hash = await walletClient.sendTransaction({
    to: account.address,
    data: "0x",
    authorizationList: [authorization],
    gas,
  });

  console.log("Transaction sent:", hash);

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log("Transaction confirmed in block:", receipt.blockNumber);
  console.log("Status:", receipt.status);

  if (receipt.status === "success") {
    const newCode = await publicClient.getCode({ address: account.address });
    console.log("\nAccount code after delegation:", newCode);

    const expectedCode = `0xef0100${contractAddress.slice(2).toLowerCase()}`;
    if (newCode?.toLowerCase() === expectedCode.toLowerCase()) {
      console.log("\n✅ Smart account enabled successfully!");
    } else {
      console.log("\n⚠️  Delegation may not have been applied correctly");
      console.log("Expected:", expectedCode);
      console.log("Got:", newCode);
    }
  } else {
    console.log("\n❌ Transaction failed");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
