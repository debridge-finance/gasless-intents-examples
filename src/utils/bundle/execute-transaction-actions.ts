import { type Hex, type WalletClient } from "viem";
import { submitEvmTx } from "@utils/signatures/intent-signatures";
import { Action, SignatureTypes, Tx } from "@gasless-intents/types";

export type ExecutedAction = {
  actionId: string;
  actions: string;
  hash: Hex;
  status: string;
};

/**
 * Sends every Transaction-type requiredAction through the shared
 * {@link submitEvmTx} helper (utils/signatures/intent-signatures), waiting for
 * each receipt so the account nonce advances between sends. Non-Transaction
 * actions (e.g. Sign712) are ignored — handling them is the caller's decision.
 * Returns one entry per executed transaction.
 */
export async function executeTransactionActions(
  requiredActions: Action[],
  walletClient: WalletClient,
  publicClient: any, // viem PublicClient — widened to avoid deep type instantiation
): Promise<ExecutedAction[]> {
  const txActions = requiredActions.filter(
    (a) => a.type === SignatureTypes.Transaction && !!(a.data as Tx)?.to,
  );

  const executed: ExecutedAction[] = [];
  for (const action of txActions) {
    const hash = (await submitEvmTx(action.data as Tx, walletClient)) as Hex;
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    executed.push({
      actionId: action.actionId,
      actions: action.actions.join(","),
      hash,
      status: receipt.status,
    });
  }

  return executed;
}
