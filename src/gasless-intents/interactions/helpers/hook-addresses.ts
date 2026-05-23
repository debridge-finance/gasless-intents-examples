import type { Address } from "viem";


export const HOOK_ADDRESSES = {
  LoggingInteractionHook: "0x20df8adc7b093594720334c69aa16a9d8d69580a" as Address,
  FillCounter: "0x0f3fed84e654fb3b1e2ae3af80e2dc786c9b7277" as Address,
  ProtocolFeeRecorder: "0xe04944aefa4d15aa0d322531b19cc8f06000c9c8" as Address,
  AllowlistGuard: "0x8909accb3b437a00dcb268d34a07473a60269e1b" as Address,
  RewardMinter: "0xf1360c7d00b6cffa862f6645dba05babc47a097b" as Address,
  FillCapEnforcer: "0x3454ace276329902caeab59135439fb05cc644e5" as Address,
} as const;

export type HookName = keyof typeof HOOK_ADDRESSES;

export function requireHookAddress(name: HookName): Address {
  const addr = HOOK_ADDRESSES[name];
  if (addr === "0x0000000000000000000000000000000000000000") {
    throw new Error(
      `${name} address not set in helpers/hook-addresses.ts — deploy the hook contract and update HOOK_ADDRESSES.`,
    );
  }
  return addr;
}
