import {
  AccountLayout,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  getAccount,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { Connection, PublicKey, SYSVAR_INSTRUCTIONS_PUBKEY, TransactionInstruction } from "@solana/web3.js";
import { Reserve } from "@kamino-finance/klend-sdk/dist/@codegen/klend/accounts/Reserve";
import bs58 from "bs58";

import { DlnHook, DlnHookType } from "@gasless-intents/types";
import { KAMINO, USDC } from "@utils/constants";
import {
  concatSolanaExternalInstructionsToHex,
  serializeSolanaExternalInstruction,
  SOLANA_EXTERNAL_CALL_PLACEHOLDERS,
} from "@utils/solana/external-call";

const DEPOSIT_RESERVE_LIQUIDITY_DISCRIMINATOR = Buffer.from([169, 201, 30, 126, 6, 205, 102, 68]);
export const DEPOSIT_RESERVE_LIQUIDITY_AMOUNT_OFFSET = 8;
export const DEPOSIT_RESERVE_LIQUIDITY_SOURCE_ACCOUNT_INDEX = 7;

export type ResolvedKaminoReserve = {
  address: PublicKey;
  state: Reserve;
};

export type KaminoDepositDlnHookResult = {
  hook: DlnHook;
  reserve: ResolvedKaminoReserve;
  reserveLiquidityMint: PublicKey;
  reserveLiquiditySupply: PublicKey;
  reserveCollateralMint: PublicKey;
  recipientCollateralAta: PublicKey;
  recipientCollateralAtaExists: boolean;
  collateralTokenProgram: PublicKey;
  liquidityTokenProgram: PublicKey;
  serializedHookBytes: number;
};

function addressToString(address: unknown): string {
  return String(address);
}

export async function findKaminoReserveByLiquidityMint(params: {
  connection: Connection;
  lendingMarket: PublicKey;
  liquidityMint: PublicKey;
}): Promise<ResolvedKaminoReserve> {
  const reserveAccounts = await params.connection.getProgramAccounts(new PublicKey(KAMINO.LendProgram), {
    filters: [
      {
        memcmp: {
          offset: 0,
          bytes: bs58.encode(Reserve.discriminator),
        },
      },
    ],
  });

  const matchingReserves = reserveAccounts
    .map((account) => ({
      address: account.pubkey,
      state: Reserve.decode(account.account.data),
    }))
    .filter(({ state }) => {
      const isMainMarket = addressToString(state.lendingMarket) === params.lendingMarket.toBase58();
      const isLiquidityMint = addressToString(state.liquidity.mintPubkey) === params.liquidityMint.toBase58();
      const isFloatRateReserve = state.config.debtTermSeconds.isZero() && state.config.debtMaturityTimestamp.isZero();
      const isActiveReserve = state.config.status === 0;

      return isMainMarket && isLiquidityMint && isFloatRateReserve && isActiveReserve;
    });

  if (matchingReserves.length !== 1) {
    throw new Error(
      `Expected exactly one active Kamino float-rate reserve for ${params.liquidityMint.toBase58()} in market ${params.lendingMarket.toBase58()}, found ${matchingReserves.length}.`,
    );
  }

  return matchingReserves[0];
}

export async function getMintOwner(connection: Connection, mint: PublicKey): Promise<PublicKey> {
  const account = await connection.getAccountInfo(mint);

  if (!account) {
    throw new Error(`Mint account ${mint.toBase58()} does not exist.`);
  }

  return account.owner;
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

export function buildKaminoDepositReserveLiquidityIx(params: {
  reserve: ResolvedKaminoReserve;
  lendingMarketAuthority: PublicKey;
  sourceLiquidityAccount: PublicKey;
  sourceOwner: PublicKey;
  destinationCollateralAccount: PublicKey;
  collateralTokenProgram: PublicKey;
  liquidityTokenProgram: PublicKey;
}): TransactionInstruction {
  const data = Buffer.alloc(DEPOSIT_RESERVE_LIQUIDITY_AMOUNT_OFFSET + 8);
  DEPOSIT_RESERVE_LIQUIDITY_DISCRIMINATOR.copy(data, 0);
  data.writeBigUInt64LE(0n, DEPOSIT_RESERVE_LIQUIDITY_AMOUNT_OFFSET);

  const { state } = params.reserve;

  return new TransactionInstruction({
    programId: new PublicKey(KAMINO.LendProgram),
    keys: [
      { pubkey: params.sourceOwner, isSigner: true, isWritable: false },
      { pubkey: params.reserve.address, isSigner: false, isWritable: true },
      { pubkey: new PublicKey(addressToString(state.lendingMarket)), isSigner: false, isWritable: false },
      { pubkey: params.lendingMarketAuthority, isSigner: false, isWritable: false },
      { pubkey: new PublicKey(addressToString(state.liquidity.mintPubkey)), isSigner: false, isWritable: false },
      { pubkey: new PublicKey(addressToString(state.liquidity.supplyVault)), isSigner: false, isWritable: true },
      { pubkey: new PublicKey(addressToString(state.collateral.mintPubkey)), isSigner: false, isWritable: true },
      { pubkey: params.sourceLiquidityAccount, isSigner: false, isWritable: true },
      { pubkey: params.destinationCollateralAccount, isSigner: false, isWritable: true },
      { pubkey: params.collateralTokenProgram, isSigner: false, isWritable: false },
      { pubkey: params.liquidityTokenProgram, isSigner: false, isWritable: false },
      { pubkey: SYSVAR_INSTRUCTIONS_PUBKEY, isSigner: false, isWritable: false },
    ],
    data,
  });
}

export async function buildKaminoUsdcDepositDlnHook(params: {
  connection: Connection;
  recipient: PublicKey;
}): Promise<KaminoDepositDlnHookResult> {
  const reserve = await findKaminoReserveByLiquidityMint({
    connection: params.connection,
    lendingMarket: new PublicKey(KAMINO.MainMarket),
    liquidityMint: new PublicKey(USDC.Solana),
  });

  const reserveLiquidityMint = new PublicKey(addressToString(reserve.state.liquidity.mintPubkey));
  const reserveLiquiditySupply = new PublicKey(addressToString(reserve.state.liquidity.supplyVault));
  const reserveCollateralMint = new PublicKey(addressToString(reserve.state.collateral.mintPubkey));
  const liquidityTokenProgram = new PublicKey(addressToString(reserve.state.liquidity.tokenProgram));
  const collateralTokenProgram = await getMintOwner(params.connection, reserveCollateralMint);
  const recipientCollateralAta = getAssociatedTokenAddressSync(
    reserveCollateralMint,
    params.recipient,
    false,
    collateralTokenProgram,
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );
  const recipientCollateralAtaExists = await validateTokenAccount({
    connection: params.connection,
    tokenAccount: recipientCollateralAta,
    owner: params.recipient,
    mint: reserveCollateralMint,
    tokenProgram: collateralTokenProgram,
  });

  const [lendingMarketAuthority] = PublicKey.findProgramAddressSync(
    [Buffer.from("lma"), new PublicKey(addressToString(reserve.state.lendingMarket)).toBuffer()],
    new PublicKey(KAMINO.LendProgram),
  );

  const createRecipientCollateralAtaIx = createAssociatedTokenAccountIdempotentInstruction(
    new PublicKey(SOLANA_EXTERNAL_CALL_PLACEHOLDERS.authority),
    recipientCollateralAta,
    params.recipient,
    reserveCollateralMint,
    collateralTokenProgram,
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );

  const depositIx = buildKaminoDepositReserveLiquidityIx({
    reserve,
    lendingMarketAuthority,
    sourceLiquidityAccount: new PublicKey(SOLANA_EXTERNAL_CALL_PLACEHOLDERS.wallet),
    sourceOwner: new PublicKey(SOLANA_EXTERNAL_CALL_PLACEHOLDERS.authority),
    destinationCollateralAccount: recipientCollateralAta,
    collateralTokenProgram,
    liquidityTokenProgram,
  });

  const recipientAtaRentExpense = recipientCollateralAtaExists
    ? undefined
    : BigInt(await params.connection.getMinimumBalanceForRentExemption(AccountLayout.span));

  const createAtaBytes = serializeSolanaExternalInstruction({
    instruction: createRecipientCollateralAtaIx,
    expense: recipientAtaRentExpense,
    isInMandatoryBlock: true,
  });

  const depositBytes = serializeSolanaExternalInstruction({
    instruction: depositIx,
    amountSubstitutions: [
      {
        is_big_endian: false,
        offset: DEPOSIT_RESERVE_LIQUIDITY_AMOUNT_OFFSET,
        account_index: DEPOSIT_RESERVE_LIQUIDITY_SOURCE_ACCOUNT_INDEX,
        subtraction: 0,
      },
    ],
  });

  const hook: DlnHook = {
    type: DlnHookType.SolanaSerializedInstructions,
    data: concatSolanaExternalInstructionsToHex([createAtaBytes, depositBytes]),
  };

  return {
    hook,
    reserve,
    reserveLiquidityMint,
    reserveLiquiditySupply,
    reserveCollateralMint,
    recipientCollateralAta,
    recipientCollateralAtaExists,
    collateralTokenProgram,
    liquidityTokenProgram,
    serializedHookBytes: (hook.data.length - 2) / 2,
  };
}
