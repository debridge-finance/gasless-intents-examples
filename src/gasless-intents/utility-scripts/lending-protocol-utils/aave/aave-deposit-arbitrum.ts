import "dotenv/config";
import { createWalletClient, createPublicClient, http, formatUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arbitrum } from "viem/chains";
import { createApproveCall, createAaveSupplyCall } from "@utils/contract-calls";
import { AAVE_V3_POOL_ARBITRUM, USDC } from "@utils/constants";
import { getEnvConfig, toHexPrefixString } from "@utils/index";
import { Erc20Abi } from "@utils/abis";

const USDC_DECIMALS = 6;
const SUPPLY_AMOUNT = BigInt(process.env.USDC_AMOUNT || "1000000"); // Default: 1 USDC

async function main() {
  const { privateKey } = getEnvConfig();
  const account = privateKeyToAccount(toHexPrefixString(privateKey));

  const transport = http(process.env.ARB_RPC_URL);

  const walletClient = createWalletClient({
    account,
    chain: arbitrum,
    transport,
  });

  const publicClient = createPublicClient({
    chain: arbitrum,
    transport,
  });

  console.log(`\nWallet Address: ${account.address}`);
  console.log(`AAVE V3 Pool: ${AAVE_V3_POOL_ARBITRUM}`);
  console.log(`USDC (Arbitrum): ${USDC.Arbitrum}`);
  console.log(`Supply Amount: ${formatUnits(SUPPLY_AMOUNT, USDC_DECIMALS)} USDC`);

  // Get current nonce upfront to avoid race conditions between sequential txs
  let nonce = await publicClient.getTransactionCount({ address: account.address });

  // --- Check USDC Balance ---
  const usdcBalance = await publicClient.readContract({
    address: toHexPrefixString(USDC.Arbitrum),
    abi: Erc20Abi.Balance,
    functionName: "balanceOf",
    args: [account.address],
  } as any) as bigint;

  console.log(`\nCurrent USDC Balance: ${formatUnits(usdcBalance, USDC_DECIMALS)} USDC`);

  if (usdcBalance < SUPPLY_AMOUNT) {
    console.error(
      `\nInsufficient USDC balance. Have ${formatUnits(usdcBalance, USDC_DECIMALS)}, need ${formatUnits(SUPPLY_AMOUNT, USDC_DECIMALS)}.`,
    );
    process.exitCode = 1;
    return;
  }

  // --- Tx 1: Approve USDC to AAVE V3 Pool ---
  try {
    console.log("\n--- Sending Approve Transaction ---");
    console.log(`Approving ${formatUnits(SUPPLY_AMOUNT, USDC_DECIMALS)} USDC to AAVE V3 Pool...`);

    const approveCall = createApproveCall(
      toHexPrefixString(USDC.Arbitrum),
      toHexPrefixString(AAVE_V3_POOL_ARBITRUM),
      SUPPLY_AMOUNT,
    );

    const approveTxHash = await walletClient.sendTransaction({
      account,
      chain: arbitrum,
      to: approveCall.to as `0x${string}`,
      data: approveCall.data as `0x${string}`,
      value: approveCall.value!,
      nonce: nonce++,
    } as any);

    console.log(`Approve transaction sent!`);
    console.log(` --> Transaction Hash: ${approveTxHash}`);
    console.log(` --> View on Arbiscan: https://arbiscan.io/tx/${approveTxHash}`);

    console.log("\nWaiting for approve transaction to be mined...");
    const approveReceipt = await publicClient.waitForTransactionReceipt({ hash: approveTxHash });

    console.log(`\nApprove transaction mined!`);
    console.log(` Status: ${approveReceipt.status === "success" ? "Success" : "Failed"}`);
    console.log(` Block number: ${approveReceipt.blockNumber}`);
    console.log(` Gas used: ${approveReceipt.gasUsed.toString()}`);

    if (approveReceipt.status !== "success") {
      console.error("\nApproval transaction failed on-chain. Aborting deposit.");
      process.exitCode = 1;
      return;
    }
  } catch (error) {
    console.error("\nError sending or waiting for the approve transaction:");
    if (error instanceof Error) {
      console.error(` Message: ${error.message}`);
    } else {
      console.error(" An unexpected error occurred:", error);
    }
    process.exitCode = 1;
    return;
  }

  // --- Tx 2: Supply USDC to AAVE V3 ---
  try {
    console.log("\n--- Sending AAVE Supply Transaction ---");
    console.log(`Supplying ${formatUnits(SUPPLY_AMOUNT, USDC_DECIMALS)} USDC to AAVE V3 on behalf of ${account.address}...`);

    const supplyCall = createAaveSupplyCall(
      toHexPrefixString(AAVE_V3_POOL_ARBITRUM),
      toHexPrefixString(USDC.Arbitrum),
      SUPPLY_AMOUNT,
      account.address,
      0, // referralCode
    );

    const supplyTxHash = await walletClient.sendTransaction({
      account,
      chain: arbitrum,
      to: supplyCall.to as `0x${string}`,
      data: supplyCall.data as `0x${string}`,
      value: supplyCall.value,
      nonce: nonce++,
    } as any);

    console.log(`Supply transaction sent!`);
    console.log(` --> Transaction Hash: ${supplyTxHash}`);
    console.log(` --> View on Arbiscan: https://arbiscan.io/tx/${supplyTxHash}`);

    console.log("\nWaiting for supply transaction to be mined...");
    const supplyReceipt = await publicClient.waitForTransactionReceipt({ hash: supplyTxHash });

    console.log(`\nSupply transaction mined!`);
    console.log(` Status: ${supplyReceipt.status === "success" ? "Success" : "Failed"}`);
    console.log(` Block number: ${supplyReceipt.blockNumber}`);
    console.log(` Gas used: ${supplyReceipt.gasUsed.toString()}`);

    if (supplyReceipt.status !== "success") {
      console.error("\nSupply transaction failed on-chain.");
      process.exitCode = 1;
      return;
    }
  } catch (error) {
    console.error("\nError sending or waiting for the supply transaction:");
    if (error instanceof Error) {
      console.error(` Message: ${error.message}`);
    } else {
      console.error(" An unexpected error occurred:", error);
    }
    process.exitCode = 1;
    return;
  }

  // --- Final Summary ---
  console.log("\n--- AAVE Deposit Complete ---");
  console.log(`Successfully deposited ${formatUnits(SUPPLY_AMOUNT, USDC_DECIMALS)} USDC to AAVE V3 on Arbitrum.`);

  // Check updated balance
  const newBalance = await publicClient.readContract({
    address: toHexPrefixString(USDC.Arbitrum),
    abi: Erc20Abi.Balance,
    functionName: "balanceOf",
    args: [account.address],
  } as any) as bigint;

  console.log(`Updated USDC Balance: ${formatUnits(newBalance, USDC_DECIMALS)} USDC`);
  console.log("\n--- Script finished ---");
}

main().catch((error) => {
  console.error("\nFATAL ERROR in script execution:", error);
  process.exitCode = 1;
});
