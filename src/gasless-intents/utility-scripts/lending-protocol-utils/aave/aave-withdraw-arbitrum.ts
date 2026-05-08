import "dotenv/config";
import { createWalletClient, createPublicClient, http, formatUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arbitrum } from "viem/chains";
import { createAaveWithdrawCall } from "@utils/contract-calls";
import { AAVE_V3_POOL_ARBITRUM, USDC } from "@utils/constants";
import { getEnvConfig, toHexPrefixString } from "@utils/index";
import { Erc20Abi } from "@utils/abis";

const USDC_DECIMALS = 6;
const WITHDRAW_AMOUNT = BigInt("1000000"); // 1 USDC

// aUSDC (Aave Arbitrum USDC) — the aToken minted when depositing USDC into AAVE V3 on Arbitrum
const AUSDC_ARBITRUM = "0x724dc807b04555b71ed48a6896b6F41593b8C637";

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
  console.log(`aUSDC (Arbitrum): ${AUSDC_ARBITRUM}`);
  console.log(`Withdraw Amount: ${formatUnits(WITHDRAW_AMOUNT, USDC_DECIMALS)} USDC`);

  // --- Check aUSDC balance (deposited amount) ---
  const aUsdcBalance = await publicClient.readContract({
    address: toHexPrefixString(AUSDC_ARBITRUM),
    abi: Erc20Abi.Balance,
    functionName: "balanceOf",
    args: [account.address],
  } as any) as bigint;

  console.log(`\nAAVE Deposited USDC (aUSDC balance): ${formatUnits(aUsdcBalance, USDC_DECIMALS)} USDC`);

  if (aUsdcBalance < WITHDRAW_AMOUNT) {
    console.error(
      `\nInsufficient aUSDC balance. Have ${formatUnits(aUsdcBalance, USDC_DECIMALS)}, want to withdraw ${formatUnits(WITHDRAW_AMOUNT, USDC_DECIMALS)}.`,
    );
    process.exitCode = 1;
    return;
  }

  const usdcBefore = await publicClient.readContract({
    address: toHexPrefixString(USDC.Arbitrum),
    abi: Erc20Abi.Balance,
    functionName: "balanceOf",
    args: [account.address],
  } as any) as bigint;

  console.log(`Wallet USDC (before): ${formatUnits(usdcBefore, USDC_DECIMALS)} USDC`);

  // --- Withdraw USDC from AAVE V3 ---
  try {
    console.log(`\n--- Sending AAVE Withdraw Transaction ---`);
    console.log(`Withdrawing ${formatUnits(WITHDRAW_AMOUNT, USDC_DECIMALS)} USDC from AAVE V3...`);

    const withdrawCall = createAaveWithdrawCall(
      toHexPrefixString(AAVE_V3_POOL_ARBITRUM),
      toHexPrefixString(USDC.Arbitrum),
      WITHDRAW_AMOUNT,
      account.address,
    );

    const txHash = await walletClient.sendTransaction({
      account,
      chain: arbitrum,
      to: withdrawCall.to as `0x${string}`,
      data: withdrawCall.data as `0x${string}`,
      value: withdrawCall.value,
    } as any);

    console.log(`Withdraw transaction sent!`);
    console.log(` --> Transaction Hash: ${txHash}`);
    console.log(` --> View on Arbiscan: https://arbiscan.io/tx/${txHash}`);

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
  console.log("\n--- AAVE Withdraw Complete ---");

  // Wait for RPC to reflect the new state
  await new Promise((resolve) => setTimeout(resolve, 3000));

  const aUsdcAfter = await publicClient.readContract({
    address: toHexPrefixString(AUSDC_ARBITRUM),
    abi: Erc20Abi.Balance,
    functionName: "balanceOf",
    args: [account.address],
  } as any) as bigint;

  const usdcAfter = await publicClient.readContract({
    address: toHexPrefixString(USDC.Arbitrum),
    abi: Erc20Abi.Balance,
    functionName: "balanceOf",
    args: [account.address],
  } as any) as bigint;

  console.log(`AAVE Deposited USDC (after): ${formatUnits(aUsdcAfter, USDC_DECIMALS)} USDC`);
  console.log(`Wallet USDC (after): ${formatUnits(usdcAfter, USDC_DECIMALS)} USDC`);
  console.log(`USDC received: ${formatUnits(usdcAfter - usdcBefore, USDC_DECIMALS)} USDC`);

  console.log("\n--- Script finished ---");
}

main().catch((error) => {
  console.error("\nFATAL ERROR in script execution:", error);
  process.exitCode = 1;
});
