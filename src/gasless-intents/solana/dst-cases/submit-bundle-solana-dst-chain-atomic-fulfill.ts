import {createWalletClient, http} from "viem";
import {privateKeyToAccount} from 'viem/accounts'
import {polygon} from "viem/chains"
import {getEnvConfig} from "../../../utils";
import {randomUUID} from 'crypto';

import util from "util"
import {getPolyUsdcToSolJupTrade, getPolyUsdcToSolUsdcTrade} from "../../trades";
import {Keypair} from "@solana/web3.js";
import bs58 from "bs58";
import {createBundleDev, submitBundleDev} from "../../../utils/api";
import {processIntentBundle} from "../../../utils/signatures/intent-signatures";
import {TradingAlgorithm} from "../../types";

function remove0xPrefix(input: string): string {
    if (input.startsWith("0x")) {
        return input.slice(2);
    }
    return input;
}

async function main() {
    // Wallet setup
    const {privateKey} = getEnvConfig();

    const account = privateKeyToAccount(`0x${remove0xPrefix(privateKey)}`);

    const walletClient = createWalletClient({
        account,
        chain: polygon,
        transport: http()
    });

    console.log(`account: ${account.address}`)

    const requestId = randomUUID();

    const solanaKey =
        Keypair.fromSecretKey(bs58.decode("41zEbhk7HyBwLFZL4RxJyXBHZ4tU8fHKBXhhuXfxM13KrMgukmT9nM2J9sm2Hbm2sMgfGh8knH9hk834KHpFA5GR"))


    // Trades body
    const requestBody = {
        requestId,
        expirationTimestamp: Math.floor(new Date().getTime() * 2 / 1000),
        enableAccountAbstraction: true,
        isAtomic: true,
        tradingAlgorithm: TradingAlgorithm.MARKET,
        trades: [
            getPolyUsdcToSolUsdcTrade(account.address, "79bWNoaxKKAqSrFDDytJNXmLACL2GbKFg7qb6KKPCVxx", solanaKey.publicKey.toBase58()),
            // JUP
            getPolyUsdcToSolJupTrade(account.address, "79bWNoaxKKAqSrFDDytJNXmLACL2GbKFg7qb6KKPCVxx", solanaKey.publicKey.toBase58()),
        ],
        preHooks: [],
        postHooks: []
    }

    console.log(`Creating bundle..., ${JSON.stringify(requestBody)}`);
    const bundle = await createBundleDev(requestBody);
    console.log("Bundle created successfully!");

    // Log the first intent for debugging
    if (bundle.intents && bundle.intents.length > 0) {
        console.log("First intent:", util.inspect(bundle.intents[0], {showHidden: false, depth: null, colors: true}));
    }

    // Using processIntentBundle to handle all intents at once
    console.log("Collecting signatures for all intents...");
    const signedDataArray = await processIntentBundle(bundle, walletClient);

    console.log(`Generated ${signedDataArray.length} signatures for ${bundle.intents?.length || 0} intents`);

    // Prepare the bundle with signatures - but don't submit yet
    const submitPayload = {
        ...bundle,
        requestId: requestBody.requestId,
        enableAccountAbstraction: true,
        isAtomic: true,
        signedData: signedDataArray
    };

    console.log(`Payload prepared with signatures. Ready for submission. payload: ${JSON.stringify(submitPayload)}`);

    console.log("Payload prepared with signatures. Ready for submission.");

    const submitResponse = await submitBundleDev(submitPayload);
    console.log("Submit response:", submitResponse);

    return submitPayload;
}

main().catch((error) => {
    console.error("\n🚨 FATAL ERROR in script execution:", error);
    process.exitCode = 1;
});
