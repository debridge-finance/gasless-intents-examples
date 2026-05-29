import { randomBytes, randomUUID } from "crypto";
import fs from "fs";
import path from "path";
import {
  encodeFunctionData,
  hexToBytes,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

import { getEnvConfig } from "@utils/env";
import { clipHexPrefix } from "@utils/string";
import { createBundle, submitBundle } from "@utils/gasless-api";
import { CHAIN_IDS } from "@utils/chains";
import { ECHO_WITH_SIG_BASE, USDC } from "@utils/constants";
import { EchoWithSigAbi } from "@utils/contract-calls/abis";
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
} from "@gasless-intents/types";

const SCENARIO = "echo-direct-deferred";

type EchoMessageArgs = {
  user: `0x${string}`;
  nonce: `0x${string}`;
  message: string;
  deadline: bigint;
};

function buildPrehookCalldataTemplate(args: EchoMessageArgs): `0x${string}` {
  const dummySig = ("0x" + "00".repeat(65)) as `0x${string}`;
  const encoded = encodeFunctionData({
    abi: EchoWithSigAbi.EchoWithSig,
    functionName: "echoWithSig",
    args: [args.user, args.nonce, args.message, args.deadline, dummySig],
  });
  // Last 192 hex chars = 65 sig bytes + 31 zero-pad bytes (3 × 32-byte ABI words).
  // bytes signature is the LAST argument, so this slice maps to the sig data slot.
  const head = encoded.slice(0, encoded.length - 192);
  const tail = "{signature.65}" + "00".repeat(31);
  return (head + tail) as `0x${string}`;
}

async function main() {
  const { privateKey } = getEnvConfig();
  const account = privateKeyToAccount(`0x${clipHexPrefix(privateKey)}`);
  const chainIdToWalletClientMap = getChainIdToWalletClientMap(account);
  const operator = account.address;

  const message = `recreate-echo-direct-deferred / ${new Date().toISOString()}`;
  const nonce = ("0x" + randomBytes(32).toString("hex")) as `0x${string}`;
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);
  const requestId = randomUUID();

  const echoMsg: EchoMessageArgs = { user: operator, nonce, message, deadline };

  console.log(`[${SCENARIO}] Operator (=user, =from): ${operator}`);
  console.log(`[${SCENARIO}] Nonce:    ${nonce}`);
  console.log(`[${SCENARIO}] Message:  ${message}`);
  console.log(`[${SCENARIO}] Deadline: ${deadline}`);

  const operatorSignature = await account.signTypedData({
    domain: {
      name: "EchoWithSig",
      version: "1",
      chainId: CHAIN_IDS.Base,
      verifyingContract: ECHO_WITH_SIG_BASE as `0x${string}`,
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

  const preHook: ExtendedHook = {
    chainId: CHAIN_IDS.Base,
    type: HookExecutionType.Direct,
    from: operator,
    to: ECHO_WITH_SIG_BASE,
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
      tokenAddress: USDC.Base,
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

  const ARTIFACT_DIR = path.resolve(__dirname, "../../../../findings/echo-direct-deferred-artifacts");
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  const proposePath = path.join(ARTIFACT_DIR, `${requestId}-propose.json`);
  fs.writeFileSync(proposePath, JSON.stringify(requestBody, null, 2));
  console.log(`[${SCENARIO}] wrote propose payload: ${proposePath}`);

  console.log(`[${SCENARIO}] Creating bundle…`);
  const bundle = await createBundle(requestBody);
  logActionTypes(bundle);

  // Walk every requiredAction; supply { signature: operatorSignature } for any
  // action that declares a "signature" placeholder. Same shape as anton-spender-bundle.ts.
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

  const submitPath = path.join(ARTIFACT_DIR, `${requestId}-submit.json`);
  fs.writeFileSync(submitPath, JSON.stringify(submitPayload, null, 2));
  console.log(`[${SCENARIO}] wrote submit payload: ${submitPath}`);

  let submitResponse: unknown;
  try {
    submitResponse = await submitBundle(submitPayload);
  } catch (e) {
    submitResponse = { error: e instanceof Error ? e.message : String(e) };
  }
  console.log(`[${SCENARIO}] Submit response:`, submitResponse);

  const bundleId = (submitResponse as { bundleId?: string }).bundleId;
  if (!bundleId) {
    console.error(`[${SCENARIO}] ❌ No bundleId returned — submit failed`);
    process.exitCode = 1;
    return;
  }
}

main().catch((error) => {
  console.error(`\n🚨 [${SCENARIO}] FATAL ERROR:`, error);
  process.exitCode = 1;
});
