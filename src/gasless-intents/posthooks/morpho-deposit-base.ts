import { privateKeyToAccount } from "viem/accounts";
import util from "util"
import { randomUUID } from 'crypto';

import { PLACEHOLDER_TOKEN_AMOUNT, USDC } from '@utils/constants';
import { toHexPrefixString, getEnvConfig } from '@utils/index';
import { getMorphoDepositExtendedHook } from '@utils/posthooks';
import { createBundle, submitBundle } from '@utils/api';
import { BundleProposeBody, ExtendedHook, PlaceHolder, TradingAlgorithm } from "../types";
import { getPolygonUsdcToBaseUsdc, getPolyMaticToBaseUsdc } from "../trades";
import { processIntentBundle } from '@utils/signatures/intent-signatures';
import { getChainIdToWalletClientMap } from '@utils/wallet';
import { CHAIN_IDS } from "@utils/chains";
import { createApproveCall } from "@utils/contract-calls";
import { replaceNamedPlaceholders } from "@utils/hooks-common";
import { getVaultAddressByToken } from "@utils/morpho/get-vault-address";

async function main() {
  const { privateKey } = getEnvConfig();

  const account = privateKeyToAccount(toHexPrefixString(privateKey));

  const chainIdToWalletClientMap = getChainIdToWalletClientMap(account);

  const baseUsdcMorphoDeposit = await getMorphoDepositExtendedHook(
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
    toHexPrefixString(morphoVaultAddress),
    BigInt(PLACEHOLDER_TOKEN_AMOUNT),
  );

  const morphoApprovePlaceholder: PlaceHolder = {
    nameVariable: "morphoApproveAmount",
    tokenAddress: USDC.Base,
    address: account.address,
  };

  approveUsdcForMorphoCall.data = replaceNamedPlaceholders(
    approveUsdcForMorphoCall.data,
    [morphoApprovePlaceholder.nameVariable],
  );

  const approveMorphoDepositHook: ExtendedHook = {
    isAtomic: true,
    data: approveUsdcForMorphoCall.data,
    to: approveUsdcForMorphoCall.to,
    value: approveUsdcForMorphoCall.value.toString(),
    chainId: CHAIN_IDS.Base,
    from: account.address,
    placeHolders: [morphoApprovePlaceholder],
  };

  console.log("Deposit Call PostHook Calldata:", baseUsdcMorphoDeposit);

  const requestId = randomUUID();

  const requestBody: BundleProposeBody = {
    requestId,
    referralCode: 110000002,
    expirationTimestamp: Math.floor(new Date().getTime() * 2 / 1000),
    enableAccountAbstraction: true,
    isAtomic: true,
    tradingAlgorithm: TradingAlgorithm.MARKET,
    trades: [
      getPolygonUsdcToBaseUsdc(account.address),
      getPolyMaticToBaseUsdc(account.address),
    ],
    postHooks: [approveMorphoDepositHook, baseUsdcMorphoDeposit],
  }

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

  // Prepare the bundle with intent signatures for submission
  const submitPayload = {
    ...bundle,
    referralCode: 110000002,
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

main().catch((error) => {
  console.error("\n🚨 FATAL ERROR in script execution:", error);
  process.exitCode = 1;
});