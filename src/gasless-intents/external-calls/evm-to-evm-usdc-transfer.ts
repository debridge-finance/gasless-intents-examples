import { randomUUID } from "crypto";
import { Address, encodeFunctionData, parseAbi, parseUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";

import { Bundle, BundleProposeBody, DlnHook, DlnHookType, Trade, TradingAlgorithm } from "@gasless-intents/types";
import { CHAIN_IDS } from "@utils/chains";
import { USDC } from "@utils/constants";
import { getEnvConfig } from "@utils/env";
import { createBundle, submitBundle } from "@utils/gasless-api";
import { processIntentBundle } from "@utils/signatures/intent-signatures";
import { toHexPrefixString } from "@utils/string";
import { getChainIdToWalletClientMap } from "@utils/wallet";

// Swaps USDC from Arbitrum to Polygon and, during destination fulfillment,
// transfers a fixed amount of the Polygon USDC output to a second address via
// an EVM external call (`dlnHook`).
//
// The default EVM external-call executor rejects top-level ERC-20 transfer,
// transferFrom, approve, and increaseAllowance selectors. To keep this a pure
// transfer example without deploying a custom executor, the external call targets
// Multicall3. The executor gives Multicall3 a temporary allowance, then Multicall3
// pulls USDC from the executor with transferFrom and sends it to the recipient.

const USDC_DECIMALS = 6;
const SECOND_DEVREL_ADDRESS = "0x6098841a6B27feBdb30e51d07c1BD17499efED38" as Address;
const TRANSFER_AMOUNT = parseUnits("1.3", USDC_DECIMALS);

const MULTICALL3_POLYGON = "0xcA11bde05977b3631167028862bE2a173976CA11" as Address;
const DEBRIDGE_EXTERNAL_CALL_EXECUTOR = "0xAE0361b1C3454b297129e01046057F1D294c7974" as Address;

const ERC20_TRANSFER_FROM_ABI = parseAbi(["function transferFrom(address from, address to, uint256 amount) returns (bool)"]);
const MULTICALL3_ABI = parseAbi([
  "function aggregate3((address target, bool allowFailure, bytes callData)[] calls) payable returns ((bool success, bytes returnData)[] returnData)",
]);

function generateMulticallUsdcTransferCalldata(recipientAddress: Address): string {
  const pullUsdcFromExecutorCalldata = encodeFunctionData({
    abi: ERC20_TRANSFER_FROM_ABI,
    functionName: "transferFrom",
    args: [DEBRIDGE_EXTERNAL_CALL_EXECUTOR, recipientAddress, TRANSFER_AMOUNT],
  });

  const multicallCalldata = encodeFunctionData({
    abi: MULTICALL3_ABI,
    functionName: "aggregate3",
    args: [
      [
        {
          target: USDC.Polygon as Address,
          allowFailure: false,
          callData: pullUsdcFromExecutorCalldata,
        },
      ],
    ],
  });

  console.log("\n--- Multicall3 ERC-20 Transfer Calldata ---");
  console.log("External Call Target:", MULTICALL3_POLYGON);
  console.log("USDC Token Address:", USDC.Polygon);
  console.log("USDC Owner During External Call:", DEBRIDGE_EXTERNAL_CALL_EXECUTOR);
  console.log("Recipient Address:", recipientAddress);
  console.log("Transfer Amount:", TRANSFER_AMOUNT.toString());
  console.log("Nested transferFrom Calldata:", pullUsdcFromExecutorCalldata);
  console.log("Multicall3 Calldata:", multicallCalldata);

  return multicallCalldata;
}

async function main() {
  const { privateKey } = getEnvConfig();
  const account = privateKeyToAccount(toHexPrefixString(privateKey));
  const chainIdToWalletClientMap = getChainIdToWalletClientMap(account);
  const requestId = randomUUID();

  const transferUsdcToSecondDevrel: DlnHook = {
    type: DlnHookType.EvmTransactionCall,
    data: {
      to: MULTICALL3_POLYGON,
      calldata: generateMulticallUsdcTransferCalldata(SECOND_DEVREL_ADDRESS),
      gas: 0,
    },
  };

  const usdcArbitrumToUsdcPolygon: Trade = {
    srcChainId: CHAIN_IDS.Arbitrum,
    srcChainTokenIn: USDC.Arbitrum,
    srcChainTokenInAmount: "3300000", // 3.3 USDC
    srcChainAuthorityAddress: account.address,
    dstChainId: CHAIN_IDS.Polygon,
    dstChainTokenOut: USDC.Polygon,
    dstChainTokenOutAmount: "auto",
    dstChainTokenOutRecipient: account.address,
    dstChainAuthorityAddress: account.address,
    prependOperatingExpenses: true,
    dlnHook: JSON.stringify(transferUsdcToSecondDevrel),
  };

  const requestBody: BundleProposeBody = {
    requestId,
    referralCode: 110000002,
    expirationTimestamp: Math.floor((new Date().getTime() * 2) / 1000),
    enableAccountAbstraction: true,
    isAtomic: true,
    tradingAlgorithm: TradingAlgorithm.MARKET,
    trades: [usdcArbitrumToUsdcPolygon],
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

  const submitResponse = await submitBundle(submitPayload);
  console.log("Submit response:", submitResponse);

  return submitPayload;
}

main().catch((error) => {
  console.error("\nFATAL ERROR in script execution:", error);
  process.exitCode = 1;
});
