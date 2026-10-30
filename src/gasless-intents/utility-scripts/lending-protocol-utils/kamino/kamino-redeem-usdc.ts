import "dotenv/config";

import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  getAccount,
  getAssociatedTokenAddressSync,
  getMint,
} from "@solana/spl-token";
import {
  ComputeBudgetProgram,
  Connection,
  Keypair,
  PublicKey,
  sendAndConfirmTransaction,
  SYSVAR_INSTRUCTIONS_PUBKEY,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import bs58 from "bs58";

import { KAMINO, SOLANA_RPC_URL, USDC } from "@utils/constants";
import { getEnvConfig } from "@utils/env";
import { findKaminoReserveByLiquidityMint, getMintOwner, ResolvedKaminoReserve } from "@utils/solana/kamino";

const REDEEM_RESERVE_COLLATERAL_DISCRIMINATOR = Buffer.from([234, 117, 181, 125, 185, 142, 220, 29]);
const REDEEM_RESERVE_COLLATERAL_AMOUNT_OFFSET = 8;

function addressToString(address: unknown): string {
  return String(address);
}

function formatTokenAmount(amount: bigint, decimals: number): string {
  if (decimals === 0) return amount.toString();

  const scale = 10n ** BigInt(decimals);
  const whole = amount / scale;
  const fraction = amount % scale;
  const fractionText = fraction.toString().padStart(decimals, "0").replace(/0+$/, "");

  return fractionText.length > 0 ? `${whole}.${fractionText}` : whole.toString();
}

function buildRedeemReserveCollateralIx(params: {
  reserve: ResolvedKaminoReserve;
  lendingMarketAuthority: PublicKey;
  owner: PublicKey;
  sourceCollateralAccount: PublicKey;
  destinationLiquidityAccount: PublicKey;
  collateralTokenProgram: PublicKey;
  liquidityTokenProgram: PublicKey;
  collateralAmount: bigint;
}): TransactionInstruction {
  const data = Buffer.alloc(REDEEM_RESERVE_COLLATERAL_AMOUNT_OFFSET + 8);
  REDEEM_RESERVE_COLLATERAL_DISCRIMINATOR.copy(data, 0);
  data.writeBigUInt64LE(params.collateralAmount, REDEEM_RESERVE_COLLATERAL_AMOUNT_OFFSET);

  const { state } = params.reserve;

  return new TransactionInstruction({
    programId: new PublicKey(KAMINO.LendProgram),
    keys: [
      { pubkey: params.owner, isSigner: true, isWritable: false },
      { pubkey: new PublicKey(addressToString(state.lendingMarket)), isSigner: false, isWritable: false },
      { pubkey: params.reserve.address, isSigner: false, isWritable: true },
      { pubkey: params.lendingMarketAuthority, isSigner: false, isWritable: false },
      { pubkey: new PublicKey(addressToString(state.liquidity.mintPubkey)), isSigner: false, isWritable: false },
      { pubkey: new PublicKey(addressToString(state.collateral.mintPubkey)), isSigner: false, isWritable: true },
      { pubkey: new PublicKey(addressToString(state.liquidity.supplyVault)), isSigner: false, isWritable: true },
      { pubkey: params.sourceCollateralAccount, isSigner: false, isWritable: true },
      { pubkey: params.destinationLiquidityAccount, isSigner: false, isWritable: true },
      { pubkey: params.collateralTokenProgram, isSigner: false, isWritable: false },
      { pubkey: params.liquidityTokenProgram, isSigner: false, isWritable: false },
      { pubkey: SYSVAR_INSTRUCTIONS_PUBKEY, isSigner: false, isWritable: false },
    ],
    data,
  });
}

function loadOptionalFeePayer(owner: Keypair): Keypair {
  const encodedFeePayer = process.env.SOL_FEE_PAYER_PK;

  if (!encodedFeePayer) return owner;

  return Keypair.fromSecretKey(bs58.decode(encodedFeePayer));
}

async function main() {
  const { solPrivateKey } = getEnvConfig();
  const owner = Keypair.fromSecretKey(bs58.decode(solPrivateKey));
  const feePayer = loadOptionalFeePayer(owner);
  const connection = new Connection(SOLANA_RPC_URL, "confirmed");

  const reserve = await findKaminoReserveByLiquidityMint({
    connection,
    lendingMarket: new PublicKey(KAMINO.MainMarket),
    liquidityMint: new PublicKey(USDC.Solana),
  });

  const liquidityMint = new PublicKey(addressToString(reserve.state.liquidity.mintPubkey));
  const collateralMint = new PublicKey(addressToString(reserve.state.collateral.mintPubkey));
  const liquidityTokenProgram = new PublicKey(addressToString(reserve.state.liquidity.tokenProgram));
  const collateralTokenProgram = await getMintOwner(connection, collateralMint);
  const liquidityMintInfo = await getMint(connection, liquidityMint, "confirmed", liquidityTokenProgram);
  const collateralMintInfo = await getMint(connection, collateralMint, "confirmed", collateralTokenProgram);

  const ownerCollateralAta = getAssociatedTokenAddressSync(
    collateralMint,
    owner.publicKey,
    false,
    collateralTokenProgram,
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );
  const ownerLiquidityAta = getAssociatedTokenAddressSync(
    liquidityMint,
    owner.publicKey,
    false,
    liquidityTokenProgram,
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );

  const collateralAccount = await getAccount(connection, ownerCollateralAta, "confirmed", collateralTokenProgram);

  if (!collateralAccount.owner.equals(owner.publicKey)) {
    throw new Error(
      `cToken ATA owner mismatch: ${ownerCollateralAta.toBase58()} is owned by ${collateralAccount.owner.toBase58()}, not ${owner.publicKey.toBase58()}.`,
    );
  }

  if (!collateralAccount.mint.equals(collateralMint)) {
    throw new Error(
      `cToken ATA mint mismatch: ${ownerCollateralAta.toBase58()} has mint ${collateralAccount.mint.toBase58()}, not ${collateralMint.toBase58()}.`,
    );
  }

  const collateralAmount = collateralAccount.amount;

  if (collateralAmount === 0n) {
    console.error(`No Kamino USDC cTokens found in ${ownerCollateralAta.toBase58()}. Nothing to redeem.`);
    process.exitCode = 1;
    return;
  }

  const [lendingMarketAuthority] = PublicKey.findProgramAddressSync(
    [Buffer.from("lma"), new PublicKey(addressToString(reserve.state.lendingMarket)).toBuffer()],
    new PublicKey(KAMINO.LendProgram),
  );

  const usdcBefore = await getAccount(connection, ownerLiquidityAta, "confirmed", liquidityTokenProgram).catch(() => null);

  console.log("\n--- Kamino USDC Redeem ---");
  console.log("Owner:", owner.publicKey.toBase58());
  console.log("Fee payer:", feePayer.publicKey.toBase58());
  console.log("Kamino reserve:", reserve.address.toBase58());
  console.log("Reserve liquidity mint:", liquidityMint.toBase58());
  console.log("Reserve collateral mint:", collateralMint.toBase58());
  console.log("Owner cToken ATA:", ownerCollateralAta.toBase58());
  console.log("Owner USDC ATA:", ownerLiquidityAta.toBase58());
  console.log(
    "Redeeming cTokens:",
    `${formatTokenAmount(collateralAmount, collateralMintInfo.decimals)} (${collateralAmount.toString()} raw)`,
  );
  console.log(
    "Wallet USDC before:",
    usdcBefore
      ? `${formatTokenAmount(usdcBefore.amount, liquidityMintInfo.decimals)} (${usdcBefore.amount.toString()} raw)`
      : "ATA missing",
  );

  const createOwnerLiquidityAtaIx = createAssociatedTokenAccountIdempotentInstruction(
    feePayer.publicKey,
    ownerLiquidityAta,
    owner.publicKey,
    liquidityMint,
    liquidityTokenProgram,
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );
  const redeemIx = buildRedeemReserveCollateralIx({
    reserve,
    lendingMarketAuthority,
    owner: owner.publicKey,
    sourceCollateralAccount: ownerCollateralAta,
    destinationLiquidityAccount: ownerLiquidityAta,
    collateralTokenProgram,
    liquidityTokenProgram,
    collateralAmount,
  });
  const tx = new Transaction().add(
    ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 }),
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 10_000 }),
    createOwnerLiquidityAtaIx,
    redeemIx,
  );
  const signers = feePayer.publicKey.equals(owner.publicKey) ? [owner] : [feePayer, owner];

  console.log("\nSending redeem transaction...");
  const signature = await sendAndConfirmTransaction(connection, tx, signers, {
    commitment: "confirmed",
    skipPreflight: false,
  });

  console.log("Redeem transaction confirmed:", signature);
  console.log(`Solscan: https://solscan.io/tx/${signature}`);

  const collateralAfter = await getAccount(connection, ownerCollateralAta, "confirmed", collateralTokenProgram);
  const usdcAfter = await getAccount(connection, ownerLiquidityAta, "confirmed", liquidityTokenProgram);
  const usdcDelta = usdcBefore ? usdcAfter.amount - usdcBefore.amount : usdcAfter.amount;

  console.log("\n--- Redeem Complete ---");
  console.log(
    "cTokens after:",
    `${formatTokenAmount(collateralAfter.amount, collateralMintInfo.decimals)} (${collateralAfter.amount.toString()} raw)`,
  );
  console.log(
    "Wallet USDC after:",
    `${formatTokenAmount(usdcAfter.amount, liquidityMintInfo.decimals)} (${usdcAfter.amount.toString()} raw)`,
  );
  console.log("USDC received:", `${formatTokenAmount(usdcDelta, liquidityMintInfo.decimals)} (${usdcDelta.toString()} raw)`);
}

main().catch((error) => {
  console.error("\nFATAL ERROR in script execution:", error);
  process.exitCode = 1;
});
