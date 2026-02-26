import {
  privateKeyToAccount
} from 'viem/accounts'
import { getEnvConfig, clipHexPrefix } from "../../utils";
import { createBundle, submitBundle } from "../../utils/api";
import { processIntentBundle } from "../../utils/signatures/intent-signatures";
import { randomUUID } from 'crypto';
import bs58 from 'bs58';

import util from "util"

import { Bundle, BundleProposeBody, Trade, TradingAlgorithm } from "../types";
import { getChainIdToWalletClientMap } from "../../utils/wallet";
import { Keypair } from '@solana/web3.js';
import { CHAIN_IDS } from "../../utils/chains";
import { SOL_JUP, USDC, DBR_SOL } from '../../utils/constants';

async function main() {
  // Wallet setup
  const { privateKey, solPrivateKey } = getEnvConfig();

  const account = privateKeyToAccount(`0x${clipHexPrefix(privateKey)}`);
  const solanaKey = Keypair.fromSecretKey(bs58.decode(solPrivateKey));

  const chainIdToWalletClientMap = getChainIdToWalletClientMap(account, solanaKey);

  const requestId = randomUUID();

  const solJupToSolUsdcTrade: Trade = {
    srcChainId: CHAIN_IDS.Solana,
    srcChainTokenIn: SOL_JUP,
    srcChainTokenInAmount: '1000000',
    srcChainTokenInMinAmount: '1000000',
    srcChainTokenInMaxAmount: '1000000',
    srcChainAuthorityAddress: solanaKey.publicKey.toBase58(),
    dstChainId: CHAIN_IDS.Solana,
    dstChainTokenOut: USDC.Solana,
    dstChainTokenOutAmount: "auto",
    dstChainTokenOutRecipient: solanaKey.publicKey.toBase58(),
    dstChainAuthorityAddress: solanaKey.publicKey.toBase58(),
    prependOperatingExpenses: true
  }

  const solDbrToSolUsdcTrade: Trade = {
    srcChainId: CHAIN_IDS.Solana,
    srcChainTokenIn: DBR_SOL,
    srcChainTokenInAmount: '1000000',
    srcChainTokenInMinAmount: '1000000',
    srcChainTokenInMaxAmount: '1000000',
    srcChainAuthorityAddress: solanaKey.publicKey.toBase58(),
    dstChainId: CHAIN_IDS.Solana,
    dstChainTokenOut: USDC.Solana,
    dstChainTokenOutAmount: "auto",
    dstChainTokenOutRecipient: solanaKey.publicKey.toBase58(),
    dstChainAuthorityAddress: solanaKey.publicKey.toBase58(),
    prependOperatingExpenses: true
  }

  const solUsdcToSolDbrTrade: Trade = {
    srcChainId: CHAIN_IDS.Solana,
    srcChainTokenIn: USDC.Solana,
    srcChainTokenInAmount: '1000000',
    srcChainTokenInMinAmount: '1000000',
    srcChainTokenInMaxAmount: '1000000',
    srcChainAuthorityAddress: solanaKey.publicKey.toBase58(),
    dstChainId: CHAIN_IDS.Solana,
    dstChainTokenOut: DBR_SOL,
    dstChainTokenOutAmount: "auto",
    dstChainTokenOutRecipient: solanaKey.publicKey.toBase58(),
    dstChainAuthorityAddress: solanaKey.publicKey.toBase58(),
    prependOperatingExpenses: true
  }

  // Propose bundle body
  const requestBody: BundleProposeBody = {
    referralCode: 110000002,
    requestId,
    expirationTimestamp: Math.floor(new Date().getTime() * 2 / 1000),
    enableAccountAbstraction: true,
    isAtomic: true,
    tradingAlgorithm: TradingAlgorithm.MARKET,
    trades: [
      solJupToSolUsdcTrade,
      solDbrToSolUsdcTrade,
      solUsdcToSolDbrTrade
    ],
    postHooks: [
    ],
  }


  // console.log("Creating bundle...");
  const bundle = await createBundle(requestBody);
  // console.log(JSON.stringify(bundle, null, 2));
  // console.log("Bundle created successfully!");

  // Log the first intent for debugging
  if (bundle.intents && bundle.intents.length > 0) {
    // console.log("First intent:", util.inspect(bundle.intents[0], { showHidden: false, depth: null, colors: true }));
  }

  // Using processIntentBundle to handle all intents at once
  // console.log("Collecting signatures for all intents...");
  const signedDataArray = await processIntentBundle(bundle, chainIdToWalletClientMap);

  // console.log(`Generated ${signedDataArray.length} signatures for ${bundle.intents?.length || 0} intents`);

  // Prepare the bundle with intent signatures for submission
  const submitPayload: Bundle = {
    ...bundle,
    referralCode: 110000002,
    requestId: requestBody.requestId,
    enableAccountAbstraction: true,
    isAtomic: true,
    signedData: signedDataArray
  };

  console.log(util.inspect(submitPayload, { showHidden: false, depth: null, colors: false }));

  const submitResponse = await submitBundle(submitPayload);
  console.log("Submit response:", submitResponse);
}

main().catch((error) => {
  console.error("\n🚨 FATAL ERROR in script execution:", error);
  process.exitCode = 1;
});