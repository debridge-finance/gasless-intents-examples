import { getAddress, parseAbi, parseUnits, PublicClient } from "viem";

import {
  Action,
  Bundle,
  EIP712Data,
  IntentPayload,
  SignatureTypes,
  TradeResult,
} from "@gasless-intents/types";
import { HYPERCORE, HYPERLIQUID_ESCROW_FACTORY } from "@utils/constants";

const HYPEREVM_CHAIN_ID = 999;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const SEND_ASSET_PRIMARY_TYPE = "HyperliquidTransaction:SendAsset";
const SIGNED_INTENT_PRIMARY_TYPE = "SignedIntent";

const ESCROW_FACTORY_ABI = parseAbi([
  "function computeEscrowAddress(address owner) view returns (address)",
]);

type ReadContractClient = Pick<PublicClient, "readContract">;

export type VerifiedHyperliquidWithdrawal = {
  intent: IntentPayload;
  sendAssetActionId: string;
  signedIntentActionId: string;
  escrow: `0x${string}`;
};

export function fail(field: string, expected: string, actual: unknown): never {
  throw new Error(
    `Refusing to sign: ${field} did not verify. Expected ${expected}; received ${String(actual)}.`,
  );
}

export function requireEqual(field: string, expected: string, actual: unknown): void {
  if (String(actual) !== expected) fail(field, expected, actual);
}

export function requireAddress(field: string, expected: string, actual: unknown): void {
  if (typeof actual !== "string" || getAddress(actual) !== getAddress(expected)) {
    fail(field, getAddress(expected), actual);
  }
}

export function isTypedData(action: Action): action is Action & { data: EIP712Data } {
  const data = action.data as Partial<EIP712Data>;
  return (
    action.type === SignatureTypes.Sign712 &&
    data.domain !== undefined &&
    data.types !== undefined &&
    typeof data.primaryType === "string" &&
    data.message !== undefined
  );
}

function findTypedAction(actions: Action[], primaryType: string): Action & { data: EIP712Data } {
  const matches = actions.filter(
    (action): action is Action & { data: EIP712Data } =>
      isTypedData(action) && action.data.primaryType === primaryType,
  );
  if (matches.length !== 1) {
    throw new Error(`Refusing to sign: expected exactly one ${primaryType} action, got ${matches.length}.`);
  }
  return matches[0];
}

export function requireDomain(
  label: string,
  data: EIP712Data,
  expected: { name: string; version: string; chainId: number; verifyingContract: string },
): void {
  requireEqual(`${label}.domain.name`, expected.name, data.domain.name);
  requireEqual(`${label}.domain.version`, expected.version, data.domain.version);
  requireEqual(`${label}.domain.chainId`, String(expected.chainId), String(data.domain.chainId));
  requireAddress(
    `${label}.domain.verifyingContract`,
    expected.verifyingContract,
    data.domain.verifyingContract,
  );
}

export type HyperCoreTokenSpec = {
  symbol: string;
  tokenId: string;
  coreDecimals: number;
  evmDecimals: number;
};

function verifyAmountFor(token: HyperCoreTokenSpec, trade: TradeResult, signedAmount: unknown): void {
  if (typeof signedAmount !== "string") {
    fail("SendAsset.amount", "a decimal string", signedAmount);
  }

  const fractional = signedAmount.split(".")[1] ?? "";
  if (fractional.length > token.coreDecimals) {
    fail("SendAsset.amount", `at most ${token.coreDecimals} fractional digits`, signedAmount);
  }

  const quoted = BigInt(trade.srcChainTokenIn.amount);
  const signed = parseUnits(signedAmount, token.evmDecimals);
  const twoPercent = (quoted * 200n) / 10_000n;
  const oneWhole = 10n ** BigInt(token.evmDecimals);
  const fallbackAllowance =
    token.evmDecimals <= 8 && oneWhole > twoPercent ? oneWhole : twoPercent;

  const gasCost = trade.costsDetails
    .find((detail) => detail.type === "HyperLiquid.CoreToHevm")
    ?.payload?.coreToEvmTransferGasCostRawAmount;
  const allowance =
    typeof gasCost === "string" && /^\d+$/.test(gasCost) ? BigInt(gasCost) : fallbackAllowance;

  if (signed < quoted || signed > quoted + allowance) {
    fail(
      "SendAsset.amount",
      `${quoted.toString()}..${(quoted + allowance).toString()} raw ${token.symbol} units`,
      signed.toString(),
    );
  }
}

export async function deriveHyperliquidEscrow(
  client: ReadContractClient,
  owner: `0x${string}`,
): Promise<`0x${string}`> {
  const result = await client.readContract(
    {
      address: HYPERLIQUID_ESCROW_FACTORY,
      abi: ESCROW_FACTORY_ABI,
      functionName: "computeEscrowAddress",
      args: [owner],
    } as any,
  );
  return getAddress(String(result));
}

export function verifyHyperliquidWithdrawal(params: {
  bundle: Bundle;
  escrow: `0x${string}`;
  recipient: `0x${string}`;
  destinationToken: string;
}): VerifiedHyperliquidWithdrawal {
  return verifyHyperliquidWithdrawalForToken({ ...params, token: HYPERCORE.USDC });
}

export function verifyHyperliquidWithdrawalForToken(params: {
  bundle: Bundle;
  escrow: `0x${string}`;
  recipient: `0x${string}`;
  destinationToken: string;
  token: HyperCoreTokenSpec;
}): VerifiedHyperliquidWithdrawal {
  if (params.bundle.trades.length !== 1 || params.bundle.intents.length !== 1) {
    throw new Error("Refusing to sign: a basic withdrawal must contain exactly one trade and one intent.");
  }

  const trade = params.bundle.trades[0];
  const intent = params.bundle.intents[0];
  const actions = intent.requiredActions;

  if (actions.length !== 2) {
    throw new Error(`Refusing to sign: expected exactly two withdrawal actions, got ${actions.length}.`);
  }

  const sendAsset = findTypedAction(actions, SEND_ASSET_PRIMARY_TYPE);
  const signedIntent = findTypedAction(actions, SIGNED_INTENT_PRIMARY_TYPE);

  requireDomain("SendAsset", sendAsset.data, {
    name: "HyperliquidSignTransaction",
    version: "1",
    chainId: HYPEREVM_CHAIN_ID,
    verifyingContract: ZERO_ADDRESS,
  });
  requireDomain("SignedIntent", signedIntent.data, {
    name: "deBridgeEscrow",
    version: "1",
    chainId: HYPEREVM_CHAIN_ID,
    verifyingContract: HYPERLIQUID_ESCROW_FACTORY,
  });

  const sendMessage = sendAsset.data.message;
  requireAddress("SendAsset.destination", params.escrow, sendMessage.destination);
  requireEqual("SendAsset.token", `${params.token.symbol}:${params.token.tokenId}`, sendMessage.token);
  requireEqual("SendAsset.hyperliquidChain", "Mainnet", sendMessage.hyperliquidChain);
  requireEqual("SendAsset.sourceDex", "spot", sendMessage.sourceDex);
  requireEqual("SendAsset.destinationDex", "spot", sendMessage.destinationDex);
  requireEqual("SendAsset.fromSubAccount", "", sendMessage.fromSubAccount);
  verifyAmountFor(params.token, trade, sendMessage.amount);

  requireAddress("trade.srcChainAuthorityAddress", params.escrow, trade.srcChainAuthorityAddress);
  requireAddress("trade.dstChainTokenOutRecipient", params.recipient, trade.dstChainTokenOutRecipient);
  requireAddress("trade.dstChainTokenOut.address", params.destinationToken, trade.dstChainTokenOut.address);
  requireEqual("SignedIntent.intentId", intent.intent.intentId, signedIntent.data.message.intentId);

  return {
    intent,
    sendAssetActionId: sendAsset.actionId,
    signedIntentActionId: signedIntent.actionId,
    escrow: params.escrow,
  };
}
