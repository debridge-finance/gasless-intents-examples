export function clipHexPrefix(input: string): string {
  if (input.startsWith("0x")) {
    return input.slice(2);
  }
  return input;
}

export function toHexPrefixString(input: string): `0x${string}` {
  if (input.startsWith("0x")) {
    return input as `0x${string}`;
  }
  return `0x${input}`;
}