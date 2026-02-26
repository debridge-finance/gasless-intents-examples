import { clipHexPrefix } from ".";
import { PLACEHOLDER_TOKEN_AMOUNT } from "./constants";

/**
 * Replaces the first PLACEHOLDER_TOKEN_AMOUNT sentinel with "{amount}".
 * Used for SimpleHook/Hook construction.
 */
export function replaceAmountPlaceholder(encodedCalldata: string): string {
  return encodedCalldata.replace(
    clipHexPrefix(PLACEHOLDER_TOKEN_AMOUNT),
    "{amount}"
  );
}

/**
 * Replaces N sequential PLACEHOLDER_TOKEN_AMOUNT sentinels with named placeholders.
 * String.replace() without /g replaces only the first match, so looping replaces
 * each occurrence in calldata order: {amount1}, {amount2}, etc.
 */
export function replaceNamedPlaceholders(
  encodedCalldata: string,
  placeholderNames: string[]
): string {
  const sentinel = clipHexPrefix(PLACEHOLDER_TOKEN_AMOUNT);
  let result = encodedCalldata;
  for (const name of placeholderNames) {
    result = result.replace(sentinel, `{${name}}`);
  }
  return result;
}
