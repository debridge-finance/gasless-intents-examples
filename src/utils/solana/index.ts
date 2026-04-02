import { Connection, Keypair, VersionedTransaction } from "@solana/web3.js";
import nacl from "tweetnacl";
import bs58 from 'bs58';
import { clipHexPrefix } from "..";

export function extractTransactionHexData(obj: any): string[] {
  const result: string[] = [];

  if (!obj?.intents) return result;

  for (const intent of obj.intents) {
    const requiredActions = intent?.requiredActions;
    if (!Array.isArray(requiredActions)) continue;

    for (const action of requiredActions) {
      if (action?.type === "Transaction" && typeof action?.data?.data === "string") {
        result.push(action.data.data);
      }
    }
  }

  return result;
}


export function extractTransactionHexData2(obj: any): Array<{ actionId: string, data: string }> {
  const result: Array<{ actionId: string, data: string }> = [];

  if (!obj?.intents) return result;

  for (const intent of obj.intents) {
    const requiredActions = intent?.requiredActions;
    if (!Array.isArray(requiredActions)) continue;

    for (const action of requiredActions) {
      if (action?.type === "Transaction" && typeof action?.data?.data === "string") {
        result.push({ data: action.data.data, actionId: action.actionId });
      }
    }
  }

  return result;
}

export async function prepareSolanaTransaction(solRpcUrl: string, txData: string, solWallet: Keypair) {
  const connection = new Connection(solRpcUrl, { commitment: "confirmed" });
  const tx = VersionedTransaction.deserialize(Buffer.from(clipHexPrefix(txData), "hex"));

  const latestBlockhash = await connection.getLatestBlockhash();
  tx.message.recentBlockhash = latestBlockhash.blockhash; // Update the blockhash for simulation!
  tx.sign([solWallet]); // Sign the tx with wallet

  const simulatedTx = await connection.simulateTransaction(tx);
  const used = simulatedTx.value.unitsConsumed ?? 200_000; // fallback if missing
  const NEW_CU_LIMIT = Math.ceil(used * 1.1); // Add a 10% buffer

  const feeHistory = await connection.getRecentPrioritizationFees();
  const fees = feeHistory.map(f => f.prioritizationFee);

  let suggestedFee: number;
  if (fees.length === 0) {
    suggestedFee = 2_000; // fallback if RPC returns nothing
  } else {
    // sort ascending
    fees.sort((a, b) => a - b);
    // take middle element
    suggestedFee = fees[Math.floor(fees.length / 2)];
  }

  const NEW_CU_PRICE = suggestedFee;

  updatePriorityFee(tx, NEW_CU_PRICE, NEW_CU_LIMIT);

  const { blockhash } = await connection.getLatestBlockhash();
  tx.message.recentBlockhash = blockhash; // Update the blockhash again!
  
  tx.sign([solWallet]); // Sign the tx with wallet
  
  return tx;
}

export function updatePriorityFee(tx: VersionedTransaction, computeUnitPrice: number, computeUnitLimit?: number) {
  const computeBudgetOffset = 1;
  const computeUnitPriceData = tx.message.compiledInstructions[1].data;
  const encodedPrice = encodeNumberToArrayLE(computeUnitPrice, 8);
  for (let i = 0; i < encodedPrice.length; i++) {
    computeUnitPriceData[i + computeBudgetOffset] = encodedPrice[i];
  }

  if (computeUnitLimit) {
    const computeUnitLimitData = tx.message.compiledInstructions[0].data;
    const encodedLimit = encodeNumberToArrayLE(computeUnitLimit, 4);
    for (let i = 0; i < encodedLimit.length; i++) {
      computeUnitLimitData[i + computeBudgetOffset] = encodedLimit[i];
    }
  }
}

function encodeNumberToArrayLE(num: number, arraySize: number): Uint8Array {
  const result = new Uint8Array(arraySize);
  for (let i = 0; i < arraySize; i++) {
    result[i] = Number(num & 0xff);
    num >>= 8;
  }

  return result;
}

export function extractSignData(payload) {
  if (!payload?.intents) return null;

  for (const intent of payload.intents) {
    if (!intent.requiredActions) continue;

    for (const action of intent.requiredActions) {
      if (action.type === "Sign" && action.actions?.includes("Intent")) {
        return action?.data?.data || null;
      }
    }
  }
  return null;
}

export function extractSignAction(payload) {
  if (!payload?.intents) return null;

  for (const intent of payload.intents) {
    if (!intent.requiredActions) continue;

    for (const action of intent.requiredActions) {
      if (action.type === "Sign" && action.actions?.includes("Intent")) {
        return {
          data: action?.data?.data || null,
          actionId: action?.actionId || null
        };
      }
    }
  }
  return null;
}

/**
 * Refreshes Solana blockhashes in preHook actions BEFORE signing.
 *
 * Prehook builders use a placeholder blockhash ("11111111111111111111111111111111").
 * The API returns this placeholder unchanged. We must replace it with a fresh
 * blockhash from the Solana RPC before signing, otherwise validators will reject
 * the transaction.
 *
 * Only refreshes SignTransaction actions of type "Hook" (not "Compensation").
 * GasCompensation transactions are handled by the API.
 */
export async function refreshSolanaPreHookBlockhashes(
  bundle: { preHooks?: Array<{ requiredActions?: Array<any>; hook?: { chainId?: number } }> },
  solanaChainId: number,
  solRpcUrl: string,
): Promise<void> {
  const preHooks = bundle.preHooks;
  if (!preHooks || !Array.isArray(preHooks)) return;

  const hasSolanaHook = preHooks.some(
    (h) => h.hook?.chainId === solanaChainId,
  );
  if (!hasSolanaHook) return;

  const connection = new Connection(solRpcUrl, "confirmed");
  const { blockhash: newBlockhash } = await connection.getLatestBlockhash({
    commitment: "confirmed",
  });

  for (const hook of preHooks) {
    if (hook.hook?.chainId !== solanaChainId) continue;

    for (const action of hook.requiredActions ?? []) {
      if (action.type !== "SignTransaction") continue;
      if (!Array.isArray(action.actions) || !action.actions.includes("Hook")) continue;
      if (typeof action.data?.data === "string") {
        action.data.data = refreshVersionedTxBlockhash(action.data.data, newBlockhash);
      }
    }
  }
}

function refreshVersionedTxBlockhash(txHex: string, newBlockhash: string): string {
  const cleanHex = txHex.startsWith("0x") ? txHex.slice(2) : txHex;
  const buf = Buffer.from(cleanHex, "hex");
  const vtx = VersionedTransaction.deserialize(buf);

  vtx.message.recentBlockhash = newBlockhash;

  // Zero out signatures — changing blockhash invalidates them
  vtx.signatures = vtx.signatures.map(() => new Uint8Array(64));

  const serialized = vtx.serialize();
  return `0x${Buffer.from(serialized).toString("hex")}`;
}

export function signHexMessageBySolanaKey(
  messageHex: string,
  keypair: Keypair
) {
  const message = Buffer.from(clipHexPrefix(messageHex), 'hex');
  const sig = nacl.sign.detached(message, keypair.secretKey);
  return {
    hex: Buffer.from(sig).toString("hex"),
    base58: bs58.encode(sig),
    base64: Buffer.from(sig).toString("base64")
  };
}