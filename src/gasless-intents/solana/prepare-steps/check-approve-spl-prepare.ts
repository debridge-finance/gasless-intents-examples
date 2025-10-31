import { privateKeyToAccount } from 'viem/accounts'
import { randomUUID } from 'crypto';
import { Connection, Keypair, VersionedTransaction } from "@solana/web3.js";
import bs58 from "bs58";
import { getEnvConfig, toHexPrefixString } from "../../../utils";
import { getSolUsdcToBscUsdcTrade, getSolUsdcToPolyUsdcTrade } from "../../trades";
import { getApi } from "../../../utils/api";
import { TradingAlgorithm } from "../../types";
import { BASE_DEV_URL } from '../../../utils/constants';
import { extractTransactionHexData } from '../../../utils/solana';

const { createBundle } = getApi(BASE_DEV_URL);

async function main() {
  // Wallet setup
  const { privateKey, solPrivateKey } = getEnvConfig();

  const account = privateKeyToAccount(toHexPrefixString(privateKey));

  console.log(`account: ${account.address}`)

  const requestId = randomUUID();

  const solanaKey =
    Keypair.fromSecretKey(bs58.decode(solPrivateKey))

  console.log(solanaKey.publicKey.toBase58())

  // Trades body
  const requestBody = {
    requestId,
    expirationTimestamp: Math.floor(new Date().getTime() * 2 / 1000),
    enableAccountAbstraction: true,
    isAtomic: true,
    tradingAlgorithm: TradingAlgorithm.MARKET,
    trades: [
      getSolUsdcToPolyUsdcTrade(solanaKey.publicKey.toBase58(), account.address)
    ],
    preHooks: [],
    postHooks: []
  }

  console.log(`Creating bundle..., ${JSON.stringify(requestBody)}`);
  const bundle = await createBundle(requestBody);
  console.log(`Bundle created successfully: ${JSON.stringify(bundle)}`);

  const txForSign = extractTransactionHexData(bundle)[0];
  console.log(`Data for sigh: ${txForSign}`)
  const cleanHex = txForSign.startsWith("0x") ? txForSign.slice(2) : txForSign;
  const buf = Buffer.from(cleanHex, "hex");
  const versionedTransaction = VersionedTransaction.deserialize(buf)

  const connection = new Connection('https://api.mainnet-beta.solana.com', { commitment: "confirmed" })

  const bh = await connection.getLatestBlockhash({ commitment: 'confirmed' })

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
