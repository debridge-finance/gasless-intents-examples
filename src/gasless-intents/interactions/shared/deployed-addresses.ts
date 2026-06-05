import type { Address } from "viem";

const ZERO = "0x0000000000000000000000000000000000000000" as Address;

export const INTERACTION_CONTRACT_ADDRESSES = {
  LoggingInteractionHook: "0x20df8adc7b093594720334c69aa16a9d8d69580a" as Address,
  FillCounter: "0x0f3fed84e654fb3b1e2ae3af80e2dc786c9b7277" as Address,
  ProtocolFeeRecorder: "0xe04944aefa4d15aa0d322531b19cc8f06000c9c8" as Address,
  RewardMinter: "0xf1360c7d00b6cffa862f6645dba05babc47a097b" as Address,
  FillCapEnforcer: "0x3454ace276329902caeab59135439fb05cc644e5" as Address,
} as const;

export type InteractionContractName = keyof typeof INTERACTION_CONTRACT_ADDRESSES;

export const DEPLOYED_ADDRESSES = INTERACTION_CONTRACT_ADDRESSES;

export function requireDeployedAddress(name: InteractionContractName): Address {
  const addr = INTERACTION_CONTRACT_ADDRESSES[name];
  if (!addr) {
    throw new Error(
      `${name} has no entry in INTERACTION_CONTRACT_ADDRESSES. ` +
        `Add it to src/gasless-intents/interactions/shared/deployed-addresses.ts.`,
    );
  }
  if (addr === ZERO) {
    throw new Error(
      `${name} is recorded as the zero address - deploy it first, then update INTERACTION_CONTRACT_ADDRESSES.`,
    );
  }
  return addr;
}

export const requireInteractionContractAddress = requireDeployedAddress;
