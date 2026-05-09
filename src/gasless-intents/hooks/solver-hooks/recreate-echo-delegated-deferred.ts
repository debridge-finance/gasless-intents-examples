import { randomBytes, randomUUID } from "crypto";
import {
  createPublicClient,
  decodeEventLog,
  encodeFunctionData,
  hexToBytes,
  http,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";

import { clipHexPrefix, getEnvConfig } from "@utils/index";
import { createBundle, submitBundle } from "@utils/api";
import { CHAIN_IDS } from "@utils/chains";
import { getChainIdToWalletClientMap } from "@utils/wallet";
import { processIntentBundle } from "@utils/signatures/intent-signatures";
import { logActionTypes } from "@utils/logging";

import {
  BundleProposeBody,
  ExtendedHook,
  HookExecutionType,
  PlaceholderResolutionType,
  ProvidedDataMap,
  TradingAlgorithm,
} from "../../types";

import { pollUntilTerminal, writeArtifact } from "./_recreate-helpers";

const SCENARIO = "echo-delegated-deferred";

const ECHO_WITH_SIG = "0x30f1acea1948fa286f6ebd948d79fadeb2ae1ca9";
const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

const echoWithSigAbi = [
  {
    type: "function",
    name: "echoWithSig",
    stateMutability: "nonpayable",
    inputs: [
      { name: "user", type: "address" },
      { name: "nonce", type: "bytes32" },
      { name: "message", type: "string" },
      { name: "deadline", type: "uint256" },
      { name: "signature", type: "bytes" },
    ],
    outputs: [],
  },
  {
    type: "event",
    name: "MessageEchoed",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "nonce", type: "bytes32", indexed: true },
      { name: "message", type: "string", indexed: false },
      { name: "signature", type: "bytes", indexed: false },
    ],
    anonymous: false,
  },
] as const;

type EchoMessageArgs = {
  user: `0x${string}`;
  nonce: `0x${string}`;
  message: string;
  deadline: bigint;
};

function buildPrehookCalldataTemplate(args: EchoMessageArgs): `0x${string}` {
  const dummySig = ("0x" + "00".repeat(65)) as `0x${string}`;
  const encoded = encodeFunctionData({
    abi: echoWithSigAbi,
    functionName: "echoWithSig",
    args: [args.user, args.nonce, args.message, args.deadline, dummySig],
  });
  // Last 192 hex chars = 65 sig bytes + 31 zero-pad bytes (3 × 32-byte ABI words).
  // bytes signature is the LAST argument, so this slice maps to the sig data slot.
  const head = encoded.slice(0, encoded.length - 192);
  const tail = "{signature.65}" + "00".repeat(31);
  return (head + tail) as `0x${string}`;
}

function findExecutionTxHash(fulfillment: unknown): `0x${string}` | null {
  const f = fulfillment as Record<string, unknown> | null;
  if (!f) return null;

  const execBatches = (f.execBatches as unknown[] | undefined) ?? [];
  for (const batch of execBatches) {
    const found = walkForTxHash(batch);
    if (found) return found;
  }
  const tradeGroups = (f.tradeGroups as unknown[] | undefined) ?? [];
  for (const group of tradeGroups) {
    const found = walkForTxHash(group);
    if (found) return found;
  }
  return null;
}

function walkForTxHash(node: unknown): `0x${string}` | null {
  if (!node || typeof node !== "object") return null;
  const obj = node as Record<string, unknown>;
  for (const key of ["transactionHash", "txHash"]) {
    const val = obj[key];
    if (typeof val === "string" && /^0x[0-9a-f]{64}$/i.test(val)) return val as `0x${string}`;
  }
  for (const v of Object.values(obj)) {
    if (Array.isArray(v)) {
      for (const item of v) {
        const found = walkForTxHash(item);
        if (found) return found;
      }
    } else if (v && typeof v === "object") {
      const found = walkForTxHash(v);
      if (found) return found;
    }
  }
  return null;
}

async function assertOnChainEvent(
  txHash: `0x${string}`,
  expected: { user: `0x${string}`; nonce: `0x${string}`; message: string; signature: `0x${string}` },
): Promise<boolean> {
  const rpcUrl = process.env.BASE_RPC_URL;
  const publicClient = createPublicClient({ chain: base, transport: rpcUrl ? http(rpcUrl) : http() });
  const receipt = await publicClient.getTransactionReceipt({ hash: txHash });
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== ECHO_WITH_SIG.toLowerCase()) continue;
    try {
      const decoded = decodeEventLog({
        abi: echoWithSigAbi,
        data: log.data,
        topics: log.topics,
      });
      if (decoded.eventName !== "MessageEchoed") continue;
      const args = decoded.args as {
        user: `0x${string}`;
        nonce: `0x${string}`;
        message: string;
        signature: `0x${string}`;
      };
      const ok =
        args.user.toLowerCase() === expected.user.toLowerCase() &&
        args.nonce.toLowerCase() === expected.nonce.toLowerCase() &&
        args.message === expected.message &&
        args.signature.toLowerCase() === expected.signature.toLowerCase();
      if (ok) {
        console.log(`[${SCENARIO}] ✅ MessageEchoed matches signed payload`);
        return true;
      }
      console.error(`[${SCENARIO}] ❌ MessageEchoed mismatch:`, { actual: args, expected });
      return false;
    } catch {
      // not the right log
    }
  }
  console.warn(`[${SCENARIO}] ⚠ no MessageEchoed log found in tx ${txHash}`);
  return false;
}

async function main() {
  const { privateKey } = getEnvConfig();
  const account = privateKeyToAccount(`0x${clipHexPrefix(privateKey)}`);
  const chainIdToWalletClientMap = getChainIdToWalletClientMap(account);
  const operator = account.address;

  const message = `recreate-echo-delegated-deferred / ${new Date().toISOString()}`;
  const nonce = ("0x" + randomBytes(32).toString("hex")) as `0x${string}`;
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);
  const requestId = randomUUID();

  const echoMsg: EchoMessageArgs = { user: operator, nonce, message, deadline };

  console.log(`[${SCENARIO}] Operator (=user, =delegator): ${operator}`);
  console.log(`[${SCENARIO}] Nonce:    ${nonce}`);
  console.log(`[${SCENARIO}] Message:  ${message}`);
  console.log(`[${SCENARIO}] Deadline: ${deadline}`);

  const operatorSignature = await account.signTypedData({
    domain: {
      name: "EchoWithSig",
      version: "1",
      chainId: CHAIN_IDS.Base,
      verifyingContract: ECHO_WITH_SIG as `0x${string}`,
    },
    types: {
      EchoMessage: [
        { name: "user", type: "address" },
        { name: "nonce", type: "bytes32" },
        { name: "message", type: "string" },
        { name: "deadline", type: "uint256" },
      ],
    },
    primaryType: "EchoMessage",
    message: echoMsg,
  });
  if (hexToBytes(operatorSignature).length !== 65) {
    throw new Error(
      `[${SCENARIO}] Unexpected operator signature length: ${hexToBytes(operatorSignature).length}`,
    );
  }
  console.log(`[${SCENARIO}] EchoMessage signature: ${operatorSignature}`);

  const calldata = buildPrehookCalldataTemplate(echoMsg);

  // Only difference vs recreate-echo-direct-deferred.ts: type=Delegated.
  // Propose response will carry a Sign712MetaMaskWithPlaceholders action
  // (MetaMask delegation caveats wrapping the calldata template) instead
  // of a bare ProvidePlaceholders. processIntentBundle handles both.
  const preHook: ExtendedHook = {
    chainId: CHAIN_IDS.Base,
    type: HookExecutionType.Delegated,
    from: operator,
    to: ECHO_WITH_SIG,
    value: "0",
    isAtomic: true,
    data: calldata,
    placeHolders: [
      {
        nameVariable: "signature",
        type: PlaceholderResolutionType.Deferred,
      } as ExtendedHook["placeHolders"][number],
    ],
    gasCompensationInfo: {
      tokenAddress: USDC_BASE,
      chainId: CHAIN_IDS.Base,
      sender: operator,
    },
  };

  const requestBody: BundleProposeBody = {
    requestId,
    expirationTimestamp: Math.floor(Date.now() / 1000) + 3600,
    enableAccountAbstraction: true,
    isAtomic: true,
    tradingAlgorithm: TradingAlgorithm.MARKET,
    trades: [],
    preHooks: [preHook],
    postHooks: [],
  };
  (requestBody as unknown as { approveAmountFlag: string }).approveAmountFlag = "exactApproveAmount";

  writeArtifact(SCENARIO, "echo-message-signature", {
    operator,
    echoMessage: { ...echoMsg, deadline: deadline.toString() },
    signature: operatorSignature,
  });

  console.log(`[${SCENARIO}] Creating bundle…`);
  const bundle = await createBundle(requestBody);
  writeArtifact(SCENARIO, "propose", bundle);
  logActionTypes(bundle);

  // Walk every requiredAction; supply { signature: operatorSignature } for any
  // action that declares a "signature" placeholder. Same shape as direct-deferred,
  // but here the action type for the hook will be Sign712MetaMaskWithPlaceholders
  // (delegation caveats + providedData) instead of ProvidePlaceholders.
  const providedDataMap: ProvidedDataMap = {};
  for (const hook of [...(bundle.preHooks ?? []), ...(bundle.postHooks ?? [])]) {
    for (const action of hook.requiredActions ?? []) {
      const phs = (action.data as { placeholders?: { nameVariable: string }[] }).placeholders;
      if (!phs) continue;
      providedDataMap[action.actionId] = providedDataMap[action.actionId] ?? {};
      for (const ph of phs) {
        if (ph.nameVariable === "signature") {
          providedDataMap[action.actionId].signature = operatorSignature;
        }
      }
    }
  }

  const signedDataArray = await processIntentBundle(
    bundle,
    chainIdToWalletClientMap,
    providedDataMap,
  );
  console.log(`[${SCENARIO}] Generated ${signedDataArray.length} signedData items`);
  for (const item of signedDataArray) {
    const sigLen = item.signedData === "0x" ? 0 : (item.signedData.length - 2) / 2;
    console.log(
      `  - actionId=${item.actionId} signedData=${sigLen} bytes providedData=${JSON.stringify(item.providedData ?? null)}`,
    );
  }

  const submitPayload = {
    ...bundle,
    requestId,
    enableAccountAbstraction: true,
    isAtomic: true,
    signedData: signedDataArray,
  };
  writeArtifact(SCENARIO, "submit-request", submitPayload);

  let submitResponse: unknown;
  try {
    submitResponse = await submitBundle(submitPayload);
  } catch (e) {
    submitResponse = { error: e instanceof Error ? e.message : String(e) };
  }
  writeArtifact(SCENARIO, "submit-response", submitResponse);
  console.log(`[${SCENARIO}] Submit response:`, submitResponse);

  const bundleId = (submitResponse as { bundleId?: string }).bundleId;
  if (!bundleId) {
    console.error(`[${SCENARIO}] ❌ No bundleId returned — submit failed`);
    process.exitCode = 1;
    return;
  }

  console.log(`[${SCENARIO}] Polling for fulfillment of ${bundleId}…`);
  const fulfillment = await pollUntilTerminal(bundleId);
  writeArtifact(SCENARIO, "fulfillment", fulfillment);

  const status = (fulfillment as { status?: string }).status;
  console.log(`[${SCENARIO}] Final status: ${status}`);
  const statusIsAcceptable = status === "fulfilled" || status === "partially_fulfilled";
  if (!statusIsAcceptable) {
    console.error(`[${SCENARIO}] ❌ Terminal status "${status}" — bundle did not run`);
    process.exitCode = 1;
    return;
  }

  const txHash = findExecutionTxHash(fulfillment);
  if (!txHash) {
    console.warn(
      `[${SCENARIO}] ⚠ Could not locate execution tx hash in fulfillment — skipping on-chain event check. Inspect echo-delegated-deferred-fulfillment.json directly.`,
    );
    if (status === "fulfilled") {
      console.log(`[${SCENARIO}] ✅ fulfilled (on-chain verification skipped)`);
    } else {
      console.error(`[${SCENARIO}] ❌ status=${status} and no tx hash available — cannot confirm hook ran`);
      process.exitCode = 1;
    }
    return;
  }
  console.log(`[${SCENARIO}] Execution tx: ${txHash} (https://basescan.org/tx/${txHash})`);
  const eventOk = await assertOnChainEvent(txHash, {
    user: operator,
    nonce,
    message,
    signature: operatorSignature,
  });
  if (eventOk) {
    console.log(`[${SCENARIO}] ✅ ${status} + MessageEchoed verified on-chain`);
  } else {
    console.error(`[${SCENARIO}] ❌ status=${status} but on-chain event verification failed`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(`\n🚨 [${SCENARIO}] FATAL ERROR:`, error);
  process.exitCode = 1;
});
