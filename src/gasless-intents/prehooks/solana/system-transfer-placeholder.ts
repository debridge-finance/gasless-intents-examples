import { PublicKey, SystemProgram, TransactionMessage, VersionedTransaction } from "@solana/web3.js";
import { generateSentinel, hexToLittleEndian } from "@utils/hooks-common";
import { toHexPrefixString } from "@utils/index";

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
  placeholderName: string;
  recentBlockhash?: string;
}): `0x${string}` {
  const payerKey = typeof params.payer === "string" ? new PublicKey(params.payer) : params.payer;

  const recipientKey = typeof params.recipient === "string" ? new PublicKey(params.recipient) : params.recipient;

  const recentBlockhash = params.recentBlockhash || PLACEHOLDER_BLOCKHASH;
  const placeholder = `{${params.placeholderName}.8}`; // Add ".8" suffix to indicate 8-byte length for the placeholder

  // Sentinel as BigInt for the transfer instruction; Little Endian hex to find and replace in serialized tx.
  const sentinel = generateSentinel(8);
  const sentinelLamports = BigInt(toHexPrefixString(sentinel));
  const sentinelLeHex = hexToLittleEndian(sentinel);

  const ix = SystemProgram.transfer({
    fromPubkey: payerKey,
    toPubkey: recipientKey,
    lamports: sentinelLamports,
  });

  const messageV0 = new TransactionMessage({
    payerKey,
    recentBlockhash,
    instructions: [ix],
  }).compileToV0Message();

  const tx = new VersionedTransaction(messageV0);
  const serialized = tx.serialize();
  const hex = Buffer.from(serialized).toString("hex");

  const parts = hex.split(sentinelLeHex);
  if (parts.length !== 2) {
    throw new Error(
      `Expected exactly 1 sentinel match, found ${parts.length - 1} in serialized tx`,
    );
  }

  const outHex = parts.join(placeholder);

  return toHexPrefixString(outHex);
}
