import { createBundle } from '@utils/api';
import { USDC } from '@utils/constants';
import { BundleProposeBody, TradingAlgorithm } from "../types";
import { randomUUID } from 'crypto';

async function main() {
  const requestId = randomUUID();

  const requestBody: BundleProposeBody = {
    requestId,
    expirationTimestamp: Math.floor(new Date().getTime() * 2 / 1000),
    enableAccountAbstraction: true,
    isAtomic: false,
    tradingAlgorithm: TradingAlgorithm.MARKET,
    trades: [
      {
        // Source (Polygon)
        srcChainId: 137,
        srcChainTokenIn: USDC.Polygon, // USDC on Polygon (bridged), 6 decimals
        srcChainTokenInAmount: "2000000",      // 2$ USDC
        srcChainTokenInMinAmount: "2000000",   // 2$ USDC
        srcChainTokenInMaxAmount: "2000000",   // 20$ USDC

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

  console.log(response);
}

main().catch((error) => {
  console.error("\n🚨 FATAL ERROR in script execution:", error);
  process.exitCode = 1;
});