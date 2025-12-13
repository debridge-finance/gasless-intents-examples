import { privateKeyToAccount } from 'viem/accounts'
import { getEnvConfig, toHexPrefixString } from "../../../utils";
import { randomUUID } from 'crypto';
import bs58 from 'bs58';
import { getSolUsdcToPolyUsdcTrade } from "../../trades";
import { Keypair } from "@solana/web3.js"
import { createBundle, submitBundle } from "../../../utils/api";
import { Bundle, BundleProposeBody, TradingAlgorithm } from "../../types";
import { processIntentBundle } from '../../../utils/signatures/intent-signatures';
import { getChainIdToWalletClientMap } from '../../../utils/wallet';

async function main() {
  // Wallet setup
  const { privateKey, solPrivateKey } = getEnvConfig();

  const account = privateKeyToAccount(toHexPrefixString(privateKey));
  const solanaKey = Keypair.fromSecretKey(bs58.decode(solPrivateKey))

  const requestId = randomUUID();

  const chainIdToWalletClientMap = getChainIdToWalletClientMap(account, solanaKey);

  // Trades body
  console.log(`Solana Address: ${solanaKey.publicKey.toBase58()}`)
  console.log(`EVM Address: ${account.address}`)
  const requestBody: BundleProposeBody = {
    requestId,
    referralCode: 110000002,
    expirationTimestamp: Math.floor(new Date().getTime() * 2 / 1000),
    enableAccountAbstraction: false,
    isAtomic: true,
    tradingAlgorithm: TradingAlgorithm.MARKET,
    trades: [
      getSolUsdcToPolyUsdcTrade(solanaKey.publicKey.toString(), account.address)
    ],
    preHooks: [],
    postHooks: []
  }

  console.log(`Creating bundle... ${JSON.stringify(requestBody)}`);
  const bundle = await createBundle(requestBody);
  console.log(`Bundle created successfully!, ${JSON.stringify(bundle)}`);

  const signedData = await processIntentBundle(bundle, chainIdToWalletClientMap);

  const submitPayload: Bundle = {
    ...bundle,
    requestId: requestBody.requestId,
    enableAccountAbstraction: true,
    isAtomic: true,
    signedData
  };

  console.log(`Payload prepared with signatures. Ready for submission. payload: ${JSON.stringify(submitPayload)}`);

  const submitResponse = await submitBundle(submitPayload);
  console.log("Submit response:", submitResponse);

  return submitPayload;
}

main().catch((error) => {
  console.error("\n🚨 FATAL ERROR in script execution:", error);
  process.exitCode = 1;
});
