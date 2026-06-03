/**
 * Helpers for the EIP-712-gated `AllowlistGuard` hook.
 *
 * The hook payload is `abi.encode(address subject, bytes32 nonce, uint256 deadline, bytes signature)`.
 * The signature is over the `AllowlistAuthorization` typed-data struct, signed
 * by the holder of `subject`'s private key. The on-chain `onPreCall`:
 *
 *   1. recovers the signer from the signature,
 *   2. requires recovered == subject,
 *   3. requires allowed[subject] == true,
 *   4. requires block.timestamp <= deadline,
 *   5. requires usedNonces[subject][nonce] == false (then marks it used).
 *
 * Practical usage: pick a random 32-byte nonce per intent, an expiration
 * deadline (e.g. `Math.floor(Date.now()/1000) + 3600`), and sign with the
 * subject's key via viem's `signTypedData`.
 */
import { randomBytes } from "node:crypto";
import {
  decodeAbiParameters,
  encodeAbiParameters,
  type Address,
  type Hex,
} from "viem";
import type { LocalAccount } from "viem/accounts";

const ALLOWLIST_PAYLOAD_ABI = [
  { type: "address" },
  { type: "bytes32" },
  { type: "uint256" },
  { type: "bytes" },
] as const;

export type DecodedAllowlistPayload = {
  subject: Address;
  nonce: Hex;
  deadline: bigint;
  signature: Hex;
};

export function encodeAllowlistPayload(
  subject: Address,
  nonce: Hex,
  deadline: bigint | number,
  signature: Hex,
): Hex {
  return encodeAbiParameters(ALLOWLIST_PAYLOAD_ABI, [
    subject,
    nonce,
    BigInt(deadline),
    signature,
  ]);
}

export function decodeAllowlistPayload(payload: Hex): DecodedAllowlistPayload {
  const [subject, nonce, deadline, signature] = decodeAbiParameters(
    ALLOWLIST_PAYLOAD_ABI,
    payload,
  );
  return { subject, nonce, deadline, signature };
}

export function freshAllowlistNonce(): Hex {
  return ("0x" + randomBytes(32).toString("hex")) as Hex;
}

/**
 * Produces an EIP-712 signature over the AllowlistAuthorization struct using
 * viem's `signTypedData`. Caller must provide a `LocalAccount` (e.g. the
 * output of `privateKeyToAccount`) whose `address` matches `subject` — the
 * on-chain hook only accepts signatures where recovered == subject.
 */
export async function signAllowlistAuthorization(opts: {
  account: LocalAccount;
  guardAddress: Address;
  chainId: number;
  subject: Address;
  nonce: Hex;
  deadline: bigint | number;
}): Promise<Hex> {
  return opts.account.signTypedData({
    domain: {
      name: "AllowlistGuard",
      version: "1",
      chainId: opts.chainId,
      verifyingContract: opts.guardAddress,
    },
    types: {
      AllowlistAuthorization: [
        { name: "subject", type: "address" },
        { name: "nonce", type: "bytes32" },
        { name: "deadline", type: "uint256" },
      ],
    },
    primaryType: "AllowlistAuthorization",
    message: {
      subject: opts.subject,
      nonce: opts.nonce,
      deadline: BigInt(opts.deadline),
    },
  });
}

/**
 * One-shot helper: sign + encode in one call. Returns the
 * `(subject, nonce, deadline, signature)` payload bytes ready to drop into
 * `Interaction.hookPayload`.
 */
export async function buildAllowlistPayload(opts: {
  account: LocalAccount;
  guardAddress: Address;
  chainId: number;
  subject?: Address; // defaults to account.address
  nonce?: Hex; // defaults to a fresh 32-byte nonce
  deadline?: bigint | number; // defaults to now + 1h
}): Promise<{ payload: Hex; subject: Address; nonce: Hex; deadline: bigint }> {
  const subject = opts.subject ?? opts.account.address;
  const nonce = opts.nonce ?? freshAllowlistNonce();
  const deadline = BigInt(
    opts.deadline ?? Math.floor(Date.now() / 1000) + 3600,
  );
  const signature = await signAllowlistAuthorization({
    account: opts.account,
    guardAddress: opts.guardAddress,
    chainId: opts.chainId,
    subject,
    nonce,
    deadline,
  });
  const payload = encodeAllowlistPayload(subject, nonce, deadline, signature);
  return { payload, subject, nonce, deadline };
}
