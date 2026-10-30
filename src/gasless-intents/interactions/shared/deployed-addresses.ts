import type { Address } from "viem";

const ZERO = "0x0000000000000000000000000000000000000000" as Address;

export const INTERACTION_CONTRACT_ADDRESSES = {
  LoggingInteractionHook: "0x17c94c6daecd6f5c99fc0284f1159dc4eb76f3ed" as Address,
  FillCounter: "0x31c646be72f5df8e1d2188e375b3cd4b6a5097ab" as Address,
  ProtocolFeeRecorder: "0x06849f0fad887e73c57e44ede0821fbbc63ee1f9" as Address,
  RewardMinter: "0xf359104c960ddecedd207b679450abdc9d7c6481" as Address,
  FillCapEnforcer: "0xbc4a0ed3b62dd5d9512f954f43fcf5c23811b15e" as Address,
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
