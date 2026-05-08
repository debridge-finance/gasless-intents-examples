import {
  PublicKey,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import { toHexPrefixString } from "@utils/index";

const MEMO_PROGRAM_ID = new PublicKey(
  "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr",
);

const PLACEHOLDER_BLOCKHASH = "11111111111111111111111111111111";

export function buildSolanaVersionedMemoTxHex(params: {
  payer: string | PublicKey;
  memo: string;
  recentBlockhash?: string;
}): `0x${string}` {
  const payerKey =
    typeof params.payer === "string" ? new PublicKey(params.payer) : params.payer;

  const recentBlockhash = params.recentBlockhash || PLACEHOLDER_BLOCKHASH;

  const memoIx = new TransactionInstruction({
    keys: [],
    programId: MEMO_PROGRAM_ID,
    data: Buffer.from(params.memo, "utf8"),
  });

  const messageV0 = new TransactionMessage({
    payerKey,
    recentBlockhash,
    instructions: [memoIx],
  }).compileToV0Message();

  // Intentionally NOT signing here. WalletServiceSolana will sign later.
  const tx = new VersionedTransaction(messageV0);

  const serialized = tx.serialize();
  const hex = Buffer.from(serialized).toString("hex");

  return toHexPrefixString(hex);
}
