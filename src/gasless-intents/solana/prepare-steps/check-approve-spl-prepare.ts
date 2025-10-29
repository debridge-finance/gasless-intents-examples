import {privateKeyToAccount} from 'viem/accounts'
import {randomUUID} from 'crypto';
import {Connection, Keypair, VersionedTransaction} from "@solana/web3.js";
import bs58 from "bs58";
import {getEnvConfig} from "../../../utils";
import {getSolUsdcToBscUsdcTrade} from "../../trades";
import {createBundleDev} from "../../../utils/api";
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

    console.log(`account: ${account.address}`)

    const requestId = randomUUID();

    const solanaKey =
        Keypair.fromSecretKey(bs58.decode("41zEbhk7HyBwLFZL4RxJyXBHZ4tU8fHKBXhhuXfxM13KrMgukmT9nM2J9sm2Hbm2sMgfGh8knH9hk834KHpFA5GR"))

    console.log(solanaKey.publicKey.toBase58())

    // Trades body
    const requestBody = {
        requestId,
        expirationTimestamp: Math.floor(new Date().getTime() * 2 / 1000),
        enableAccountAbstraction: true,
        isAtomic: true,
        tradingAlgorithm: TradingAlgorithm.MARKET,
        trades: [
            getSolUsdcToBscUsdcTrade(solanaKey.publicKey.toBase58(), account.address)
        ],
        preHooks: [],
        postHooks: []
    }

    console.log(`Creating bundle..., ${JSON.stringify(requestBody)}`);
    const bundle = await createBundleDev(requestBody);
    console.log(`Bundle created successfully: ${JSON.stringify(bundle)}`);

    const txForSign = extractTransactionHexData(bundle)[0];
    console.log(`Data for sigh: ${txForSign}`)
    const cleanHex = txForSign.startsWith("0x") ? txForSign.slice(2) : txForSign;
    const buf = Buffer.from(cleanHex, "hex");
    const versionedTransaction = VersionedTransaction.deserialize(buf)

    const connection = new Connection('https://api.mainnet-beta.solana.com', {commitment: "confirmed"})

    const bh = await connection.getLatestBlockhash({commitment: 'confirmed'})

    console.log(versionedTransaction.message.recentBlockhash)
    versionedTransaction.message.recentBlockhash = bh.blockhash
    console.log(versionedTransaction.message.recentBlockhash)

    versionedTransaction.sign([solanaKey])
    const sig = await connection.sendTransaction(versionedTransaction)
    console.log(`Signature: ${sig}`)
}

main().catch((error) => {
    console.error("\n🚨 FATAL ERROR in script execution:", error);
    process.exitCode = 1;
});

export function extractTransactionHexData(obj: any): string[] {
    const result: string[] = [];

    if (!obj?.intents) return result;

    for (const intent of obj.intents) {
        const requiredActions = intent?.requiredActions;
        if (!Array.isArray(requiredActions)) continue;

        for (const action of requiredActions) {
            if (action?.type === "Transaction" && typeof action?.data?.data === "string") {
                result.push(action.data.data);
            }
        }
    }

    return result;
}

