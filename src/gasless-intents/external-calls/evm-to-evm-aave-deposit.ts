import { Address, encodeFunctionData, parseAbi, parseUnits } from "viem";

import {
  privateKeyToAccount
} from 'viem/accounts'
import { clipHexPrefix } from "@utils/string";
import { getEnvConfig } from "@utils/env";
import { createBundle, submitBundle } from '@utils/gasless-api';
import { processIntentBundle } from '@utils/signatures/intent-signatures';
import { randomUUID } from 'crypto';


import { Bundle, BundleProposeBody, DlnHook, DlnHookType, Trade, TradingAlgorithm } from "@gasless-intents/types";
import { getChainIdToWalletClientMap } from '@utils/wallet';
import { CHAIN_IDS } from '@utils/chains';
import { USDC, AAVE_V3_POOL_ARBITRUM } from '@utils/constants';

// Swaps USDC from Polygon to Arbitrum and, during the fill itself, deposits part of
// the outcome into Aave v3 on behalf of the sender via an external call (dlnHook).

const USDC_DECIMALS = 6;

// The exact fill amount is unknown when the calldata is encoded (the trade's output
// is "auto", and dlnHook payloads have no placeholder substitution), so supply a
// fixed amount safely below the worst-case fill. The Universal Hook sweeps the
// un-pulled remainder to the fallback address (the trade's dstChainAuthorityAddress).
const SUPPLY_AMOUNT = parseUnits("0.3", USDC_DECIMALS);

const AAVE_POOL_ABI = parseAbi([
  "function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode)",
]);

function generateAaveSupplyCalldata(onBehalfOfAddress: Address): string {
  const aaveReferralCode = 0;

  const calldata = encodeFunctionData({
    abi: AAVE_POOL_ABI,
    functionName: "supply",
    args: [USDC.Arbitrum as Address, SUPPLY_AMOUNT, onBehalfOfAddress, aaveReferralCode],
  });

  console.log("\n--- Aave Pool Supply Calldata ---");
  console.log("Target Contract Address:", AAVE_V3_POOL_ARBITRUM);
  console.log("Calldata:", calldata);

  return calldata;
}

async function main() {
  // Wallet setup
  const { privateKey } = getEnvConfig();

  const account = privateKeyToAccount(`0x${clipHexPrefix(privateKey)}`);

  const chainIdToWalletClientMap = getChainIdToWalletClientMap(account);

  const requestId = randomUUID();

  const depositToAave: DlnHook = {
    type: DlnHookType.EvmTransactionCall,
    data: {
      to: AAVE_V3_POOL_ARBITRUM,
      calldata: generateAaveSupplyCalldata(account.address),
      gas: 0
    }
  };

  const usdcPolyToUsdcArbitrum: Trade = {
    srcChainId: CHAIN_IDS.Polygon,
    srcChainTokenIn: USDC.Polygon,
    srcChainTokenInAmount: "2300000", // 2.3 USDC
    srcChainAuthorityAddress: account.address,
    dstChainId: CHAIN_IDS.Arbitrum,
    dstChainTokenOut: USDC.Arbitrum,
    dstChainTokenOutAmount: "auto",
    dstChainTokenOutRecipient: account.address,
    dstChainAuthorityAddress: account.address,
    prependOperatingExpenses: true,
    dlnHook: JSON.stringify(depositToAave)
  }

  // Trades body
  const requestBody: BundleProposeBody = {
    requestId,
    referralCode: 110000002,
    expirationTimestamp: Math.floor(new Date().getTime() * 2 / 1000),
    enableAccountAbstraction: true,
    isAtomic: true,
    tradingAlgorithm: TradingAlgorithm.MARKET,
    trades: [usdcPolyToUsdcArbitrum],
    postHooks: [],
  }


  console.log("Creating bundle...");
  const bundle = await createBundle(requestBody);
  console.log(JSON.stringify(bundle, null, 2));
  console.log("Bundle created successfully!");

  // The hash of the serialized external call — part of the constraints being signed
  // and the tail of the deterministic DLN orderId.
  console.log("externalCallHash:", bundle.intents?.[0]?.intent.externalCallHash);

  // Using processIntentBundle to handle all intents at once
  console.log("Collecting signatures for all intents...");
  const signedDataArray = await processIntentBundle(bundle, chainIdToWalletClientMap);

  console.log(`Generated ${signedDataArray.length} signatures for ${bundle.intents?.length || 0} intents`);

  // Prepare the bundle with intent signatures for submission
  const submitPayload: Bundle = {
    ...bundle,
    requestId: requestBody.requestId,
    enableAccountAbstraction: true,
    isAtomic: true,
    signedData: signedDataArray
  };

  console.log("Payload prepared with signatures. Ready for submission.");

  const submitResponse = await submitBundle(submitPayload);
  console.log("Submit response:", submitResponse);

  return submitPayload;
}

// Execute main function and catch any top-level errors
main().catch((error) => {
  console.error("\n🚨 FATAL ERROR in script execution:", error);
  process.exitCode = 1;
});
