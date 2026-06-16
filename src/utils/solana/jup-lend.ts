import {
  AccountLayout,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferInstruction,
  getAccount,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { Connection, PublicKey, TransactionInstruction } from "@solana/web3.js";
import BN from "bn.js";

import { DlnHook, DlnHookType } from "@gasless-intents/types";
import { JUP_LEND, USDC } from "@utils/constants";
import {
  concatSolanaExternalInstructionsToHex,
  serializeSolanaExternalInstruction,
  SOLANA_EXTERNAL_CALL_PLACEHOLDERS,
  type WalletSubstitution,
} from "@utils/solana/external-call";

const JUP_LEND_DEPOSIT_DISCRIMINATOR = Buffer.from([242, 35, 198, 137, 82, 225, 242, 182]);
const JUP_LEND_REDEEM_DISCRIMINATOR = Buffer.from([184, 12, 86, 149, 70, 196, 97, 225]);
export const JUP_LEND_DEPOSIT_AMOUNT_OFFSET = 8;
export const JUP_LEND_DEPOSIT_DEPOSITOR_TOKEN_ACCOUNT_INDEX = 1;
export const JUP_LEND_DEPOSIT_RECIPIENT_TOKEN_ACCOUNT_INDEX = 2;
export const JUP_LEND_REDEEM_SHARES_OFFSET = 8;
const CREATE_ATA_ACCOUNT_INDEX = 1;
const CREATE_ATA_OWNER_INDEX = 2;
const CREATE_ATA_MINT_INDEX = 3;
const CREATE_ATA_TOKEN_PROGRAM_INDEX = 5;
const CREATE_ATA_IDEMPOTENT_DATA = Buffer.from([1]);
const SPL_TRANSFER_AMOUNT_OFFSET = 1;
const SPL_TRANSFER_SOURCE_ACCOUNT_INDEX = 0;

type JupLendContextParams = {
  asset: PublicKey;
  signer: PublicKey;
  connection: Connection;
};

type JupLendDepositIxsParams = JupLendContextParams & {
  amount: BN;
};

export type JupLendContext = {
  signer: PublicKey;
  depositorTokenAccount: PublicKey;
  recipientTokenAccount: PublicKey;
  lendingAdmin: PublicKey;
  lending: PublicKey;
  mint: PublicKey;
  fTokenMint: PublicKey;
  claimAccount: PublicKey;
  supplyTokenReservesLiquidity: PublicKey;
  lendingSupplyPositionOnLiquidity: PublicKey;
  rateModel: PublicKey;
  vault: PublicKey;
  liquidity: PublicKey;
  liquidityProgram: PublicKey;
  rewardsRateModel: PublicKey;
  tokenProgram: PublicKey;
  associatedTokenProgram: PublicKey;
  systemProgram: PublicKey;
};

type JupEarnModule = {
  getDepositContext(params: JupLendContextParams): Promise<JupLendContext>;
  getDepositIxs(params: JupLendDepositIxsParams): Promise<{ ixs: TransactionInstruction[] }>;
};

export type JupLendDepositDlnHookResult = {
  hook: DlnHook;
  assetMint: PublicKey;
  lendingAdmin: PublicKey;
  lending: PublicKey;
  fTokenMint: PublicKey;
  supplyTokenReservesLiquidity: PublicKey;
  lendingSupplyPositionOnLiquidity: PublicKey;
  vault: PublicKey;
  liquidity: PublicKey;
  liquidityProgram: PublicKey;
  recipientFTokenAta: PublicKey;
  recipientFTokenAtaExists: boolean;
  tokenProgram: PublicKey;
  serializedHookBytes: number;
};

const nativeImport = new Function("specifier", "return import(specifier)") as (
  specifier: string,
) => Promise<JupEarnModule>;

async function getJupDepositContext(params: JupLendContextParams): Promise<JupLendContext> {
  // @jup-ag/lend is ESM-only; preserve native import when this repo emits CommonJS.
  const { getDepositContext } = await nativeImport("@jup-ag/lend/earn");

  return getDepositContext(params);
}

async function getJupDepositIxs(params: JupLendDepositIxsParams): Promise<TransactionInstruction[]> {
  // @jup-ag/lend is ESM-only; preserve native import when this repo emits CommonJS.
  const { getDepositIxs } = await nativeImport("@jup-ag/lend/earn");

  return (await getDepositIxs(params)).ixs;
}

export async function getJupLendUsdcContext(params: {
  connection: Connection;
  signer: PublicKey;
}): Promise<JupLendContext> {
  return getJupDepositContext({
    asset: new PublicKey(USDC.Solana),
    signer: params.signer,
    connection: params.connection,
  });
}

async function validateTokenAccount(params: {
  connection: Connection;
  tokenAccount: PublicKey;
  owner: PublicKey;
  mint: PublicKey;
  tokenProgram: PublicKey;
}): Promise<boolean> {
  const accountInfo = await params.connection.getAccountInfo(params.tokenAccount);

  if (!accountInfo) {
    return false;
  }

  if (!accountInfo.owner.equals(params.tokenProgram)) {
    throw new Error(
      `Token account ${params.tokenAccount.toBase58()} is owned by ${accountInfo.owner.toBase58()}, not ${params.tokenProgram.toBase58()}.`,
    );
  }

  const tokenAccount = await getAccount(params.connection, params.tokenAccount, "confirmed", params.tokenProgram);

  if (!tokenAccount.owner.equals(params.owner)) {
    throw new Error(`Token account owner mismatch: ${tokenAccount.owner.toBase58()}.`);
  }

  if (!tokenAccount.mint.equals(params.mint)) {
    throw new Error(`Token account mint mismatch: ${tokenAccount.mint.toBase58()}.`);
  }

  return true;
}

function findJupLendDepositIx(instructions: TransactionInstruction[]): TransactionInstruction {
  const jupLendProgramId = new PublicKey(JUP_LEND.EarnProgram);
  const depositInstructions = instructions.filter(
    (instruction) =>
      instruction.programId.equals(jupLendProgramId) &&
      Buffer.from(instruction.data.subarray(0, JUP_LEND_DEPOSIT_DISCRIMINATOR.length)).equals(
        JUP_LEND_DEPOSIT_DISCRIMINATOR,
      ),
  );

  if (depositInstructions.length !== 1) {
    throw new Error(`Expected exactly one JUP LEND deposit instruction, found ${depositInstructions.length}.`);
  }

  return depositInstructions[0];
}

function findSdkRecipientTokenAtaIx(
  instructions: TransactionInstruction[],
  context: JupLendContext,
): TransactionInstruction | undefined {
  const createAtaInstructions = instructions.filter(
    (instruction) =>
      instruction.programId.equals(ASSOCIATED_TOKEN_PROGRAM_ID) &&
      instruction.keys[CREATE_ATA_ACCOUNT_INDEX]?.pubkey.equals(context.recipientTokenAccount) &&
      instruction.keys[CREATE_ATA_MINT_INDEX]?.pubkey.equals(context.fTokenMint),
  );

  if (createAtaInstructions.length > 1) {
    throw new Error(
      `Expected at most one SDK create ATA instruction for ${context.recipientTokenAccount.toBase58()}, found ${createAtaInstructions.length}.`,
    );
  }

  return createAtaInstructions[0];
}

function assertInstructionAccount(params: {
  instruction: TransactionInstruction;
  index: number;
  expected: PublicKey;
  label: string;
}) {
  const account = params.instruction.keys[params.index];

  if (!account) {
    throw new Error(
      `Missing ${params.label} account at index ${params.index} on instruction ${params.instruction.programId.toBase58()}.`,
    );
  }

  if (!account.pubkey.equals(params.expected)) {
    throw new Error(
      `Unexpected ${params.label} account at index ${params.index}: ${account.pubkey.toBase58()}, expected ${params.expected.toBase58()}.`,
    );
  }
}

function patchInstructionAccounts(
  instruction: TransactionInstruction,
  patches: Record<number, PublicKey>,
): TransactionInstruction {
  for (const index of Object.keys(patches).map(Number)) {
    if (!instruction.keys[index]) {
      throw new Error(`Cannot patch missing account index ${index} on instruction ${instruction.programId.toBase58()}.`);
    }
  }

  return new TransactionInstruction({
    programId: instruction.programId,
    keys: instruction.keys.map((account, index) => ({
      ...account,
      pubkey: patches[index] ?? account.pubkey,
    })),
    data: Buffer.from(instruction.data),
  });
}

function patchSdkCreateRecipientFTokenAtaIx(params: {
  instruction: TransactionInstruction;
  context: JupLendContext;
  recipient: PublicKey;
  recipientFTokenAta: PublicKey;
}): TransactionInstruction {
  assertInstructionAccount({
    instruction: params.instruction,
    index: CREATE_ATA_ACCOUNT_INDEX,
    expected: params.context.recipientTokenAccount,
    label: "SDK fToken ATA",
  });
  assertInstructionAccount({
    instruction: params.instruction,
    index: CREATE_ATA_OWNER_INDEX,
    expected: params.context.signer,
    label: "SDK fToken ATA owner",
  });
  assertInstructionAccount({
    instruction: params.instruction,
    index: CREATE_ATA_MINT_INDEX,
    expected: params.context.fTokenMint,
    label: "SDK fToken ATA mint",
  });
  assertInstructionAccount({
    instruction: params.instruction,
    index: CREATE_ATA_TOKEN_PROGRAM_INDEX,
    expected: params.context.tokenProgram,
    label: "SDK fToken ATA token program",
  });

  const patchedIx = patchInstructionAccounts(params.instruction, {
    [CREATE_ATA_ACCOUNT_INDEX]: params.recipientFTokenAta,
    [CREATE_ATA_OWNER_INDEX]: params.recipient,
  });

  return new TransactionInstruction({
    programId: patchedIx.programId,
    keys: patchedIx.keys,
    data: CREATE_ATA_IDEMPOTENT_DATA,
  });
}

function patchSdkDepositIx(params: {
  instruction: TransactionInstruction;
  context: JupLendContext;
  depositorTokenAccount: PublicKey;
  recipientTokenAccount: PublicKey;
}): TransactionInstruction {
  assertInstructionAccount({
    instruction: params.instruction,
    index: 0,
    expected: params.context.signer,
    label: "SDK signer",
  });
  assertInstructionAccount({
    instruction: params.instruction,
    index: JUP_LEND_DEPOSIT_DEPOSITOR_TOKEN_ACCOUNT_INDEX,
    expected: params.context.depositorTokenAccount,
    label: "SDK depositor token account",
  });
  assertInstructionAccount({
    instruction: params.instruction,
    index: JUP_LEND_DEPOSIT_RECIPIENT_TOKEN_ACCOUNT_INDEX,
    expected: params.context.recipientTokenAccount,
    label: "SDK recipient token account",
  });

  return patchInstructionAccounts(params.instruction, {
    [JUP_LEND_DEPOSIT_DEPOSITOR_TOKEN_ACCOUNT_INDEX]: params.depositorTokenAccount,
    [JUP_LEND_DEPOSIT_RECIPIENT_TOKEN_ACCOUNT_INDEX]: params.recipientTokenAccount,
  });
}

export function buildJupLendRedeemIx(params: {
  context: JupLendContext;
  ownerTokenAccount: PublicKey;
  recipientTokenAccount: PublicKey;
  shares: bigint;
}): TransactionInstruction {
  const data = Buffer.alloc(JUP_LEND_REDEEM_SHARES_OFFSET + 8);
  JUP_LEND_REDEEM_DISCRIMINATOR.copy(data, 0);
  data.writeBigUInt64LE(params.shares, JUP_LEND_REDEEM_SHARES_OFFSET);

  return new TransactionInstruction({
    programId: new PublicKey(JUP_LEND.EarnProgram),
    keys: [
      { pubkey: params.context.signer, isSigner: true, isWritable: true },
      { pubkey: params.ownerTokenAccount, isSigner: false, isWritable: true },
      { pubkey: params.recipientTokenAccount, isSigner: false, isWritable: true },
      { pubkey: params.context.lendingAdmin, isSigner: false, isWritable: false },
      { pubkey: params.context.lending, isSigner: false, isWritable: true },
      { pubkey: params.context.mint, isSigner: false, isWritable: false },
      { pubkey: params.context.fTokenMint, isSigner: false, isWritable: true },
      { pubkey: params.context.supplyTokenReservesLiquidity, isSigner: false, isWritable: true },
      { pubkey: params.context.lendingSupplyPositionOnLiquidity, isSigner: false, isWritable: true },
      { pubkey: params.context.rateModel, isSigner: false, isWritable: false },
      { pubkey: params.context.vault, isSigner: false, isWritable: true },
      { pubkey: params.context.claimAccount, isSigner: false, isWritable: true },
      { pubkey: params.context.liquidity, isSigner: false, isWritable: true },
      { pubkey: params.context.liquidityProgram, isSigner: false, isWritable: true },
      { pubkey: params.context.rewardsRateModel, isSigner: false, isWritable: false },
      { pubkey: params.context.tokenProgram, isSigner: false, isWritable: false },
      { pubkey: params.context.associatedTokenProgram, isSigner: false, isWritable: false },
      { pubkey: params.context.systemProgram, isSigner: false, isWritable: false },
    ],
    data,
  });
}

export async function buildJupLendUsdcDepositDlnHook(params: {
  connection: Connection;
  recipient: PublicKey;
}): Promise<JupLendDepositDlnHookResult> {
  const externalCallAuthority = new PublicKey(SOLANA_EXTERNAL_CALL_PLACEHOLDERS.authority);
  const externalCallWallet = new PublicKey(SOLANA_EXTERNAL_CALL_PLACEHOLDERS.wallet);
  const context = await getJupLendUsdcContext({
    signer: externalCallAuthority,
    connection: params.connection,
  });

  const recipientFTokenAta = getAssociatedTokenAddressSync(
    context.fTokenMint,
    params.recipient,
    false,
    context.tokenProgram,
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );
  const recipientFTokenAtaExists = await validateTokenAccount({
    connection: params.connection,
    tokenAccount: recipientFTokenAta,
    owner: params.recipient,
    mint: context.fTokenMint,
    tokenProgram: context.tokenProgram,
  });

  const sdkDepositIxs = await getJupDepositIxs({
    amount: new BN(0),
    asset: new PublicKey(USDC.Solana),
    signer: externalCallAuthority,
    connection: params.connection,
  });
  const sdkCreateRecipientFTokenAtaIx = findSdkRecipientTokenAtaIx(sdkDepositIxs, context);
  const createRecipientFTokenAtaIx = sdkCreateRecipientFTokenAtaIx
    ? patchSdkCreateRecipientFTokenAtaIx({
        instruction: sdkCreateRecipientFTokenAtaIx,
        context,
        recipient: params.recipient,
        recipientFTokenAta,
      })
    : createAssociatedTokenAccountIdempotentInstruction(
        externalCallAuthority,
        recipientFTokenAta,
        params.recipient,
        context.fTokenMint,
        context.tokenProgram,
        ASSOCIATED_TOKEN_PROGRAM_ID,
      );

  const createTempFTokenAtaIx = createAssociatedTokenAccountIdempotentInstruction(
    externalCallAuthority,
    externalCallWallet,
    externalCallAuthority,
    context.fTokenMint,
    context.tokenProgram,
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );

  const depositIx = patchSdkDepositIx({
    instruction: findJupLendDepositIx(sdkDepositIxs),
    context,
    depositorTokenAccount: externalCallWallet,
    recipientTokenAccount: externalCallWallet,
  });

  const transferMintedFTokenToRecipientIx = createTransferInstruction(
    externalCallWallet,
    recipientFTokenAta,
    externalCallAuthority,
    0n,
    [],
    context.tokenProgram,
  );

  const recipientAtaRentExpense = recipientFTokenAtaExists
    ? undefined
    : BigInt(await params.connection.getMinimumBalanceForRentExemption(AccountLayout.span));
  const tempFTokenAtaRentExpense = BigInt(await params.connection.getMinimumBalanceForRentExemption(AccountLayout.span));
  const fTokenWalletSubstitution: WalletSubstitution = {
    token_mint: context.fTokenMint.toBase58(),
    index: 0,
  };

  const createRecipientAtaBytes = serializeSolanaExternalInstruction({
    instruction: createRecipientFTokenAtaIx,
    expense: recipientAtaRentExpense,
    isInMandatoryBlock: true,
  });

  const createTempAtaBytes = serializeSolanaExternalInstruction({
    instruction: createTempFTokenAtaIx,
    walletSubstitutions: [
      {
        ...fTokenWalletSubstitution,
        index: CREATE_ATA_ACCOUNT_INDEX,
      },
    ],
    expense: tempFTokenAtaRentExpense,
    isInMandatoryBlock: true,
  });

  const depositBytes = serializeSolanaExternalInstruction({
    instruction: depositIx,
    amountSubstitutions: [
      {
        is_big_endian: false,
        offset: JUP_LEND_DEPOSIT_AMOUNT_OFFSET,
        account_index: JUP_LEND_DEPOSIT_DEPOSITOR_TOKEN_ACCOUNT_INDEX,
        subtraction: 0,
      },
    ],
    walletSubstitutions: [
      {
        ...fTokenWalletSubstitution,
        index: JUP_LEND_DEPOSIT_RECIPIENT_TOKEN_ACCOUNT_INDEX,
      },
    ],
    isInMandatoryBlock: true,
  });

  const transferMintedFTokenBytes = serializeSolanaExternalInstruction({
    instruction: transferMintedFTokenToRecipientIx,
    amountSubstitutions: [
      {
        is_big_endian: false,
        offset: SPL_TRANSFER_AMOUNT_OFFSET,
        account_index: SPL_TRANSFER_SOURCE_ACCOUNT_INDEX,
        subtraction: 0,
      },
    ],
    walletSubstitutions: [fTokenWalletSubstitution],
    isInMandatoryBlock: true,
  });

  const hook: DlnHook = {
    type: DlnHookType.SolanaSerializedInstructions,
    data: concatSolanaExternalInstructionsToHex([
      createRecipientAtaBytes,
      createTempAtaBytes,
      depositBytes,
      transferMintedFTokenBytes,
    ]),
  };

  return {
    hook,
    assetMint: context.mint,
    lendingAdmin: context.lendingAdmin,
    lending: context.lending,
    fTokenMint: context.fTokenMint,
    supplyTokenReservesLiquidity: context.supplyTokenReservesLiquidity,
    lendingSupplyPositionOnLiquidity: context.lendingSupplyPositionOnLiquidity,
    vault: context.vault,
    liquidity: context.liquidity,
    liquidityProgram: context.liquidityProgram,
    recipientFTokenAta,
    recipientFTokenAtaExists,
    tokenProgram: context.tokenProgram,
    serializedHookBytes: (hook.data.length - 2) / 2,
  };
}
