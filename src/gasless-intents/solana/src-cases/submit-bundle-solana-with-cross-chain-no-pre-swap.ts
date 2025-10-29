import {privateKeyToAccount} from 'viem/accounts'
import {getEnvConfig} from "../../../utils";
import {randomUUID} from 'crypto';
import bs58 from 'bs58';
import util from "util"
import {getSolUsdcToPolUsdcTrade} from "../../trades";
import {Keypair} from "@solana/web3.js"
import nacl from "tweetnacl";
import {createBundleDev, submitBundleDev} from "../../../utils/api";
import {TradingAlgorithm} from "../../types";

function remove0xPrefix(input: string): string {
    if (input.startsWith("0x")) {
        return input.slice(2);
    }
    return input;
}

export const userSender = Keypair.generate()

async function main() {
    // Wallet setup
    const {privateKey} = getEnvConfig();

    const account = privateKeyToAccount(`0x${remove0xPrefix(privateKey)}`);

    const requestId = randomUUID();

    // Trades body
    console.log(`solana key: ${userSender.publicKey.toBase58()}`)
    console.log(`solana key: ${account.address}`)
    const requestBody = {
        requestId,
        expirationTimestamp: Math.floor(new Date().getTime() * 2 / 1000),
        enableAccountAbstraction: false,
        isAtomic: true,
        tradingAlgorithm: TradingAlgorithm.MARKET,
        trades: [
            getSolUsdcToPolUsdcTrade(userSender.publicKey.toBase58(), account.address)
        ],
        preHooks: [],
        postHooks: []
    }

    console.log(`Creating bundle... ${JSON.stringify(requestBody)}`);
    const bundle = await createBundleDev(requestBody);
    console.log(`Bundle created successfully!, ${JSON.stringify(bundle)}`);

    // todo:
    // Log the first intent for debugging
    if (bundle.intents && bundle.intents.length > 0) {
        console.log("First intent:", util.inspect(bundle.intents[0], {showHidden: false, depth: null, colors: true}));
    }
    const dataForSign = extractSignData(bundle)
    console.log(`dataForSign: ${JSON.stringify(dataForSign)}`);
    // sign from user
    const signatures = signHexMessageBySolanaKey(dataForSign, userSender);
    const actionId = extractSignAction(bundle).actionId
    console.log(`signatures: ${JSON.stringify(signatures)}`, signatures);
    console.log(`actionId: ${actionId}`);

    // Prepare the bundle with signatures - but don't submit yet
    const submitPayload = {
        ...bundle,
        requestId: requestBody.requestId,
        enableAccountAbstraction: true,
        isAtomic: true,
        signedData: Array.of({actionId: actionId, signedData: `0x${signatures.hex}`})
    };

    console.log(`Payload prepared with signatures. Ready for submission. payload: ${JSON.stringify(submitPayload)}`);

    const submitResponse = await submitBundleDev(submitPayload);
    console.log("Submit response:", submitResponse);

    return submitPayload;
}

main().catch((error) => {
    console.error("\n🚨 FATAL ERROR in script execution:", error);
    process.exitCode = 1;
});

function extractSignData(payload) {
    if (!payload?.intents) return null;

    for (const intent of payload.intents) {
        if (!intent.requiredActions) continue;

        for (const action of intent.requiredActions) {
            if (action.type === "Sign" && action.actions?.includes("Intent")) {
                return action?.data?.data || null;
            }
        }
    }
    return null;
}

function extractSignAction(payload) {
    if (!payload?.intents) return null;

    for (const intent of payload.intents) {
        if (!intent.requiredActions) continue;

        for (const action of intent.requiredActions) {
            if (action.type === "Sign" && action.actions?.includes("Intent")) {
                return {
                    data: action?.data?.data || null,
                    actionId: action?.actionId || null
                };
            }
        }
    }
    return null;
}

function signHexMessageBySolanaKey(
    messageHex: string,
    privateKey: Keypair
) {
    const message = Buffer.from(messageHex.slice(2), 'hex');
    let pkForSign = privateKey.secretKey;
    const sig = nacl.sign.detached(message, pkForSign);
    return {
        hex: Buffer.from(sig).toString("hex"),
        base58: bs58.encode(sig),
        base64: Buffer.from(sig).toString("base64")
    };
}
