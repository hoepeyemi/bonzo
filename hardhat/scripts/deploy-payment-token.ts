/**
 * Deploy MockERC20WithEIP3009 (EIP-3009) on Somnia testnet for x402 payments.
 *
 * Usage (from hardhat/):
 *   npx hardhat run scripts/deploy-payment-token.ts --network somniaTestnet
 *
 * Requires HACKATHON_KEY in hardhat/.env (see hardhat.config.ts).
 *
 * Optional env:
 *   MINT_TO=0x...     recipient for initial mint (defaults to deployer)
 *   MINT_AMOUNT=1000  human-readable STT to mint (token uses 18 decimals)
 */

import hre from "hardhat";
import { parseEther, type Address } from "viem";

const TOKEN_NAME = "STT";
const TOKEN_SYMBOL = "STT";

async function main() {
  const connection = await hre.network.connect();
  const viem = connection.viem;
  const publicClient = await viem.getPublicClient();
  const [walletClient] = await viem.getWalletClients();

  const deployer = walletClient.account.address;
  const mintTo = (process.env.MINT_TO as Address | undefined) ?? deployer;
  const mintHuman = process.env.MINT_AMOUNT ?? "1000";
  const mintAmount = parseEther(mintHuman);

  console.log("Network chain ID:", await publicClient.getChainId());
  console.log("Deployer:", deployer);

  const token = await viem.deployContract("MockERC20WithEIP3009", [
    TOKEN_NAME,
    TOKEN_SYMBOL,
  ]);

  console.log("MockERC20WithEIP3009 deployed:", token.address);

  const mintTx = await token.write.mint([mintTo, mintAmount]);
  console.log("Mint tx:", mintTx);
  console.log(`Minted ${mintHuman} ${TOKEN_SYMBOL} to`, mintTo);

  const balance = await token.read.balanceOf([mintTo]);
  console.log("Balance (raw):", balance.toString());

  console.log("\n--- Next steps (apps/web/.env.local) ---");
  console.log(`NEXT_PUBLIC_CHAIN_ID=50312`);
  console.log(`NEXT_PUBLIC_USDCE_ADDRESS=${token.address}`);
  console.log(
    "\nIn packages/payment/src/constants.ts set EIP-712 for this mock:"
  );
  console.log(`  domainName: '${TOKEN_NAME}', domainVersion: '1'`);
  console.log("Then: pnpm build:packages && restart the web app");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
