import {
  encodeAbiParameters,
  keccak256,
  parseAbiParameters,
  type AbiParameter,
  type Hex,
} from "viem";
import { Intent } from "@gasless-intents/types";

export const ZERO32: Hex = `0x${"00".repeat(32)}`;

// IIntent.Intent tuple, exact struct field order
// solidity/contracts/debridge/interfaces/IIntent.sol).
const INTENT_TUPLE_STR =
  "(uint32 intentChainId, address intentOwner, " +
  "(bytes allowedAddress, uint32[] chains, bool isAnyChain)[] receiverDetails, " +
  "(address token, uint256 minPartialAmount, uint256 maxPartialAmount, uint256 budget)[] inputToken, " +
  "(address inputToken, address giveToken, uint256 numerator, uint8 denominator)[] giveToken, " +
  "(address giveToken, uint32 takeTokenChain, bytes takeToken, uint256 numerator, uint8 denominator)[] takeToken, " +
  "uint64 expirationTimestamp, uint64 intentTimestamp, address[] srcAllowedSender, " +
  "bytes executionMetadata, bool isAnyDlnMetadataAllowed, bytes dlnMetadata, bytes32 externalCallHash, " +
  "bytes combinedInteractions, address allowedCancelBeneficiary, " +
  "(bytes allowedAddress, uint32[] chains, bool isAnyChain)[] dstAuthorityAddress, address intentAuthority)";

export const INTENT_TUPLE = parseAbiParameters(INTENT_TUPLE_STR) as unknown as AbiParameter[];

/** abi.encodePacked(address) — the 20 raw bytes, lower-cased hex. */
export const packedAddr = (a: string): Hex => a.toLowerCase() as Hex;

export type IntentStruct = ReturnType<typeof buildIntentStruct>;

/** Rebuild the full on-chain struct from the API intent (fixed-field rules above). */
export function buildIntentStruct(intent: Intent) {
  return {
    intentChainId: intent.intentChainId,
    intentOwner: intent.intentOwner as Hex,
    receiverDetails: (intent.receiverDetails ?? []).map((r) => ({
      allowedAddress: packedAddr(r.address),
      chains: r.destinationChainIds,
      isAnyChain: false,
    })),
    inputToken: (intent.inputToken ?? []).map((t) => ({
      token: t.address as Hex,
      minPartialAmount: BigInt(t.minPartialAmount),
      maxPartialAmount: BigInt(t.maxPartialAmount),
      budget: BigInt(t.constraintBudget),
    })),
    giveToken: (intent.giveToken ?? []).map((g) => ({
      inputToken: g.inputTokenAddress as Hex,
      giveToken: g.giveTokenAddress as Hex,
      numerator: BigInt(g.numerator),
      denominator: Number(g.denominator),
    })),
    takeToken: (intent.takeToken ?? []).map((t) => ({
      giveToken: t.fromTokenAddress as Hex,
      takeTokenChain: t.takeTokenChainId,
      takeToken: packedAddr(t.takeTokenAddress),
      numerator: BigInt(t.numerator),
      denominator: Number(t.denominator),
    })),
    expirationTimestamp: BigInt(intent.expirationTimestamp),
    intentTimestamp: BigInt(intent.intentTimestamp),
    srcAllowedSender: (intent.srcAllowedSender ?? []) as Hex[],
    executionMetadata: ZERO32,
    isAnyDlnMetadataAllowed: true,
    dlnMetadata: "0x" as Hex,
    externalCallHash: ZERO32,
    combinedInteractions: "0x" as Hex,
    allowedCancelBeneficiary: (intent.allowedCancelBeneficiary ?? ZERO32.slice(0, 42)) as Hex,
    dstAuthorityAddress: (intent.dstAuthorityAddress ?? []).map((r) => ({
      allowedAddress: packedAddr(r.address),
      chains: r.destinationChainIds,
      isAnyChain: false,
    })),
    intentAuthority: intent.intentAuthority as Hex,
  };
}

/** keccak256(abi.encode(struct)) — must equal the API's intentId. */
export function computeIntentId(struct: IntentStruct): Hex {
  return keccak256(encodeAbiParameters(INTENT_TUPLE, [struct] as any));
}

/** Pre-submit gate: throws unless the rebuilt struct hashes to the API id. */
export function assertIntentIdParity(struct: IntentStruct, apiIntentId: Hex): void {
  const computed = computeIntentId(struct);
  if (computed.toLowerCase() !== apiIntentId.toLowerCase()) {
    throw new Error(
        `The rebuilt struct does not hash to the API intentId; solvers would compute a different key.`,
    );
  }
}
