import { decodeAbiParameters, encodeAbiParameters, type Address, type Hex } from "viem";

const LOG_PAYLOAD_ABI = [
  { type: "string" },
  { type: "address" },
  { type: "uint256" },
] as const;

const SUBJECT_ONLY_ABI = [{ type: "address" }] as const;

export type DecodedLogPayload = {
  label: string;
  subject: Address;
  referenceId: bigint;
};

export function encodeLogPayload(
  label: string,
  subject: Address,
  referenceId: bigint | number,
): Hex {
  return encodeAbiParameters(LOG_PAYLOAD_ABI, [label, subject, BigInt(referenceId)]);
}

export function decodeLogPayload(payload: Hex): DecodedLogPayload {
  const [label, subject, referenceId] = decodeAbiParameters(LOG_PAYLOAD_ABI, payload);
  return { label, subject, referenceId };
}

export function encodeSubjectPayload(subject: Address): Hex {
  return encodeAbiParameters(SUBJECT_ONLY_ABI, [subject]);
}

export function decodeSubjectPayload(payload: Hex): Address {
  const [subject] = decodeAbiParameters(SUBJECT_ONLY_ABI, payload);
  return subject;
}

const REWARD_PAYLOAD_ABI = [
  { type: "address" },
  { type: "uint256" },
] as const;

export type DecodedRewardPayload = {
  subject: Address;
  reward: bigint;
};

export function encodeRewardPayload(subject: Address, reward: bigint | number): Hex {
  return encodeAbiParameters(REWARD_PAYLOAD_ABI, [subject, BigInt(reward)]);
}

export function decodeRewardPayload(payload: Hex): DecodedRewardPayload {
  const [subject, reward] = decodeAbiParameters(REWARD_PAYLOAD_ABI, payload);
  return { subject, reward };
}
