import { randomUUID } from 'crypto';
import { privateKeyToAccount } from 'viem/accounts';
import bs58 from 'bs58';
import { Keypair } from "@solana/web3.js";

import { getEnvConfig, toHexPrefixString } from '@utils/index';
import { createBundle, submitBundle } from '@utils/api';
import { SOL_NATIVE, WSOL } from '@utils/constants';
import { CHAIN_IDS } from '@utils/chains';
import { Bundle, BundleProposeBody, ExtendedHook, TradingAlgorithm } from "../../../types";
import { processIntentBundle } from '@utils/signatures/intent-signatures';
import { getChainIdToWalletClientMap } from '@utils/wallet';
import { refreshSolanaPreHookBlockhashes } from '@utils/solana';
import { SOLANA_RPC_URL } from '@utils/constants';
import { buildSolanaSystemTransferTxHexWithAmountPlaceholder } from "../../../prehooks/solana/system-transfer-placeholder";

/**
 * Solana prehook example: System transfer with {amount.8} placeholder + native SOL gas compensation, no trades.
 *
 * Same as the WSOL gas comp variant, but uses native SOL (11111111111111111111111111111111)
 * as the gas compensation token instead of WSOL.
 *
 * Maps to taf-backend-ts test case 3: "Solana preHook + native SOL compensation 201 (with memo and placeholder)"
 */
async function main() {
  const { privateKey, solPrivateKey } = getEnvConfig();

  const account = privateKeyToAccount(toHexPrefixString(privateKey));
  const solanaKey = Keypair.fromSecretKey(bs58.decode(solPrivateKey));
  const solAddress = solanaKey.publicKey.toBase58();

  const chainIdToWalletClientMap = getChainIdToWalletClientMap(account, solanaKey);

  console.log(`Solana Address: ${solAddress}`);
  console.log(`EVM Address: ${account.address}`);

  const prehook: ExtendedHook = {
    isAtomic: true,
    data: buildSolanaSystemTransferTxHexWithAmountPlaceholder({
      payer: solAddress,
      recipient: solAddress,
      placeholder: '{amount.8}',
    }),
    from: solAddress,
    chainId: CHAIN_IDS.Solana,
    to: WSOL,
    value: '0',
    placeHolders: [
      {
        nameVariable: 'amount',
        tokenAddress: WSOL,
        address: solAddress,
        additionalAmount: '2000000',
      }
    ],
    gasCompensationInfo: {
      chainId: CHAIN_IDS.Solana,
      tokenAddress: SOL_NATIVE, // native SOL instead of WSOL
      sender: solAddress,
    },
  };

  const requestId = randomUUID();

  const requestBody: BundleProposeBody = {
    requestId,
    expirationTimestamp: Math.floor(new Date().getTime() * 2 / 1000),
    enableAccountAbstraction: true,
    isAtomic: true,
    tradingAlgorithm: TradingAlgorithm.MARKET,
    trades: [],
    preHooks: [prehook],
    postHooks: [],
  };

  console.log("Creating bundle...");
  const bundle = await createBundle(requestBody);
  console.log("Bundle created successfully!");
  console.log(`PreHooks count: ${bundle.preHooks?.length}`);

  await refreshSolanaPreHookBlockhashes(bundle, CHAIN_IDS.Solana, SOLANA_RPC_URL);

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
