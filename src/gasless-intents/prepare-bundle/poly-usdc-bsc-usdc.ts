import utils from "util";
import { randomUUID } from 'crypto';
import { BundleProposeBody, TradingAlgorithm } from "../types";
import { createBundle } from '@utils/api';
import { USDC } from '@utils/constants';

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
        // Source (Polygon)
        srcChainId: 137,
        srcChainTokenIn: USDC.Polygon, // USDC on Polygon (bridged), 6 decimals
        srcChainTokenInAmount: "11000000",      // 11$ USDC
        srcChainTokenInMinAmount: "9000000",   // 9$ USDC
        srcChainTokenInMaxAmount: "10000000",   // 10$ USDC

        // Destination (BSC)
        dstChainId: 56,
        dstChainTokenOut: USDC.BNB, // USDC on BSC/BNB, 6 decimals
        dstChainTokenOutAmount: "auto",
        dstChainTokenOutRecipient: "0x2d5696F81f467460A247d72950527Da0737A49C2",

        // Authorities 
        srcChainAuthorityAddress: "0x2d5696F81f467460A247d72950527Da0737A49C2",
        dstChainAuthorityAddress: "0x2d5696F81f467460A247d72950527Da0737A49C2",

        // Flags
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