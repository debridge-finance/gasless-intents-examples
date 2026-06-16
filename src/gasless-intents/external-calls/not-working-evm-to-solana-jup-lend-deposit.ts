import { randomUUID } from "crypto";

import { Connection, Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import { privateKeyToAccount } from "viem/accounts";

import { Bundle, BundleProposeBody, Trade, TradingAlgorithm } from "@gasless-intents/types";
import { CHAIN_IDS } from "@utils/chains";
import { DEBRIDGE_SOLANA_EXTERNAL_CALL, SOLANA_RPC_URL, USDC } from "@utils/constants";
import { getEnvConfig } from "@utils/env";
import { createBundle, submitBundle } from "@utils/gasless-api";
import { buildJupLendUsdcDepositDlnHook } from "@utils/solana/jup-lend";
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
  console.log(`Solana fToken recipient: ${solanaRecipient.publicKey.toBase58()}`);

  const {
    hook,
    assetMint,
    lendingAdmin,
    lending,
    fTokenMint,
    supplyTokenReservesLiquidity,
    lendingSupplyPositionOnLiquidity,
    vault,
    liquidity,
    liquidityProgram,
    recipientFTokenAta,
    recipientFTokenAtaExists,
    tokenProgram,
    serializedHookBytes,
  } = await buildJupLendUsdcDepositDlnHook({
    connection,
    recipient: solanaRecipient.publicKey,
  });

  console.log("\n--- Solana External Call ---");
  console.log("Approach: deposit to patched temp fToken wallet, then transfer fTokens to recipient");
  console.log("JUP LEND asset mint:", assetMint.toBase58());
  console.log("JUP LEND admin:", lendingAdmin.toBase58());
  console.log("JUP LEND market:", lending.toBase58());
  console.log("JUP LEND fToken mint:", fTokenMint.toBase58());
  console.log("Supply token reserve liquidity:", supplyTokenReservesLiquidity.toBase58());
  console.log("Lending supply position:", lendingSupplyPositionOnLiquidity.toBase58());
  console.log("Vault:", vault.toBase58());
  console.log("Liquidity:", liquidity.toBase58());
  console.log("Liquidity program:", liquidityProgram.toBase58());
  console.log("Recipient fToken ATA:", recipientFTokenAta.toBase58());
  console.log("Recipient fToken ATA exists:", recipientFTokenAtaExists);
  console.log("Patched temp fToken wallet:", `ATA(external-call authority, ${fTokenMint.toBase58()})`);
  console.log("Token program:", tokenProgram.toBase58());
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
  console.log("Track fToken ATA for the effect:", recipientFTokenAta.toBase58());

  const submitResponse = await submitBundle(submitPayload);
  console.log("Submit response:", submitResponse);

  return submitPayload;
}

main().catch((error) => {
  console.error("\nFATAL ERROR in script execution:", error);
  process.exitCode = 1;
});
