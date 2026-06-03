import type { Address } from "viem";

/**
 * Hardcoded deployed-on-Base addresses for the contracts referenced by the
 * contract-utils scripts.
 */

const ZERO = "0x0000000000000000000000000000000000000000" as Address;

export const DEPLOYED_ADDRESSES: Record<string, Address> = {
  Echo: "0xa77563ce5dfb7fe631d4b9fba8968efbb1f722c8",
  EchoWithSig: "0x30f1acea1948fa286f6ebd948d79fadeb2ae1ca9",
  LoggingInteractionHook: "0x20df8adc7b093594720334c69aa16a9d8d69580a",
  FillCounter: "0x0f3fed84e654fb3b1e2ae3af80e2dc786c9b7277",
  ProtocolFeeRecorder: "0xe04944aefa4d15aa0d322531b19cc8f06000c9c8",
  AllowlistGuard: "0x8909accb3b437a00dcb268d34a07473a60269e1b",
  RewardMinter: "0xf1360c7d00b6cffa862f6645dba05babc47a097b",
  FillCapEnforcer: "0x3454ace276329902caeab59135439fb05cc644e5",
};

export function requireDeployedAddress(name: string): Address {
  const addr = DEPLOYED_ADDRESSES[name];
  if (!addr) {
    throw new Error(
      `${name} has no entry in DEPLOYED_ADDRESSES. ` +
        `Add it to src/gasless-intents/interactions/contract-utils/shared/deployed-addresses.ts.`,
    );
  }
  if (addr === ZERO) {
    throw new Error(
      `${name} is recorded as the zero address - deploy it first, then update DEPLOYED_ADDRESSES.`,
    );
  }
  return addr;
}
