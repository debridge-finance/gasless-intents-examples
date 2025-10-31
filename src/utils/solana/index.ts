import { Keypair, MessageV0, VersionedTransaction } from "@solana/web3.js";

export function signSolanaTxHex(
  hex: string,
  signers: Keypair[],
): VersionedTransaction {
  const cleanHex = hex.startsWith("0x") ? hex.slice(2) : hex;
  const buf = Buffer.from(cleanHex, "hex");

  try {
    const vtx = VersionedTransaction.deserialize(buf);
    vtx.sign(signers);
    return vtx;
  } catch (e1) {
    // fallthrough
  }

  try {
    const msg = MessageV0.deserialize(buf);
    const vtx = new VersionedTransaction(msg);
    vtx.sign(signers);
    return vtx;
  } catch (e3) {
    throw new Error(
      "Unsupported or malformed hex payload: not a VersionedTransaction or MessageV0.",
    );
  }
}

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
