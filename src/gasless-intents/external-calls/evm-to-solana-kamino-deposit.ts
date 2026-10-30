import { randomUUID } from "crypto";

import { Connection, Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import { privateKeyToAccount } from "viem/accounts";

import { Bundle, BundleProposeBody, Trade, TradingAlgorithm } from "@gasless-intents/types";
import { CHAIN_IDS } from "@utils/chains";
import { DEBRIDGE_SOLANA_EXTERNAL_CALL, SOLANA_RPC_URL, USDC } from "@utils/constants";
import { getEnvConfig } from "@utils/env";
import { createBundle, submitBundle } from "@utils/gasless-api";
import { buildKaminoUsdcDepositDlnHook } from "@utils/solana/kamino";
import { processIntentBundle } from "@utils/signatures/intent-signatures";
import { toHexPrefixString } from "@utils/string";
import { getChainIdToWalletClientMap } from "@utils/wallet";

async function main() {
  const { privateKey, solPrivateKey } = getEnvConfig();
  const evmAccount = privateKeyToAccount(toHexPrefixString(privateKey));
  const solanaRecipient = Keypair.fromSecretKey(bs58.decode(solPrivateKey));
  const connection = new Connection(SOLANA_RPC_URL, "confirmed");
  const chainIdToWalletClientMap = getChainIdToWalletClientMap(evmAccount, solanaRecipient);

  console.log(`EVM source authority: ${evmAccount.address}`);
  console.log(`Solana cToken recipient: ${solanaRecipient.publicKey.toBase58()}`);

  const {
    hook,
    reserve,
    reserveLiquidityMint,
    reserveLiquiditySupply,
    reserveCollateralMint,
    recipientCollateralAta,
    recipientCollateralAtaExists,
    collateralTokenProgram,
    liquidityTokenProgram,
    serializedHookBytes,
  } = await buildKaminoUsdcDepositDlnHook({
    connection,
    recipient: solanaRecipient.publicKey,
  });

  console.log("\n--- Solana External Call ---");
  console.log("Kamino reserve:", reserve.address.toBase58());
  console.log("Reserve liquidity mint:", reserveLiquidityMint.toBase58());
  console.log("Reserve liquidity supply:", reserveLiquiditySupply.toBase58());
  console.log("Reserve collateral mint:", reserveCollateralMint.toBase58());
  console.log("Recipient cToken ATA:", recipientCollateralAta.toBase58());
  console.log("Recipient cToken ATA exists:", recipientCollateralAtaExists);
  console.log("Collateral token program:", collateralTokenProgram.toBase58());
  console.log("Liquidity token program:", liquidityTokenProgram.toBase58());
  console.log("Serialized dlnHook bytes:", serializedHookBytes);

  const requestId = randomUUID();

  const trade: Trade = {
    srcChainId: CHAIN_IDS.Polygon,
    srcChainTokenIn: USDC.Polygon,
    srcChainTokenInAmount: "2300000", // 2.3 USDC funds the Solana fill and external-call execution costs.
    srcChainAuthorityAddress: evmAccount.address,
    dstChainId: CHAIN_IDS.Solana,
    dstChainTokenOut: USDC.Solana,
    dstChainTokenOutAmount: "auto",
    dstChainTokenOutRecipient: DEBRIDGE_SOLANA_EXTERNAL_CALL.Executor,
    dstChainAuthorityAddress: solanaRecipient.publicKey.toBase58(),
    prependOperatingExpenses: true,
    dlnHook: JSON.stringify(hook),
  };

  const requestBody: BundleProposeBody = {
    requestId,
    referralCode: 110000002,
    expirationTimestamp: Math.floor(Date.now() / 1000) + 60 * 60,
    enableAccountAbstraction: true,
    isAtomic: true,
    tradingAlgorithm: TradingAlgorithm.MARKET,
    trades: [trade],
    postHooks: [],
  };

  console.log("Creating bundle...");
  const bundle = await createBundle(requestBody);
  console.log(JSON.stringify(bundle, null, 2));
  console.log("Bundle created successfully!");
  console.log("externalCallHash:", bundle.intents?.[0]?.intent.externalCallHash);

  console.log("Collecting signatures for all intents...");
  const signedDataArray = await processIntentBundle(bundle, chainIdToWalletClientMap);
  console.log(`Generated ${signedDataArray.length} signatures for ${bundle.intents?.length || 0} intents`);

  const submitPayload: Bundle = {
    ...bundle,
    requestId: requestBody.requestId,
    enableAccountAbstraction: true,
    isAtomic: true,
    signedData: signedDataArray,
  };

  console.log("Payload prepared with signatures. Ready for submission.");
  console.log("Track cToken ATA for the effect:", recipientCollateralAta.toBase58());

  const submitResponse = await submitBundle(submitPayload);
  console.log("Submit response:", submitResponse);

  return submitPayload;
}

main().catch((error) => {
  console.error("\nFATAL ERROR in script execution:", error);
  process.exitCode = 1;
});
