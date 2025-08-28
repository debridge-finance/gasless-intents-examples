import { ethers } from "ethers";
import { getEnvConfig } from "./../utils";
import { createBundle, submitBundle } from "./api-calls";
import { processIntentBundle } from "./signatures/intent-signatures";

import util from "util"

async function main() {
  // Wallet setup
  const { privateKey, polygonRpcUrl } = getEnvConfig();
  const polygonProvider = new ethers.JsonRpcProvider(polygonRpcUrl);
  const signer = new ethers.Wallet(privateKey, polygonProvider);

  // Trades body
  const requestBody = {
    requestId: "usdc-polygon-bsc-50-d-1",
    expirationTimestamp: 1756592686000, // Sat Aug 30 2025 22:24:46 GMT+0000
    enableAccountAbstraction: true,
    isAtomic: true,
    tradingAlgorithm: "market",
    trades: [
      {
        // Source (Polygon)
        srcChainId: 137,
        srcChainTokenIn: "0x3c499c542cef5e3811e1192ce70d8cc03d5c3359", // USDC on Polygon (bridged), 6 decimals
        srcChainTokenInAmount: "4000000",      // 4$ USDC
        srcChainTokenInMinAmount: "2000000",   // 2$ USDC
        srcChainTokenInMaxAmount: "3000000",   // 3$ USDC

        // Destination (BSC)
        dstChainId: 56,
        dstChainTokenOut: "0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d", // USDC on BSC, 6 decimals
        dstChainTokenOutAmount: "auto",
        dstChainTokenOutRecipient: signer.address,

        // Authorities 
        srcChainAuthorityAddress: signer.address,
        dstChainAuthorityAddress: signer.address,

        // Flags
        prependOperatingExpenses: false,
        ptp: false
      }
    ],
    preHooks: [],
    postHooks: []
  }

  console.log("Creating bundle...");
  const bundle = await createBundle(requestBody);
  console.log("Bundle created successfully!");

  // Log the first intent for debugging
  if (bundle.intents && bundle.intents.length > 0) {
    console.log("First intent:", util.inspect(bundle.intents[0], {showHidden: false, depth: null, colors: true}));
  }

  // Using processIntentBundle to handle all intents at once
  console.log("Collecting signatures for all intents...");
  const signedDataArray = await processIntentBundle(bundle, signer);
  
  console.log(`Generated ${signedDataArray.length} signatures for ${bundle.intents?.length || 0} intents`);
  
  // Prepare the bundle with signatures - but don't submit yet
  const submitPayload = {
    ...bundle,
    requestId: requestBody.requestId,
    enableAccountAbstraction: true,
    isAtomic: true,
    signedData: signedDataArray
  };
  
  console.log("Payload prepared with signatures. Ready for submission.");
  
  // Uncomment this to submit the bundle
  const submitResponse = await submitBundle(submitPayload);
  console.log("Submit response:", submitResponse);
  
  return submitPayload;
}

main().catch((error) => {
  console.error("\n🚨 FATAL ERROR in script execution:", error);
  process.exitCode = 1;
});