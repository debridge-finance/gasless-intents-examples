// Calldata placeholder substitution for EIP-712 messages.
//
// Used by the delegated + deferred hook flow (Sign712MetaMaskWithPlaceholders
// in intent-signatures.ts): the API ships hook caveats whose `terms` bytes
// embed {name} / {name.<N>} markers, and the client must inline providedData
// hex values into those markers *before* signTypedData(...). Otherwise the
// EIP-712 digest the user signs disagrees with the digest the API re-derives
// from the submit payload and the digest the on-chain DeleGator recomputes
// from the substituted caveats[].terms, and signature recovery fails.

type Eip712MessageNode =
  | string
  | number
  | boolean
  | null
  | Eip712MessageNode[]
  | { [key: string]: Eip712MessageNode };

const PLACEHOLDER_RE = /\{([a-zA-Z_]\w*)(?:\.\d+)?\}/g;

export function substitutePlaceholdersInMessage(
  message: Eip712MessageNode,
  values: Record<string, string>,
): Eip712MessageNode {
  const result = replacePlaceholdersDeep(message, values);
  assertNoUnresolvedPlaceholders(result, values);
  return result;
}

function replacePlaceholdersDeep(
  value: Eip712MessageNode,
  placeholders: Record<string, string>,
): Eip712MessageNode {
  if (typeof value === "string") {
    return replacePlaceholdersInString(value, placeholders);
  }

  if (Array.isArray(value)) {
    return value.map((item) => replacePlaceholdersDeep(item, placeholders));
  }

  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, childValue]) => [
        key,
        replacePlaceholdersDeep(childValue, placeholders),
      ]),
    );
  }

  return value;
}

function replacePlaceholdersInString(
  value: string,
  placeholders: Record<string, string>,
): string {
  return value.replace(PLACEHOLDER_RE, (fullMatch, name: string) => {
    const replacement = placeholders[name];

    // Leave unresolved placeholders in place.
    // assertNoUnresolvedPlaceholders() will throw a readable error later.
    if (replacement === undefined) {
      return fullMatch;
    }

    return stripHexPrefix(replacement);
  });
}

function assertNoUnresolvedPlaceholders(
  value: Eip712MessageNode,
  providedValues: Record<string, string>,
): void {
  const unresolved = findFirstPlaceholder(value);

  if (unresolved === undefined) {
    return;
  }

  throw new Error(
    `substitutePlaceholdersInMessage: marker ${unresolved} not resolved by provided values ` +
      `[${Object.keys(providedValues).join(", ") || "(none)"}]. ` +
      `Supply a hex value for every {name} present in the EIP-712 message via providedDataMap.`,
  );
}

function findFirstPlaceholder(value: Eip712MessageNode): string | undefined {
  if (typeof value === "string") {
    const match = value.match(PLACEHOLDER_RE);
    return match?.[0];
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findFirstPlaceholder(item);
      if (found !== undefined) return found;
    }

    return undefined;
  }

  if (isPlainObject(value)) {
    for (const childValue of Object.values(value)) {
      const found = findFirstPlaceholder(childValue);
      if (found !== undefined) return found;
    }
  }

  return undefined;
}

function stripHexPrefix(value: string): string {
  return value.startsWith("0x") || value.startsWith("0X")
    ? value.slice(2)
    : value;
}

function isPlainObject(
  value: Eip712MessageNode,
): value is { [key: string]: Eip712MessageNode } {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
