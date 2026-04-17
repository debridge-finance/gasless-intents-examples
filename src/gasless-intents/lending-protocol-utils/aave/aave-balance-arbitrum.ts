import "dotenv/config";
import { createPublicClient, http, formatUnits, parseAbi } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arbitrum } from "viem/chains";
import { AAVE_V3_POOL_ARBITRUM, USDC } from "@utils/constants";
import { getEnvConfig, toHexPrefixString } from "../../../utils";

const USDC_DECIMALS = 6;

// aUSDC (Aave Arbitrum USDC) — the aToken minted when depositing USDC into AAVE V3 on Arbitrum
const AUSDC_ARBITRUM = "0x724dc807b04555b71ed48a6896b6F41593b8C637";

const ERC20_BALANCE_ABI = parseAbi([
  "function balanceOf(address account) view returns (uint256)",
]);

async function main() {
  const { privateKey } = getEnvConfig();
  const account = privateKeyToAccount(toHexPrefixString(privateKey));

  const publicClient = createPublicClient({
    chain: arbitrum,
    transport: http(process.env.ARB_RPC_URL),
  });

  console.log(`\nWallet Address: ${account.address}`);
  console.log(`AAVE V3 Pool: ${AAVE_V3_POOL_ARBITRUM}`);
  console.log(`USDC (Arbitrum): ${USDC.Arbitrum}`);
  console.log(`aUSDC (Arbitrum): ${AUSDC_ARBITRUM}`);

  // --- AAVE Deposited Balance (aUSDC) ---
  const aUsdcBalance = await publicClient.readContract({
    address: toHexPrefixString(AUSDC_ARBITRUM),
    abi: ERC20_BALANCE_ABI,
    functionName: "balanceOf",
    args: [account.address],
  } as any) as bigint;

  console.log(`\nAAVE V3 Deposited USDC (aUSDC balance): ${formatUnits(aUsdcBalance, USDC_DECIMALS)} USDC`);

  // --- Wallet USDC Balance for reference ---
  const usdcBalance = await publicClient.readContract({
    address: toHexPrefixString(USDC.Arbitrum),
    abi: ERC20_BALANCE_ABI,
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
