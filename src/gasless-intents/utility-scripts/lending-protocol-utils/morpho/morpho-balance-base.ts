import "dotenv/config";
import { createPublicClient, http, formatUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";
import { USDC } from "@utils/constants";
import { CHAIN_IDS } from "@utils/chains";
import { getVaultAddressByToken } from "@utils/morpho/get-vault-address";
import { getEnvConfig, toHexPrefixString } from "@utils/index";
import { Erc20Abi, Erc4626Abi } from "@utils/abis";

const USDC_DECIMALS = 6;

async function main() {
  const { privateKey } = getEnvConfig();
  const account = privateKeyToAccount(toHexPrefixString(privateKey));

  const publicClient = createPublicClient({
    chain: base,
    transport: http(process.env.BASE_RPC_URL),
  });

  console.log(`\nWallet Address: ${account.address}`);
  console.log(`USDC (Base): ${USDC.Base}`);

  // --- Resolve Morpho Vault Address ---
  const vaultAddress = await getVaultAddressByToken(USDC.Base, CHAIN_IDS.Base);

  if (!vaultAddress) {
    console.error("No Morpho vault found for USDC on Base.");
    process.exitCode = 1;
    return;
  }

  console.log(`Morpho Vault Address: ${vaultAddress}`);

  // --- Vault Share Balance ---
  const vaultDecimals = await publicClient.readContract({
    address: toHexPrefixString(vaultAddress),
    abi: Erc4626Abi.Decimals,
    functionName: "decimals",
  } as any) as number;

  const shares = await publicClient.readContract({
    address: toHexPrefixString(vaultAddress),
    abi: Erc20Abi.Balance,
    functionName: "balanceOf",
    args: [account.address],
  } as any) as bigint;

  console.log(`\nMorpho Vault Shares: ${formatUnits(shares, vaultDecimals)}`);

  // --- Convert Shares to Underlying USDC ---
  if (shares > 0n) {
    const assets = await publicClient.readContract({
      address: toHexPrefixString(vaultAddress),
      abi: Erc4626Abi.ConvertToAssets,
      functionName: "convertToAssets",
      args: [shares],
    } as any) as bigint;

    console.log(`Morpho Deposited USDC (converted from shares): ${formatUnits(assets, USDC_DECIMALS)} USDC`);
  } else {
    console.log(`Morpho Deposited USDC (converted from shares): 0 USDC`);
  }

  // --- Wallet USDC Balance for reference ---
  const usdcBalance = await publicClient.readContract({
    address: toHexPrefixString(USDC.Base),
    abi: Erc20Abi.Balance,
    functionName: "balanceOf",
    args: [account.address],
  } as any) as bigint;

  console.log(`Wallet USDC Balance: ${formatUnits(usdcBalance, USDC_DECIMALS)} USDC`);

  console.log("\n--- Done ---");
}

main().catch((error) => {
  console.error("\nFATAL ERROR in script execution:", error);
  process.exitCode = 1;
});
