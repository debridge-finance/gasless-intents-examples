import { privateKeyToAccount } from 'viem/accounts'
import { getEnvConfig, toHexPrefixString } from "../../../utils";
import { randomUUID } from 'crypto';
import bs58 from 'bs58';
import { Keypair } from "@solana/web3.js"
import { createBundle, submitBundle } from "../../../utils/api";
import { Bundle, BundleProposeBody, Trade, TradingAlgorithm } from "../../types";
import { SOL_JUP, SOL_NATIVE, USDC } from '../../../utils/constants';
import { processIntentBundle } from '../../../utils/signatures/intent-signatures';
import { getChainIdToWalletClientMap } from '../../../utils/wallet';
import { CHAIN_IDS } from '../../../utils/chains';

async function main() {
  // Wallet setup
  const { privateKey, solPrivateKey } = getEnvConfig();

  const account = privateKeyToAccount(toHexPrefixString(privateKey));
  const solanaKey = Keypair.fromSecretKey(bs58.decode(solPrivateKey));

  const requestId = randomUUID();

  const chainIdToWalletClientMap = getChainIdToWalletClientMap(account, solanaKey);

  const trade: Trade = {
    srcChainId: CHAIN_IDS.Solana,
    // srcChainTokenIn: SOL_JUP,
    srcChainTokenIn: SOL_NATIVE,
    srcChainTokenInAmount: '20000000', // 20 JUP - 6 decimals 
    srcChainTokenInMinAmount: '20000000', 
    srcChainTokenInMaxAmount: '20000000',
    dstChainId: CHAIN_IDS.Polygon,
    dstChainTokenOut: USDC.Polygon,
    dstChainTokenOutAmount: "auto",
    dstChainTokenOutRecipient: account.address,
    srcChainAuthorityAddress: solanaKey.publicKey.toBase58(),
    dstChainAuthorityAddress: account.address,
    prependOperatingExpenses: true
  }

  // Trades body
  console.log(`Solana Address: ${solanaKey.publicKey.toBase58()}`)
  console.log(`EVM Address: ${account.address}`)
  const requestBody: BundleProposeBody = {
    requestId,
    referralCode: 31805,
    expirationTimestamp: Math.floor(new Date().getTime() * 2 / 1000),
    enableAccountAbstraction: true,
    isAtomic: true,
    tradingAlgorithm: TradingAlgorithm.MARKET,
    trades: [
      trade
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
