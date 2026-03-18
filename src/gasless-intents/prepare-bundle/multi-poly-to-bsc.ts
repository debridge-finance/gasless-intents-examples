import { EVM_NATIVE_TOKEN, USDC, USDT } from '@utils/constants';
import utils from "util";
import { randomUUID } from 'crypto';
import { createBundle } from '@utils/api';
import { BundleProposeBody, TradingAlgorithm } from "../types";

async function main() {

  const requestId = randomUUID();

  const requestBody: BundleProposeBody = {
    requestId,
    expirationTimestamp: 1766218120000,
    enableAccountAbstraction: true,
    isAtomic: true,
    tradingAlgorithm: TradingAlgorithm.MARKET,
    trades: [
      {
        // USDC (Polygon) -> USDT (BSC)
        srcChainId: 137,
        srcChainTokenIn: USDC.Polygon, // USDC on Polygon
        srcChainTokenInAmount: "11000000", // 10 USDC
        srcChainTokenInMinAmount: "9000000",
        srcChainTokenInMaxAmount: "10000000",
        dstChainId: 56,
        dstChainTokenOut: USDT.BNB, // USDT on BSC
        dstChainTokenOutAmount: "auto",
        dstChainTokenOutRecipient: "0x2d5696F81f467460A247d72950527Da0737A49C2",
        srcChainAuthorityAddress: "0x2d5696F81f467460A247d72950527Da0737A49C2",
        dstChainAuthorityAddress: "0x2d5696F81f467460A247d72950527Da0737A49C2",
        prependOperatingExpenses: false,
        ptp: false
      },
      {
        // MATIC (Polygon) -> USDT (BSC)
        srcChainId: 137,
        srcChainTokenIn: EVM_NATIVE_TOKEN, // native MATIC
        srcChainTokenInAmount: "11000000000000000000", // 10 MATIC
        srcChainTokenInMinAmount: "9000000000000000000",
        srcChainTokenInMaxAmount: "10000000000000000000",
        dstChainId: 56,
        dstChainTokenOut: USDT.BNB,
        dstChainTokenOutAmount: "auto",
        dstChainTokenOutRecipient: "0x2d5696F81f467460A247d72950527Da0737A49C2",
        srcChainAuthorityAddress: "0x2d5696F81f467460A247d72950527Da0737A49C2",
        dstChainAuthorityAddress: "0x2d5696F81f467460A247d72950527Da0737A49C2",
        prependOperatingExpenses: false,
        ptp: false
      },
      {
        // USDT (Polygon) -> USDT (BSC)
        srcChainId: 137,
        srcChainTokenIn: USDT.Polygon, // USDT on Polygon
        srcChainTokenInAmount: "10000000", // 10 USDT
        srcChainTokenInMinAmount: "10000000",
        srcChainTokenInMaxAmount: "11000000",
        dstChainId: 56,
        dstChainTokenOut: USDT.BNB,
        dstChainTokenOutAmount: "auto",
        dstChainTokenOutRecipient: "0x2d5696F81f467460A247d72950527Da0737A49C2",
        srcChainAuthorityAddress: "0x2d5696F81f467460A247d72950527Da0737A49C2",
        dstChainAuthorityAddress: "0x2d5696F81f467460A247d72950527Da0737A49C2",
        prependOperatingExpenses: false,
        ptp: false
      }
    ],
    preHooks: [],
    postHooks: []
  }

  const response = await createBundle(requestBody);

  console.log(utils.inspect(response, false, 4));
}

main().catch((error) => {
  console.error("\n🚨 FATAL ERROR in script execution:", error);
  process.exitCode = 1;
});