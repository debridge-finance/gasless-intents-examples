import "dotenv/config";
import { createWalletClient, createPublicClient, http, formatUnits, parseAbi } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";
import { USDC } from "@utils/constants";
import { CHAIN_IDS } from "@utils/chains";
import { getVaultAddressByToken } from "@utils/morpho/get-vault-address";
import { getEnvConfig, toHexPrefixString } from "../../../utils";

const USDC_DECIMALS = 6;
const WITHDRAW_AMOUNT = BigInt("1000000"); // 1 USDC

const ERC20_BALANCE_ABI = parseAbi([
  "function balanceOf(address account) view returns (uint256)",
]);

const ERC4626_ABI = parseAbi([
  "function decimals() view returns (uint8)",
  "function convertToAssets(uint256 shares) view returns (uint256)",
  "function withdraw(uint256 assets, address receiver, address owner) external returns (uint256 shares)",
]);

async function main() {
  const { privateKey } = getEnvConfig();
  const account = privateKeyToAccount(toHexPrefixString(privateKey));

  const transport = http(process.env.BASE_RPC_URL);

  const walletClient = createWalletClient({
    account,
    chain: base,
    transport,
  });

  const publicClient = createPublicClient({
    chain: base,
    transport,
  });

  console.log(`\nWallet Address: ${account.address}`);
  console.log(`USDC (Base): ${USDC.Base}`);
  console.log(`Withdraw Amount: ${formatUnits(WITHDRAW_AMOUNT, USDC_DECIMALS)} USDC`);

  // --- Resolve Morpho Vault Address ---
  const vaultAddress = await getVaultAddressByToken(USDC.Base, CHAIN_IDS.Base);

  if (!vaultAddress) {
    console.error("No Morpho vault found for USDC on Base.");
    process.exitCode = 1;
    return;
  }

  const vaultHex = toHexPrefixString(vaultAddress);
  console.log(`Morpho Vault Address: ${vaultAddress}`);

  // --- Check current deposited balance ---
  const vaultDecimals = await publicClient.readContract({
    address: vaultHex,
    abi: ERC4626_ABI,
    functionName: "decimals",
  } as any) as number;

  const sharesBefore = await publicClient.readContract({
    address: vaultHex,
    abi: ERC20_BALANCE_ABI,
    functionName: "balanceOf",
    args: [account.address],
  } as any) as bigint;

  if (sharesBefore === 0n) {
    console.error("\nNo shares in Morpho vault. Nothing to withdraw.");
    process.exitCode = 1;
    return;
  }

  const assetsBefore = await publicClient.readContract({
    address: vaultHex,
    abi: ERC4626_ABI,
    functionName: "convertToAssets",
    args: [sharesBefore],
  } as any) as bigint;

  console.log(`\nVault Shares (before): ${formatUnits(sharesBefore, vaultDecimals)}`);
  console.log(`Deposited USDC (before): ${formatUnits(assetsBefore, USDC_DECIMALS)} USDC`);

  if (assetsBefore < WITHDRAW_AMOUNT) {
    console.error(
      `\nInsufficient deposited balance. Have ${formatUnits(assetsBefore, USDC_DECIMALS)} USDC, want to withdraw ${formatUnits(WITHDRAW_AMOUNT, USDC_DECIMALS)} USDC.`,
    );
    process.exitCode = 1;
    return;
  }

  const usdcBefore = await publicClient.readContract({
    address: toHexPrefixString(USDC.Base),
    abi: ERC20_BALANCE_ABI,
    functionName: "balanceOf",
    args: [account.address],
  } as any) as bigint;

  console.log(`Wallet USDC (before): ${formatUnits(usdcBefore, USDC_DECIMALS)} USDC`);

  // --- Withdraw from Morpho Vault ---
  try {
    console.log(`\n--- Sending Withdraw Transaction ---`);
    console.log(`Withdrawing ${formatUnits(WITHDRAW_AMOUNT, USDC_DECIMALS)} USDC from Morpho Vault...`);

    const withdrawData = {
      abi: ERC4626_ABI,
      functionName: "withdraw" as const,
      args: [WITHDRAW_AMOUNT, account.address, account.address] as const,
    };

    const txHash = await walletClient.writeContract({
      address: vaultHex as `0x${string}`,
      ...withdrawData,
    });

    console.log(`Withdraw transaction sent!`);
    console.log(` --> Transaction Hash: ${txHash}`);
    console.log(` --> View on BaseScan: https://basescan.org/tx/${txHash}`);

    console.log("\nWaiting for transaction to be mined...");
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

    console.log(`\nWithdraw transaction mined!`);
    console.log(` Status: ${receipt.status === "success" ? "Success" : "Failed"}`);
    console.log(` Block number: ${receipt.blockNumber}`);
    console.log(` Gas used: ${receipt.gasUsed.toString()}`);

    if (receipt.status !== "success") {
      console.error("\nWithdraw transaction failed on-chain.");
      process.exitCode = 1;
      return;
    }
  } catch (error) {
    console.error("\nError sending or waiting for the withdraw transaction:");
    if (error instanceof Error) {
      console.error(` Message: ${error.message}`);
    } else {
      console.error(" An unexpected error occurred:", error);
    }
    process.exitCode = 1;
    return;
  }

  // --- Final Summary ---
  console.log("\n--- Morpho Withdraw Complete ---");

  // Wait for RPC to reflect the new state
  console.log("Waiting for RPC to update...");
  await new Promise((resolve) => setTimeout(resolve, 3000));

  const sharesAfter = await publicClient.readContract({
    address: vaultHex,
    abi: ERC20_BALANCE_ABI,
    functionName: "balanceOf",
    args: [account.address],
  } as any) as bigint;

  const assetsAfter = sharesAfter > 0n
    ? await publicClient.readContract({
        address: vaultHex,
        abi: ERC4626_ABI,
        functionName: "convertToAssets",
        args: [sharesAfter],
      } as any) as bigint
    : 0n;

  const usdcAfter = await publicClient.readContract({
    address: toHexPrefixString(USDC.Base),
    abi: ERC20_BALANCE_ABI,
    functionName: "balanceOf",
    args: [account.address],
  } as any) as bigint;

  console.log(`Vault Shares (after): ${formatUnits(sharesAfter, vaultDecimals)}`);
  console.log(`Deposited USDC (after): ${formatUnits(assetsAfter, USDC_DECIMALS)} USDC`);
  console.log(`Wallet USDC (after): ${formatUnits(usdcAfter, USDC_DECIMALS)} USDC`);
  console.log(`USDC received: ${formatUnits(usdcAfter - usdcBefore, USDC_DECIMALS)} USDC`);

  console.log("\n--- Script finished ---");
}

main().catch((error) => {
  console.error("\nFATAL ERROR in script execution:", error);
  process.exitCode = 1;
});
