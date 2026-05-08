import "dotenv/config";
import { createWalletClient, createPublicClient, http, formatUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";
import { createApproveCall, createDepositCall } from "@utils/contract-calls";
import { USDC } from "@utils/constants";
import { getEnvConfig, toHexPrefixString } from "@utils/index";
import { getVaultAddressByToken } from "@utils/morpho/get-vault-address";
import { CHAIN_IDS } from "@utils/chains";
import { Erc20Abi, Erc4626Abi } from "@utils/abis";

const USDC_DECIMALS = 6;
const DEPOSIT_AMOUNT = BigInt("1000000"); // Default: 1 USDC

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
  console.log(`Deposit Amount: ${formatUnits(DEPOSIT_AMOUNT, USDC_DECIMALS)} USDC`);

  // --- Resolve Morpho Vault Address ---
  console.log("\n--- Resolving Morpho Vault ---");
  const vaultAddress = await getVaultAddressByToken(USDC.Base, CHAIN_IDS.Base);

  if (!vaultAddress) {
    console.error("No Morpho vault found for USDC on Base.");
    process.exitCode = 1;
    return;
  }

  console.log(`Morpho Vault Address: ${vaultAddress}`);

  // --- Check USDC Balance ---
  const usdcBalance = await publicClient.readContract({
    address: toHexPrefixString(USDC.Base),
    abi: Erc20Abi.Balance,
    functionName: "balanceOf",
    args: [account.address],
  } as any) as bigint;

  console.log(`\nCurrent USDC Balance: ${formatUnits(usdcBalance, USDC_DECIMALS)} USDC`);

  if (usdcBalance < DEPOSIT_AMOUNT) {
    console.error(
      `\nInsufficient USDC balance. Have ${formatUnits(usdcBalance, USDC_DECIMALS)}, need ${formatUnits(DEPOSIT_AMOUNT, USDC_DECIMALS)}.`,
    );
    process.exitCode = 1;
    return;
  }

  // --- Check Vault Share Balance (before) ---
  const vaultDecimals = await publicClient.readContract({
    address: toHexPrefixString(vaultAddress),
    abi: Erc4626Abi.Decimals,
    functionName: "decimals",
  } as any) as number;

  const sharesBefore = await publicClient.readContract({
    address: toHexPrefixString(vaultAddress),
    abi: Erc20Abi.Balance,
    functionName: "balanceOf",
    args: [account.address],
  } as any) as bigint;

  console.log(`Vault Shares (before): ${formatUnits(sharesBefore, vaultDecimals)}`);

  // Get current nonce upfront to avoid race conditions between sequential txs
  let nonce = await publicClient.getTransactionCount({ address: account.address });

  // --- Tx 1: Approve USDC to Morpho Vault ---
  try {
    console.log("\n--- Sending Approve Transaction ---");
    console.log(`Approving ${formatUnits(DEPOSIT_AMOUNT, USDC_DECIMALS)} USDC to Morpho Vault...`);

    const approveCall = createApproveCall(
      toHexPrefixString(USDC.Base),
      toHexPrefixString(vaultAddress),
      DEPOSIT_AMOUNT,
    );

    const approveTxHash = await walletClient.sendTransaction({
      account,
      chain: base,
      to: approveCall.to as `0x${string}`,
      data: approveCall.data as `0x${string}`,
      value: approveCall.value!,
      nonce: nonce++,
    } as any);

    console.log(`Approve transaction sent!`);
    console.log(` --> Transaction Hash: ${approveTxHash}`);
    console.log(` --> View on BaseScan: https://basescan.org/tx/${approveTxHash}`);

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

  // --- Tx 2: Deposit USDC into Morpho Vault ---
  // Wait for RPC state to reflect the approval
  await new Promise((resolve) => setTimeout(resolve, 3000));

  try {
    console.log("\n--- Sending Morpho Deposit Transaction ---");
    console.log(`Depositing ${formatUnits(DEPOSIT_AMOUNT, USDC_DECIMALS)} USDC into Morpho Vault...`);

    const depositCall = createDepositCall(
      toHexPrefixString(vaultAddress),
      DEPOSIT_AMOUNT,
      account.address,
    );

    const depositTxHash = await walletClient.sendTransaction({
      account,
      chain: base,
      to: depositCall.to as `0x${string}`,
      data: depositCall.data as `0x${string}`,
      value: depositCall.value!,
      nonce: nonce++,
    } as any);

    console.log(`Deposit transaction sent!`);
    console.log(` --> Transaction Hash: ${depositTxHash}`);
    console.log(` --> View on BaseScan: https://basescan.org/tx/${depositTxHash}`);

    console.log("\nWaiting for deposit transaction to be mined...");
    const depositReceipt = await publicClient.waitForTransactionReceipt({ hash: depositTxHash });

    console.log(`\nDeposit transaction mined!`);
    console.log(` Status: ${depositReceipt.status === "success" ? "Success" : "Failed"}`);
    console.log(` Block number: ${depositReceipt.blockNumber}`);
    console.log(` Gas used: ${depositReceipt.gasUsed.toString()}`);

    if (depositReceipt.status !== "success") {
      console.error("\nDeposit transaction failed on-chain.");
      process.exitCode = 1;
      return;
    }
  } catch (error) {
    console.error("\nError sending or waiting for the deposit transaction:");
    if (error instanceof Error) {
      console.error(` Message: ${error.message}`);
    } else {
      console.error(" An unexpected error occurred:", error);
    }
    process.exitCode = 1;
    return;
  }

  // --- Final Summary ---
  console.log("\n--- Morpho Deposit Complete ---");
  console.log(`Successfully deposited ${formatUnits(DEPOSIT_AMOUNT, USDC_DECIMALS)} USDC into Morpho Vault on Base.`);

  const sharesAfter = await publicClient.readContract({
    address: toHexPrefixString(vaultAddress),
    abi: Erc20Abi.Balance,
    functionName: "balanceOf",
    args: [account.address],
  } as any) as bigint;

  const newUsdcBalance = await publicClient.readContract({
    address: toHexPrefixString(USDC.Base),
    abi: Erc20Abi.Balance,
    functionName: "balanceOf",
    args: [account.address],
  } as any) as bigint;

  console.log(`Vault Shares (after): ${formatUnits(sharesAfter, vaultDecimals)}`);
  console.log(`Shares gained: ${formatUnits(sharesAfter - sharesBefore, vaultDecimals)}`);
  console.log(`Updated USDC Balance: ${formatUnits(newUsdcBalance, USDC_DECIMALS)} USDC`);
  console.log("\n--- Script finished ---");
}

main().catch((error) => {
  console.error("\nFATAL ERROR in script execution:", error);
  process.exitCode = 1;
});
