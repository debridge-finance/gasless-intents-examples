import { TransactionInstruction } from "@solana/web3.js";
import * as externalCallWasm from "@debridge-finance/debridge-external-call";

import { DEBRIDGE_SOLANA_EXTERNAL_CALL } from "@utils/constants";
import { toHexPrefixString } from "@utils/string";

export type AmountSubstitution = {
  is_big_endian: boolean;
  offset: number;
  account_index: number;
  subtraction: number;
};

export type WalletSubstitution = {
  token_mint: string;
  index: number;
};

type ExternalInstruction = {
  keys: Array<{
    pubkey: string;
    isSigner: boolean;
    isWritable: boolean;
  }>;
  data: Buffer;
  programId: string;
};

function checkedPlaceholder(name: string, actual: string, expected: string): string {
  if (actual !== expected) {
    throw new Error(`Unexpected deBridge ${name} placeholder ${actual}; expected ${expected}.`);
  }

  return actual;
}

export const SOLANA_EXTERNAL_CALL_PLACEHOLDERS = {
  wallet: checkedPlaceholder(
    "wallet",
    externalCallWasm.wallet_placeholder(),
    DEBRIDGE_SOLANA_EXTERNAL_CALL.WalletPlaceholder,
  ),
  authority: checkedPlaceholder(
    "authority",
    externalCallWasm.auth_placeholder(),
    DEBRIDGE_SOLANA_EXTERNAL_CALL.AuthorityPlaceholder,
  ),
  submission: checkedPlaceholder(
    "submission",
    externalCallWasm.submission_placeholder(),
    DEBRIDGE_SOLANA_EXTERNAL_CALL.SubmissionPlaceholder,
  ),
};

function ixToExternalInstruction(ix: TransactionInstruction): ExternalInstruction {
  return {
    keys: ix.keys.map((meta) => ({
      pubkey: meta.pubkey.toBase58(),
      isSigner: meta.isSigner,
      isWritable: meta.isWritable,
    })),
    data: Buffer.from(ix.data),
    programId: ix.programId.toBase58(),
  };
}

export function serializeSolanaExternalInstruction(params: {
  instruction: TransactionInstruction;
  amountSubstitutions?: AmountSubstitution[];
  walletSubstitutions?: WalletSubstitution[];
  expense?: bigint;
  reward?: bigint;
  isInMandatoryBlock?: boolean;
}): Uint8Array {
  const wrapper = new externalCallWasm.ExternalInstructionWrapper(
    params.reward,
    params.expense,
    params.isInMandatoryBlock ?? false,
    params.amountSubstitutions ?? [],
    params.walletSubstitutions ?? [],
    ixToExternalInstruction(params.instruction),
  );

  return wrapper.serialize();
}

export function concatSolanaExternalInstructionsToHex(parts: Uint8Array[]): `0x${string}` {
  const hex = Buffer.concat(parts.map((part) => Buffer.from(part))).toString("hex");

  if (hex.length > DEBRIDGE_SOLANA_EXTERNAL_CALL.SerializedInstructionsHexLimit) {
    throw new Error(
      `Solana dlnHook data is ${hex.length} hex chars; max is ${DEBRIDGE_SOLANA_EXTERNAL_CALL.SerializedInstructionsHexLimit}.`,
    );
  }

  return toHexPrefixString(hex);
}
