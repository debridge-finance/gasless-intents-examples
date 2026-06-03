import { privateKeyToAccount } from "viem/accounts";

import { randomUUID } from 'crypto';

import { USDC } from '@utils/constants';
import { toHexPrefixString } from "@utils/string";
import { getEnvConfig } from "@utils/env";
import { createBundle, submitBundle } from '@utils/gasless-api';
import { BundleProposeBody, TradingAlgorithm } from "@gasless-intents/types";
import { getPolygonUsdcToBaseUsdc, getPolyMaticToBaseUsdc } from "@gasless-intents/trade-blueprints";
import { processIntentBundle } from '@utils/signatures/intent-signatures';
import { getChainIdToWalletClientMap } from '@utils/wallet';
import { CHAIN_IDS } from "@utils/chains";
import { getVaultAddressByToken } from "@utils/morpho/get-vault-address";
import { getMorphoDepositHook } from "@utils/hooks/morpho";
import { getApproveHook } from "@utils/hooks/erc20-hooks";

/**
 * Example result:
 * https://anchorage.debridge.com/bundle/0x11f4cc86d5ee4323af54ab740f11b3aa4ebde88116780de9a7439953e7b99344
 */
async function main() {
  const { privateKey } = getEnvConfig();

  const account = privateKeyToAccount(toHexPrefixString(privateKey));

  const chainIdToWalletClientMap = getChainIdToWalletClientMap(account);

  const baseUsdcMorphoDeposit = await getMorphoDepositHook(
    toHexPrefixString(USDC.Base),
    CHAIN_IDS.Base,
    account.address,
    account.address
  );

  const morphoVaultAddress = await getVaultAddressByToken(USDC.Base, CHAIN_IDS.Base);

  if (!morphoVaultAddress) {
    throw new Error(`No Morpho vault found for ${USDC.Base} on ${CHAIN_IDS.Base}`);
  }

  const approveMorphoDepositHook = getApproveHook(
    account.address,
    USDC.Base,
    CHAIN_IDS.Base,
    morphoVaultAddress
  )

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