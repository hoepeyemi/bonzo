/**
 * Mint x402 payment tokens to any address (public mint on MockERC20WithEIP3009).
 *
 * Usage:
 *   MINT_TO=0xYourWallet MINT_AMOUNT=100 npx hardhat run scripts/mint-payment-token-to.ts --network somniaTestnet
 *
 * Or mint to yourself (payer = HACKATHON_KEY):
 *   MINT_AMOUNT=100 npx hardhat run scripts/mint-payment-token-to.ts --network somniaTestnet
 *
 * Env:
 *   PAYMENT_TOKEN=0x...  (default: read from apps/web .env or 0xb0f86...)
 *   MINT_TO=0x...
 *   MINT_AMOUNT=100      human-readable STT
 */
import hre from "hardhat";
import { parseUnits, type Address, type Hex } from "viem";

const DEFAULT_TOKEN = "0xb0f86e408ea86fdab40c67addf5ac9faed09780d" as Address;

async function main() {
  const rawKey = (process.env.PRIVATE_KEY ?? process.env.HACKATHON_KEY)?.trim();
  if (!rawKey) {
    console.error("Set HACKATHON_KEY or PRIVATE_KEY in hardhat/.env");
    process.exit(1);
  }

  const connection = await hre.network.connect();
  const viem = connection.viem;
  const publicClient = await viem.getPublicClient();
  const [walletClient] = await viem.getWalletClients();

  const token = (process.env.PAYMENT_TOKEN?.trim() ?? DEFAULT_TOKEN) as Address;
  const mintTo = (process.env.MINT_TO?.trim() ?? walletClient.account.address) as Address;
  const mintHuman = process.env.MINT_AMOUNT ?? "100";

  const decimals = await publicClient.readContract({
    address: token,
    abi: [
      {
        type: "function",
        name: "decimals",
        stateMutability: "view",
        inputs: [],
        outputs: [{ type: "uint8" }],
      },
    ],
    functionName: "decimals",
  });

  const amount = parseUnits(mintHuman, Number(decimals));

  const mintAbi = [
    {
      type: "function" as const,
      name: "mint",
      stateMutability: "nonpayable" as const,
      inputs: [
        { name: "to", type: "address" },
        { name: "amount", type: "uint256" },
      ],
      outputs: [],
    },
  ];

  const estimatedGas = await publicClient.estimateContractGas({
    address: token,
    abi: mintAbi,
    functionName: "mint",
    args: [mintTo, amount],
    account: walletClient.account.address,
  });
  const gas = (estimatedGas * BigInt(120)) / BigInt(100);

  console.log("Token:", token);
  console.log("Mint to:", mintTo);
  console.log("Amount:", mintHuman, "STT (decimals:", decimals, ")");
  console.log("Gas estimate:", estimatedGas.toString(), "→ using", gas.toString());

  const hash = await walletClient.writeContract({
    address: token,
    abi: mintAbi,
    functionName: "mint",
    args: [mintTo, amount],
    gas,
  });

  console.log("Mint tx:", hash);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log("Status:", receipt.status);

  const balance = await publicClient.readContract({
    address: token,
    abi: [
      {
        type: "function",
        name: "balanceOf",
        stateMutability: "view",
        inputs: [{ name: "account", type: "address" }],
        outputs: [{ type: "uint256" }],
      },
    ],
    functionName: "balanceOf",
    args: [mintTo],
  });
  console.log("balanceOf:", balance.toString());
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
