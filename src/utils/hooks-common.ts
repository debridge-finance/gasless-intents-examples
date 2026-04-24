import { clipHexPrefix } from ".";
import { PLACEHOLDER_TOKEN_AMOUNT } from "./constants";

const DEADBEEF = "deadbeef";

/**
 * Generates a sentinel hex string of N bytes using the deadbeef pattern.
 * Default is 32 bytes (matching PLACEHOLDER_TOKEN_AMOUNT for EVM uint256).
 * For Solana u64, use N=8.
 */
export function generateSentinel(byteLength: number = 32): string {
  const hexLength = byteLength * 2;
  return DEADBEEF.repeat(Math.ceil(hexLength / DEADBEEF.length)).slice(0, hexLength);
}

/**
 * Reverses byte order of a hex string (big-endian to little-endian or vice versa).
 * e.g. "deadbeefdeadbeef" -> "efbeaddeefbeadde"
 */
export function hexToLittleEndian(hex: string): string {
  return hex.match(/.{2}/g)!.reverse().join("");
}

/**
 * Replaces the first PLACEHOLDER_TOKEN_AMOUNT sentinel with "{amount}".
 * Used for SimpleHook/Hook construction.
 */
export function replaceAmountPlaceholder(encodedCalldata: string, placeholderName: string = "amount"): string {
  return encodedCalldata.replace(
    clipHexPrefix(PLACEHOLDER_TOKEN_AMOUNT),
    `{${placeholderName}}`
  );
}

/**
 * Replaces N sequential PLACEHOLDER_TOKEN_AMOUNT sentinels with named placeholders.
 * String.replace() without /g replaces only the first match, so looping replaces
 * each occurrence in calldata order: {amount1}, {amount2}, etc.
 */
export function replaceNamedPlaceholders(
  encodedCalldata: string | `0x${string}`,
  placeholderNames: string[]
): string {
  const sentinel = clipHexPrefix(PLACEHOLDER_TOKEN_AMOUNT);
  let result = encodedCalldata;
  for (const name of placeholderNames) {
    result = result.replace(sentinel, `{${name}}`);
  }
  return result;
}
