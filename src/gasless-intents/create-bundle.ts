import { getEnvConfig, postUrl } from "./../utils";
import { BASE_URL, PREPARE } from "./consts";

async function main() {
  const { privateKey } = getEnvConfig();

  const requestBody = {
    requestId: "usdc-polygon-bsc-50-d-1",
    expirationTimestamp: 1756218120000, // Tue Aug 26 2025 23:59:18 GMT+0000
    enableAccountAbstraction: true,
    isAtomic: false,
    tradingAlgorithm: "market",
    trades: [
      {
        // Source (Polygon)
        srcChainId: 137,
        srcChainTokenIn: "0x3c499c542cef5e3811e1192ce70d8cc03d5c3359", // USDC on Polygon (bridged), 6 decimals
        srcChainTokenInAmount: "11000000",      //10$ USDC
        srcChainTokenInMinAmount: "9000000",   //10$ USDC
        srcChainTokenInMaxAmount: "10000000",   //11$ USDC

        // Destination (BSC)
        dstChainId: 56,
        dstChainTokenOut: "0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d", // USDC on BSC, 6 decimals
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

  const url = `${BASE_URL}${PREPARE}`;

  const response = await postUrl(url, requestBody);

  console.log(response);
}

main().catch((error) => {
  console.error("\n🚨 FATAL ERROR in script execution:", error);
  process.exitCode = 1;
});