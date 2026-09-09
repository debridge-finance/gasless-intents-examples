import type { Abi } from "viem";
import { ECHO_ABI } from "./echo";
import { ECHO_WITH_SIG_ABI } from "./echo-with-sig";
import { LOGGING_INTERACTION_HOOK_ABI } from "./logging-interaction-hook";
import { FILL_COUNTER_ABI } from "./fill-counter";
import { PROTOCOL_FEE_RECORDER_ABI } from "./protocol-fee-recorder";
import { REWARD_MINTER_ABI } from "./reward-minter";
import { FILL_CAP_ENFORCER_ABI } from "./fill-cap-enforcer";

const ABIS: Record<string, Abi> = {
  Echo: ECHO_ABI as unknown as Abi,
  EchoWithSig: ECHO_WITH_SIG_ABI as unknown as Abi,
  LoggingInteractionHook: LOGGING_INTERACTION_HOOK_ABI as unknown as Abi,
  FillCounter: FILL_COUNTER_ABI as unknown as Abi,
  ProtocolFeeRecorder: PROTOCOL_FEE_RECORDER_ABI as unknown as Abi,
  RewardMinter: REWARD_MINTER_ABI as unknown as Abi,
  FillCapEnforcer: FILL_CAP_ENFORCER_ABI as unknown as Abi,
};

export function loadAbi(contractName: string): Abi {
  const abi = ABIS[contractName];
  if (!abi) {
    throw new Error(
      `No ABI snapshot for "${contractName}" in shared/abis/. ` +
        `Add it under shared/abis/<kebab-name>.ts and register it in shared/abis/index.ts.`,
    );
  }
  return abi;
}

export {
  ECHO_ABI,
  ECHO_WITH_SIG_ABI,
  LOGGING_INTERACTION_HOOK_ABI,
  FILL_COUNTER_ABI,
  PROTOCOL_FEE_RECORDER_ABI,
  REWARD_MINTER_ABI,
  FILL_CAP_ENFORCER_ABI,
};
