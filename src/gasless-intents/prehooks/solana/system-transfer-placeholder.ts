import {
  PublicKey,
  SystemProgram,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";

const PLACEHOLDER_BLOCKHASH = "11111111111111111111111111111111";

/**
 * Builds an unsigned Solana VersionedTransaction containing a SystemProgram.transfer
 * instruction, with the lamports amount replaced by a placeholder string.
 *
 * The placeholder encoding (`{name.N}` where N = byte length) spec is not yet
 * fully verified. This builder uses the hardcoded sentinel approach from
 * taf-backend-ts rather than generalized placeholder utilities.
 * A generalized byte-length placeholder system can be built once the spec is confirmed.
 */
export function buildSolanaSystemTransferTxHexWithAmountPlaceholder(params: {
  payer: string | PublicKey;
  recipient: string | PublicKey;
  placeholder?: string; // e.g. "{amount.8}"
  recentBlockhash?: string;
}): `0x${string}` {
  const payerKey =
    typeof params.payer === "string" ? new PublicKey(params.payer) : params.payer;

  const recipientKey =
    typeof params.recipient === "string"
      ? new PublicKey(params.recipient)
      : params.recipient;

  const recentBlockhash = params.recentBlockhash || PLACEHOLDER_BLOCKHASH;
  const placeholder = params.placeholder || "{amount.8}";

  // Use a unique sentinel amount so we can safely locate and replace it in the serialized tx.
  // Important: SystemProgram.transfer accepts a JS number; keep it <= 2^53-1 to avoid precision loss.
  const sentinelLamports = 0x0011223344556677n;
  const sentinelLeHex = "7766554433221100"; // u64 LE encoding of sentinelLamports

  const ix = SystemProgram.transfer({
    fromPubkey: payerKey,
    toPubkey: recipientKey,
    lamports: Number(sentinelLamports),
  });

  const messageV0 = new TransactionMessage({
    payerKey,
    recentBlockhash,
    instructions: [ix],
  }).compileToV0Message();

  const tx = new VersionedTransaction(messageV0);
  const serialized = tx.serialize();
  const hex = Buffer.from(serialized).toString("hex");

  const idx = hex.indexOf(sentinelLeHex);
  if (idx < 0) {
    throw new Error(
      `[buildSolanaSystemTransferTxHexWithAmountPlaceholder] Sentinel lamports pattern not found in serialized tx. ` +
        `sentinelLeHex=${sentinelLeHex} hexPrefix=0x${hex.slice(0, 64)}`,
    );
  }

  const idx2 = hex.indexOf(sentinelLeHex, idx + 1);
  if (idx2 >= 0) {
    throw new Error(
      `[buildSolanaSystemTransferTxHexWithAmountPlaceholder] Sentinel lamports pattern found more than once in serialized tx. ` +
        `firstIdx=${idx} secondIdx=${idx2}`,
    );
  }

  const outHex = `${hex.slice(0, idx)}${placeholder}${hex.slice(idx + sentinelLeHex.length)}`;

  return `0x${outHex}`;
}
