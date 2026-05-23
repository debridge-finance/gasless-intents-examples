/**
 * On-chain dry-run for echoed interaction payloads.
 *
 * For every (hookTarget, hookPayload) the API echoes back, this helper rebuilds
 * the EXACT calldata the IntentManager would send (selector + ABI-encoded
 * arguments) and dispatches it via raw `eth_call` against the live deployed
 * hook on Base mainnet. No transactions are sent, no state changes — the
 * simulation reports whether the call would succeed or revert, and surfaces
 * the decoded revert reason when applicable.
 *
 * The set of hook contracts is small and known (see `HOOK_ADDRESSES`). The
 * function selector picked per call:
 *   - pre-interactions  → `onPreCall(bytes32,bytes32,bytes)`
 *   - post-interactions → one of:
 *       `onPostCallForSameChainIntentWithPreSwap((bytes32,bytes32,bytes,...))`
 *       `onPostCallForCrossChainIntentWithPreSwap((bytes32,bytes32,bytes,...))`
 *       `onPostCallForCrossChainIntent((bytes32,bytes32,bytes,...))`
 *     selected by `tradeKind`.
 */
import {
  decodeErrorResult,
  encodeFunctionData,
  type Abi,
  type Address,
  type Hex,
  type PublicClient,
} from "viem";
import { randomBytes } from "node:crypto";
import { loadAbi } from "../contract-utils/shared/artefact-loader";
import { HOOK_ADDRESSES, type HookName } from "./hook-addresses";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as Address;
const ZERO_BYTES = "0x" as Hex;

export type TradeKind =
  | "SameChainWithPreSwap"
  | "CrossChainWithPreSwap"
  | "CrossChainNoPreSwap";

const POST_FN_BY_KIND: Record<TradeKind, string> = {
  SameChainWithPreSwap: "onPostCallForSameChainIntentWithPreSwap",
  CrossChainWithPreSwap: "onPostCallForCrossChainIntentWithPreSwap",
  CrossChainNoPreSwap: "onPostCallForCrossChainIntent",
};

const HOOK_NAME_BY_ADDRESS: Map<string, HookName> = new Map(
  (Object.entries(HOOK_ADDRESSES) as [HookName, Address][]).map(
    ([name, addr]) => [addr.toLowerCase(), name],
  ),
);

export type InteractionDryRunResult = {
  index: number;
  position: "pre" | "post";
  hookTarget: Address;
  hookName: HookName | "UNKNOWN";
  fn: string;
  calldata: Hex;
  outcome: "success" | "revert" | "error";
  revertReason?: string;
};

export type OnChainVerifyReport = {
  intentId: Hex;
  tradeId: Hex;
  tradeKind: TradeKind;
  preResults: InteractionDryRunResult[];
  postResults: InteractionDryRunResult[];
};

export function syntheticTradeId(): Hex {
  return ("0x" + randomBytes(32).toString("hex")) as Hex;
}

/**
 * Gate-1 check: the server-echoed interaction array must be byte-identical
 * (case-insensitive) to what the script sent. Returns `null` on match,
 * otherwise a human-readable description of the divergence.
 */
export function assertEchoMatchesSubmitted(
  position: "pre" | "post",
  submitted: ReadonlyArray<{ hookTarget: string; hookPayload: string }>,
  echoed: ReadonlyArray<{ hookTarget: string; hookPayload: string }>,
): string | null {
  if (submitted.length !== echoed.length) {
    return `${position}Interactions length mismatch: submitted=${submitted.length}, echoed=${echoed.length}`;
  }
  for (let i = 0; i < submitted.length; ++i) {
    const a = submitted[i];
    const b = echoed[i];
    if (a.hookTarget.toLowerCase() !== b.hookTarget.toLowerCase()) {
      return `${position}[${i}].hookTarget mismatch: submitted=${a.hookTarget}, echoed=${b.hookTarget}`;
    }
    if (a.hookPayload.toLowerCase() !== b.hookPayload.toLowerCase()) {
      return `${position}[${i}].hookPayload mismatch (lengths submitted=${(a.hookPayload.length - 2) / 2}B, echoed=${(b.hookPayload.length - 2) / 2}B)`;
    }
  }
  return null;
}

export async function verifyEchoedInteractions(opts: {
  intentId: Hex | string;
  preInteractions: ReadonlyArray<{ hookTarget: string; hookPayload: string }>;
  postInteractions: ReadonlyArray<{ hookTarget: string; hookPayload: string }>;
  tradeKind: TradeKind;
  publicClient: PublicClient;
  account: Address;
  tradeId?: Hex;
}): Promise<OnChainVerifyReport> {
  const tradeId = opts.tradeId ?? syntheticTradeId();
  const postFn = POST_FN_BY_KIND[opts.tradeKind];
  const intentId = opts.intentId as Hex;

  const preResults: InteractionDryRunResult[] = [];
  for (let i = 0; i < opts.preInteractions.length; ++i) {
    const it = opts.preInteractions[i];
    const hookTarget = it.hookTarget as Address;
    const hookPayload = it.hookPayload as Hex;
    preResults.push(
      await runOne({
        index: i,
        position: "pre",
        hookTarget,
        hookPayload,
        fn: "onPreCall",
        argsBuilder: (abi) => ({
          abi,
          args: [intentId, tradeId, hookPayload] as const,
        }),
        publicClient: opts.publicClient,
        account: opts.account,
      }),
    );
  }

  const postResults: InteractionDryRunResult[] = [];
  for (let i = 0; i < opts.postInteractions.length; ++i) {
    const it = opts.postInteractions[i];
    const hookTarget = it.hookTarget as Address;
    const hookPayload = it.hookPayload as Hex;
    postResults.push(
      await runOne({
        index: i,
        position: "post",
        hookTarget,
        hookPayload,
        fn: postFn,
        argsBuilder: (abi) => ({
          abi,
          args: [
            buildContext({
              tradeKind: opts.tradeKind,
              intentId,
              tradeId,
              payload: hookPayload,
              account: opts.account,
            }),
          ] as const,
        }),
        publicClient: opts.publicClient,
        account: opts.account,
      }),
    );
  }

  return {
    intentId,
    tradeId,
    tradeKind: opts.tradeKind,
    preResults,
    postResults,
  };
}

async function runOne(opts: {
  index: number;
  position: "pre" | "post";
  hookTarget: Address;
  hookPayload: Hex;
  fn: string;
  argsBuilder: (abi: Abi) => { abi: Abi; args: readonly unknown[] };
  publicClient: PublicClient;
  account: Address;
}): Promise<InteractionDryRunResult> {
  const hookName =
    HOOK_NAME_BY_ADDRESS.get(opts.hookTarget.toLowerCase()) ?? "UNKNOWN";

  if (hookName === "UNKNOWN") {
    return {
      index: opts.index,
      position: opts.position,
      hookTarget: opts.hookTarget,
      hookName,
      fn: opts.fn,
      calldata: "0x" as Hex,
      outcome: "error",
      revertReason: `Unknown hookTarget ${opts.hookTarget} — not in HOOK_ADDRESSES`,
    };
  }

  let abi: Abi;
  try {
    abi = loadAbi(hookName);
  } catch (err) {
    return {
      index: opts.index,
      position: opts.position,
      hookTarget: opts.hookTarget,
      hookName,
      fn: opts.fn,
      calldata: "0x" as Hex,
      outcome: "error",
      revertReason: `Failed to load ABI for ${hookName}: ${
        err instanceof Error ? err.message : String(err)
      }`,
    };
  }

  let calldata: Hex;
  try {
    const { args } = opts.argsBuilder(abi);
    calldata = encodeFunctionData({
      abi,
      functionName: opts.fn,
      args: args as any,
    }) as Hex;
  } catch (err) {
    return {
      index: opts.index,
      position: opts.position,
      hookTarget: opts.hookTarget,
      hookName,
      fn: opts.fn,
      calldata: "0x" as Hex,
      outcome: "error",
      revertReason: `Failed to encode calldata: ${
        err instanceof Error ? err.message : String(err)
      }`,
    };
  }

  try {
    await opts.publicClient.call({
      to: opts.hookTarget,
      data: calldata,
      account: opts.account,
    });
    return {
      index: opts.index,
      position: opts.position,
      hookTarget: opts.hookTarget,
      hookName,
      fn: opts.fn,
      calldata,
      outcome: "success",
    };
  } catch (err) {
    return {
      index: opts.index,
      position: opts.position,
      hookTarget: opts.hookTarget,
      hookName,
      fn: opts.fn,
      calldata,
      outcome: "revert",
      revertReason: extractRevertReason(err, abi),
    };
  }
}

function buildContext(opts: {
  tradeKind: TradeKind;
  intentId: Hex;
  tradeId: Hex;
  payload: Hex;
  account: Address;
}): unknown {
  switch (opts.tradeKind) {
    case "SameChainWithPreSwap":
      return {
        intentId: opts.intentId,
        tradeId: opts.tradeId,
        payload: opts.payload,
        preSwapResults: [],
        takeToken: ZERO_ADDRESS,
        takeAmountAfterFeeCharge: 0n,
        receiver: opts.account,
      };
    case "CrossChainWithPreSwap":
      return {
        intentId: opts.intentId,
        tradeId: opts.tradeId,
        payload: opts.payload,
        preSwapResults: [],
        giveToken: ZERO_ADDRESS,
        giveAmount: 0n,
        takeToken: ZERO_BYTES,
        takeAmount: 0n,
        takeChainId: 0,
        takeChainReceiver: ZERO_BYTES,
      };
    case "CrossChainNoPreSwap":
      return {
        intentId: opts.intentId,
        tradeId: opts.tradeId,
        payload: opts.payload,
        giveToken: ZERO_ADDRESS,
        giveAmount: 0n,
        takeToken: ZERO_BYTES,
        takeAmount: 0n,
        takeChainId: 0,
        takeChainReceiver: ZERO_BYTES,
      };
  }
}

function extractRevertReason(err: unknown, abi: Abi): string {
  const errAny = err as { cause?: { data?: Hex; reason?: string }; shortMessage?: string; message?: string };
  const raw =
    errAny?.cause?.data ??
    (typeof errAny?.message === "string" && /0x[0-9a-fA-F]+/.exec(errAny.message ?? "")?.[0] as Hex | undefined);
  if (typeof raw === "string" && raw.startsWith("0x") && raw.length >= 10) {
    try {
      const decoded = decodeErrorResult({ abi, data: raw as Hex });
      const argsRepr = (decoded.args ?? [])
        .map((a) => (typeof a === "bigint" ? a.toString() : String(a)))
        .join(", ");
      return `${decoded.errorName}(${argsRepr})`;
    } catch {
      // fall through
    }
  }
  return (
    errAny?.cause?.reason ??
    errAny?.shortMessage ??
    errAny?.message ??
    String(err)
  );
}

export function summariseReport(report: OnChainVerifyReport): string {
  const lines: string[] = [];
  const all = [...report.preResults, ...report.postResults];
  const ok = all.filter((r) => r.outcome === "success").length;
  lines.push(
    `On-chain dry-run: ${ok}/${all.length} calls succeeded (tradeKind=${report.tradeKind})`,
  );
  for (const r of all) {
    const marker = r.outcome === "success" ? "✓" : r.outcome === "revert" ? "✗" : "!";
    const tag = `${r.position}[${r.index}] ${r.hookName}.${r.fn}`;
    const detail =
      r.outcome === "success"
        ? "ok"
        : `${r.outcome}: ${r.revertReason ?? "(unknown)"}`;
    lines.push(`  ${marker} ${tag} — ${detail}`);
    lines.push(`      calldata=${truncateHex(r.calldata, 80)}`);
  }
  return lines.join("\n");
}

function truncateHex(hex: Hex, width: number): string {
  if (hex.length <= width) return hex;
  return `${hex.slice(0, width - 4)}…(${(hex.length - 2) / 2} bytes)`;
}
