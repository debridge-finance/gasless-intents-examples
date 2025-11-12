import {privateKeyToAccount} from 'viem/accounts'
import {getEnvConfig, toHexPrefixString} from "../../../utils";
import {randomUUID} from 'crypto';
import bs58 from 'bs58';
import {getSolToPolyUsdcTrade} from "../../trades";
import {Keypair} from "@solana/web3.js"
import {getApi} from "../../../utils/api";
import {Bundle, BundleProposeBody, TradingAlgorithm} from "../../types";
import {BASE_URL} from '../../../utils/constants';
import {processIntentBundle} from '../../../utils/signatures/intent-signatures';
import {getChainIdToWalletClientMap} from '../../../utils/wallet';

const {createBundle, submitBundle} = getApi(BASE_URL);

async function main() {
    // Wallet setup
    const {privateKey, solPrivateKey} = getEnvConfig();

    const account = privateKeyToAccount(toHexPrefixString(privateKey));
    const solanaKey = Keypair.fromSecretKey(bs58.decode(solPrivateKey))

    const requestId = randomUUID();

    const chainIdToWalletClientMap = getChainIdToWalletClientMap(account, solanaKey);

    // Trades body
    console.log(`solana key: ${solanaKey.publicKey.toBase58()}`)
    console.log(`solana key: ${account.address}`)
    const requestBody: BundleProposeBody = {
        requestId,
        referralCode: 31805,
        expirationTimestamp: Math.floor(new Date().getTime() * 2 / 1000),
        enableAccountAbstraction: false,
        isAtomic: true,
        tradingAlgorithm: TradingAlgorithm.MARKET,
        trades: [
            getSolToPolyUsdcTrade("79bWNoaxKKAqSrFDDytJNXmLACL2GbKFg7qb6KKPCVxx", account.address),
        ],
        preHooks: [],
        postHooks: [],
    }

    console.log(`Creating bundle... ${JSON.stringify(requestBody)}`);
    const bundle = await createBundle(requestBody);
    console.log(`Bundle created successfully!, ${JSON.stringify(bundle)}`);

    const signedData = await processIntentBundle(bundle, chainIdToWalletClientMap);

    const submitPayload: Bundle = {
        ...bundle,
        requestId: requestBody.requestId,
        enableAccountAbstraction: false,
        isAtomic: true,
        signedData
    };

    console.log(`Payload prepared with signatures. Ready for submission. payload: ${JSON.stringify(submitPayload)}`);

    const submitResponse = await submitBundle(submitPayload);
    console.log("Submit response:", submitResponse);

    return submitPayload;
}

main().catch((error) => {
    console.error("\n🚨 FATAL ERROR in script execution:", error);
    process.exitCode = 1;
});
