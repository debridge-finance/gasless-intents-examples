import {
  AccountLayout,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferInstruction,
  getAccount,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { Connection, PublicKey, SystemProgram, TransactionInstruction } from "@solana/web3.js";
import BN from "bn.js";

import { DlnHook, DlnHookType } from "@gasless-intents/types";
import { JUP_LEND, USDC } from "@utils/constants";
import {
  concatSolanaExternalInstructionsToHex,
  serializeSolanaExternalInstruction,
  SOLANA_EXTERNAL_CALL_PLACEHOLDERS,
} from "@utils/solana/external-call";

const JUP_LEND_REDEEM_DISCRIMINATOR = Buffer.from([184, 12, 86, 149, 70, 196, 97, 225]);
export const JUP_LEND_DEPOSIT_AMOUNT_OFFSET = 8;
export const JUP_LEND_DEPOSIT_DEPOSITOR_TOKEN_ACCOUNT_INDEX = 1;
export const JUP_LEND_DEPOSIT_RECIPIENT_TOKEN_ACCOUNT_INDEX = 2;
export const JUP_LEND_REDEEM_SHARES_OFFSET = 8;
const CREATE_ATA_ACCOUNT_INDEX = 1;
const SPL_TRANSFER_AMOUNT_OFFSET = 1;
const SPL_TRANSFER_SOURCE_ACCOUNT_INDEX = 0;

type JupLendContextParams = {
  asset: PublicKey;
  signer: PublicKey;
  connection: Connection;
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
  getLendingProgram(params: { connection: Connection; signer: PublicKey }): JupLendingProgram;
};

type JupLendingProgram = {
  methods: {
    deposit(amount: BN): {
      accounts(context: JupLendContext): {
        instruction(): Promise<TransactionInstruction>;
      };
    };
  };
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

async function buildJupLendDepositIxFromContext(params: {
  connection: Connection;
  context: JupLendContext;
  signer: PublicKey;
  amount: BN;
}): Promise<TransactionInstruction> {
  // @jup-ag/lend is ESM-only; preserve native import when this repo emits CommonJS.
  const { getLendingProgram } = await nativeImport("@jup-ag/lend/earn");
  const program = getLendingProgram({
    connection: params.connection,
    signer: params.signer,
  });

  return program.methods.deposit(params.amount).accounts(params.context).instruction();
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
  const tempFTokenAta = SystemProgram.programId;

  const recipientFTokenAta = getAssociatedTokenAddressSync(
    context.fTokenMint,
    params.recipient,
    true,
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

  const createRecipientFTokenAtaIx = createAssociatedTokenAccountIdempotentInstruction(
    externalCallAuthority,
    recipientFTokenAta,
    params.recipient,
    context.fTokenMint,
    context.tokenProgram,
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );

  context.signer = externalCallAuthority;
  context.depositorTokenAccount = externalCallWallet;
  context.recipientTokenAccount = tempFTokenAta;

  const depositIx = await buildJupLendDepositIxFromContext({
    connection: params.connection,
    context,
    signer: externalCallAuthority,
    amount: new BN(0),
  });

  const transferMintedFTokenToRecipientIx = createTransferInstruction(
    tempFTokenAta,
    recipientFTokenAta,
    externalCallAuthority,
    1n,
    [],
    context.tokenProgram,
  );

  const recipientAtaRentExpense = recipientFTokenAtaExists
    ? undefined
    : BigInt(await params.connection.getMinimumBalanceForRentExemption(AccountLayout.span));
  const tempFTokenAtaRentExpense = BigInt(await params.connection.getMinimumBalanceForRentExemption(AccountLayout.span));
  const fTokenWalletSubstitution = {
    token_mint: context.fTokenMint.toBase58(),
    index: 0,
  };

  const createTempAtaBytes = serializeSolanaExternalInstruction({
    instruction: createAssociatedTokenAccountIdempotentInstruction(
      externalCallAuthority,
      tempFTokenAta,
      externalCallAuthority,
      context.fTokenMint,
      context.tokenProgram,
      ASSOCIATED_TOKEN_PROGRAM_ID,
    ),
    expense: tempFTokenAtaRentExpense,
    reward: 0n,
    walletSubstitutions: [
      {
        ...fTokenWalletSubstitution,
        index: CREATE_ATA_ACCOUNT_INDEX,
      },
    ],
    isInMandatoryBlock: false,
  });

  const createRecipientAtaBytes = serializeSolanaExternalInstruction({
    instruction: createRecipientFTokenAtaIx,
    expense: recipientAtaRentExpense,
    reward: 0n,
    isInMandatoryBlock: false,
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
    reward: 0n,
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
      createTempAtaBytes,
      createRecipientAtaBytes,
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
