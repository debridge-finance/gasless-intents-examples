import { randomUUID } from 'crypto';
import { privateKeyToAccount } from 'viem/accounts';
import bs58 from 'bs58';
import { Keypair } from "@solana/web3.js";

import { getEnvConfig, toHexPrefixString } from '@utils/index';
import { createBundle, submitBundle } from '@utils/api';
import { EVM_NATIVE_TOKEN, WSOL } from '@utils/constants';
import { CHAIN_IDS } from '@utils/chains';
import { Bundle, BundleProposeBody, ExtendedHook, Trade, TradingAlgorithm } from "../../../types";
import { processIntentBundle } from '@utils/signatures/intent-signatures';
import { getChainIdToWalletClientMap } from '@utils/wallet';
import { refreshSolanaPreHookBlockhashes } from '@utils/solana';

import { buildSolanaVersionedMemoTxHex } from "../../../prehooks/solana/memo";

/**
 * Solana prehook example: Memo instruction (no gas compensation) + cross-chain trade Solana -> Base.
 *
 * Note: gasCompensationInfo is NOT allowed when trades are present.
 */
async function main() {
  const { privateKey, solPrivateKey } = getEnvConfig();

  const account = privateKeyToAccount(toHexPrefixString(privateKey));
  const solanaKey = Keypair.fromSecretKey(bs58.decode(solPrivateKey));

  const chainIdToWalletClientMap = getChainIdToWalletClientMap(account, solanaKey);

  console.log(`Solana Address: ${solanaKey.publicKey.toBase58()}`);
  console.log(`EVM Address: ${account.address}`);

  const prehook: ExtendedHook = {
    isAtomic: true,
    data: buildSolanaVersionedMemoTxHex({
      payer: solanaKey.publicKey.toBase58(),
      memo: 'test-prehook',
    }),
    from: solanaKey.publicKey.toBase58(),
    chainId: CHAIN_IDS.Solana,
    to: WSOL,
    value: '0',
    placeHolders: [],
    // No gasCompensationInfo - not allowed when trades are present
  };

  const trade: Trade = {
    srcChainId: CHAIN_IDS.Solana,
    srcChainTokenIn: WSOL,
    srcChainTokenInAmount: '30000000', // 0.03 SOL
    srcChainTokenInMinAmount: '30000000',
    srcChainTokenInMaxAmount: '30000000',
    dstChainId: CHAIN_IDS.Base,
    dstChainTokenOut: EVM_NATIVE_TOKEN,
    dstChainTokenOutAmount: 'auto',
    dstChainTokenOutRecipient: account.address,
    srcChainAuthorityAddress: solanaKey.publicKey.toBase58(),
    dstChainAuthorityAddress: account.address,
    prependOperatingExpenses: true,
  };

  const requestId = randomUUID();

  const requestBody: BundleProposeBody = {
    requestId,
    expirationTimestamp: Math.floor(new Date().getTime() * 2 / 1000),
    enableAccountAbstraction: true,
    isAtomic: true,
    tradingAlgorithm: TradingAlgorithm.MARKET,
    trades: [trade],
    preHooks: [prehook],
    postHooks: [],
  };

  console.log("Creating bundle...");
  const bundle = await createBundle(requestBody);
  console.log("Bundle created successfully!");
  console.log(`PreHooks count: ${bundle.preHooks?.length}`);
  console.log(`Intents count: ${bundle.intents?.length}`);

  await refreshSolanaPreHookBlockhashes(bundle);

  const signedData = await processIntentBundle(bundle, chainIdToWalletClientMap);
  console.log(`Generated ${signedData.length} signatures`);

  const submitPayload: Bundle = {
    ...bundle,
    requestId: requestBody.requestId,
    enableAccountAbstraction: true,
    isAtomic: true,
    signedData,
  };

  const submitResponse = await submitBundle(submitPayload);
  console.log("Submit response:", submitResponse);

  return submitPayload;
}

main().catch((error) => {
  console.error("\nFATAL ERROR in script execution:", error);
  process.exitCode = 1;
});
