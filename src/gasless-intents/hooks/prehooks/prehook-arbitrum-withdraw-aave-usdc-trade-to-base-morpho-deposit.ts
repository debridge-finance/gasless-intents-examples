import { privateKeyToAccount } from "viem/accounts";
import util from "util";
import { randomUUID } from "crypto";

import { AAVE_V3_POOL_ARBITRUM, PLACEHOLDER_TOKEN_AMOUNT, USDC } from "@utils/constants";
import { toHexPrefixString, getEnvConfig } from "@utils/index";
import { getAaveWithdrawExtendedHook, getMorphoDepositExtendedHook } from "@utils/posthooks";
import { createBundle, submitBundle } from "@utils/api";
import { BundleProposeBody, ExtendedHook, PlaceHolder, TradingAlgorithm } from "../../types";
import { getArbitrumUsdcToBaseUsdc } from "../../trades";
import { processIntentBundle } from "@utils/signatures/intent-signatures";
import { getChainIdToWalletClientMap } from "@utils/wallet";
import { CHAIN_IDS } from "@utils/chains";
import { getVaultAddressByToken } from "@utils/morpho/get-vault-address";
import { createApproveCall } from "@utils/contract-calls";
import { replaceNamedPlaceholders } from "@utils/hooks-common";

async function main() {
  const { privateKey } = getEnvConfig();

  const account = privateKeyToAccount(toHexPrefixString(privateKey));

  const chainIdToWalletClientMap = getChainIdToWalletClientMap(account);

  const amountToRebalance = "3204714"; // 3.204714 USDC with 6 decimals - this is the amount that will be withdrawn from Aave in the pre-hook and swapped to ETH, adjust as needed

  const arbitrumUsdcAaveWithdraw = await getAaveWithdrawExtendedHook(
    AAVE_V3_POOL_ARBITRUM,
    toHexPrefixString(USDC.Arbitrum),
    CHAIN_IDS.Arbitrum,
    account.address,
    "aaveDepositAmount",
    BigInt(amountToRebalance),
  );

  const morphoDeposit = await getMorphoDepositExtendedHook(
    toHexPrefixString(USDC.Base),
    CHAIN_IDS.Base,
    account.address,
    "morphoDepositAmount",
  );

  const morphoVaultAddress = await getVaultAddressByToken(USDC.Base, CHAIN_IDS.Base);

  if (!morphoVaultAddress) {
    throw new Error(`No Morpho vault found for ${USDC.Base} on ${CHAIN_IDS.Base}`);
  }

  const approveUsdcForMorphoCall = createApproveCall(
    toHexPrefixString(USDC.Base),
    toHexPrefixString(morphoVaultAddress), // Morpho Aave V3 on Base - https://docs.morpho.xyz/deployment-addresses#base
    BigInt(PLACEHOLDER_TOKEN_AMOUNT),
  );

  const placeholderMorphoDeposit: PlaceHolder = {
    nameVariable: "morphoApproveAmount",
    tokenAddress: USDC.Base,
    address: account.address,
  }

  approveUsdcForMorphoCall.data = replaceNamedPlaceholders(approveUsdcForMorphoCall.data, [placeholderMorphoDeposit.nameVariable]);

  const approveMorphoDepositHook: ExtendedHook = {
    isAtomic: true,
    data: approveUsdcForMorphoCall.data,
    to: approveUsdcForMorphoCall.to,
    value: approveUsdcForMorphoCall.value.toString(),
    chainId: CHAIN_IDS.Base,
    from: account.address,
    placeHolders: [placeholderMorphoDeposit]
  }

  const requestId = randomUUID();

  const requestBody: BundleProposeBody = {
    requestId,
    referralCode: 110000002,
    expirationTimestamp: Math.floor((new Date().getTime() * 2) / 1000),
    enableAccountAbstraction: true,
    isAtomic: true,
    tradingAlgorithm: TradingAlgorithm.MARKET,
    trades: [getArbitrumUsdcToBaseUsdc(account.address, amountToRebalance)],
    preHooks: [arbitrumUsdcAaveWithdraw],
    postHooks: [approveMorphoDepositHook, morphoDeposit],
  };

  console.log("Creating bundle...");
  const bundle = await createBundle(requestBody);

  console.log(JSON.stringify(bundle, null, 2));
  console.log("Bundle created successfully!");

  // Log the first intent for debugging
  if (bundle.intents && bundle.intents.length > 0) {
    console.log("First intent:", util.inspect(bundle.intents[0], { showHidden: false, depth: null, colors: true }));
  }

  // Using processIntentBundle to handle all intents at once
  console.log("Collecting signatures for all intents...");
  const signedDataArray = await processIntentBundle(bundle, chainIdToWalletClientMap);

  console.log(`Generated ${signedDataArray.length} signatures for ${bundle.intents?.length || 0} intents`);

  // Prepare the bundle with signatures - but don't submit yet
  const submitPayload = {
    ...bundle,
    referralCode: 110000002,
    requestId: requestBody.requestId,
    enableAccountAbstraction: true,
    isAtomic: true,
    signedData: signedDataArray,
  };

  console.log("Payload prepared with signatures. Ready for submission.");

  const submitResponse = await submitBundle(submitPayload);
  console.log("Submit response:", submitResponse);

  return submitPayload;
}

main().catch((error) => {
  console.error("\n🚨 FATAL ERROR in script execution:", error);
  process.exitCode = 1;
});
