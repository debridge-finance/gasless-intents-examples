import { postUrl } from "./../../utils";
import { BASE_URL, PREPARE } from "./../consts";
import utils from "util";
import { randomUUID } from 'crypto';

async function main() {

  const requestId = randomUUID();

  const requestBody = {
    requestId,
    expirationTimestamp: 1766218120000,
    enableAccountAbstraction: true,
    isAtomic: true,
    tradingAlgorithm: "market",
    trades: [
      {
        // USDC (Polygon) -> USDT (BSC)
        srcChainId: 137,
        srcChainTokenIn: "0x3c499c542cef5e3811e1192ce70d8cc03d5c3359", // USDC on Polygon
        srcChainTokenInAmount: "11000000", // 10 USDC
        srcChainTokenInMinAmount: "9000000",
        srcChainTokenInMaxAmount: "10000000",
        dstChainId: 56,
        dstChainTokenOut: "0x55d398326f99059ff775485246999027b3197955", // USDT on BSC
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
        srcChainTokenIn: "0x0000000000000000000000000000000000000000", // native MATIC
        srcChainTokenInAmount: "11000000000000000000", // 10 MATIC
        srcChainTokenInMinAmount: "9000000000000000000",
        srcChainTokenInMaxAmount: "10000000000000000000",
        dstChainId: 56,
        dstChainTokenOut: "0x55d398326f99059ff775485246999027b3197955",
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
        srcChainTokenIn: "0xc2132d05d31c914a87c6611c10748aeb04b58e8f", // USDT on Polygon
        srcChainTokenInAmount: "10000000", // 10 USDT
        srcChainTokenInMinAmount: "10000000",
        srcChainTokenInMaxAmount: "11000000",
        dstChainId: 56,
        dstChainTokenOut: "0x55d398326f99059ff775485246999027b3197955",
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

  const url = `${BASE_URL}${PREPARE}`;

  const response = await postUrl(url, requestBody);

  console.log(utils.inspect(response, false, 4));
}

main().catch((error) => {
  console.error("\n🚨 FATAL ERROR in script execution:", error);
  process.exitCode = 1;
});