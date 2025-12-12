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
import { EVM_NATIVE_TOKEN, SOL_JUP, DBR_SOL, SOL_NATIVE, USDC } from '../../utils/constants';

async function main() {
  // Wallet setup
  const { privateKey, solPrivateKey } = getEnvConfig();

  const account = privateKeyToAccount(`0x${clipHexPrefix(privateKey)}`);
  const solanaKey = Keypair.fromSecretKey(bs58.decode(solPrivateKey));

  const chainIdToWalletClientMap = getChainIdToWalletClientMap(account, solanaKey);

  const requestId = randomUUID();

  const polyUsdcToSolUsdcTrade: Trade = {
    srcChainId: CHAIN_IDS.Polygon,
    srcChainTokenIn: USDC.Polygon,
    srcChainTokenInAmount: '100000',
    srcChainTokenInMinAmount: '100000',
    srcChainTokenInMaxAmount: '100000',
    srcChainAuthorityAddress: account.address,
    dstChainId: CHAIN_IDS.Solana,
    dstChainTokenOut: USDC.Solana,
    dstChainTokenOutAmount: "auto",
    dstChainTokenOutRecipient: solanaKey.publicKey.toBase58(),
    dstChainAuthorityAddress: solanaKey.publicKey.toBase58(),
    prependOperatingExpenses: true
  }

  const optimismUsdcToSolJupTrade: Trade = {
    srcChainId: CHAIN_IDS.Optimism,
    srcChainTokenIn: USDC.Optimism,
    srcChainTokenInAmount: '100000',
    srcChainTokenInMinAmount: '100000',
    srcChainTokenInMaxAmount: '100000',
    srcChainAuthorityAddress: account.address,
    dstChainId: CHAIN_IDS.Solana,
    dstChainTokenOut: SOL_JUP,
    dstChainTokenOutAmount: "auto",
    dstChainTokenOutRecipient: solanaKey.publicKey.toBase58(),
    dstChainAuthorityAddress: solanaKey.publicKey.toBase58(),
    prependOperatingExpenses: true
  }

  const arbUsdcToSolDbrTrade: Trade = {
    srcChainId: CHAIN_IDS.Arbitrum,
    srcChainTokenIn: USDC.Arbitrum,
    srcChainTokenInAmount: '1000000',
    srcChainTokenInMinAmount: '1000000',
    srcChainTokenInMaxAmount: '1000000',
    srcChainAuthorityAddress: account.address,
    dstChainId: CHAIN_IDS.Solana,
    dstChainTokenOut: DBR_SOL,
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

  // Propose bundle body
  const requestBody: BundleProposeBody = {
    referralCode: 0,
    requestId,
    expirationTimestamp: Math.floor(new Date().getTime() * 2 / 1000),
    enableAccountAbstraction: true,
    isAtomic: true,
    tradingAlgorithm: TradingAlgorithm.MARKET,
    trades: [
      polyUsdcToSolUsdcTrade,
      optimismUsdcToSolJupTrade,
      arbUsdcToSolDbrTrade,
      solDbrToSolUsdcTrade
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

  // Prepare the bundle with signatures - but don't submit yet
  const submitPayload: Bundle = {
    ...bundle,
    referralCode: 0,
    requestId: requestBody.requestId,
    enableAccountAbstraction: true,
    isAtomic: true,
    signedData: signedDataArray
  };

  console.log(util.inspect(submitPayload, { showHidden: false, depth: null, colors: false }));

  // console.log("Payload prepared with signatures. Ready for submission.");

  const submitResponse = await submitBundle(submitPayload);
  console.log("Submit response:", submitResponse);
}

main().catch((error) => {
  console.error("\n🚨 FATAL ERROR in script execution:", error);
  process.exitCode = 1;
});