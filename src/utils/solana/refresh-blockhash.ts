import { Bundle, SignatureTypes, SolanaSign } from "@gasless-intents/types";
import { CHAIN_IDS } from "@utils/chains";
import { refreshSolanaTransaction } from "@utils/gasless-api";

/**
 * Refresh service-signed AA transactions in intents and hooks before collecting new wallet signatures.
 * Do not edit recentBlockhash locally: that would invalidate deBridge's service signature.
 * The caller must re-sign this returned bundle and use it as the complete submit payload.
 */
export async function refreshSolanaBundleTransactions(bundle: Bundle): Promise<Bundle> {
  const refreshed: Bundle = structuredClone(bundle);
  delete refreshed.signedData; // Every signature will be collected again; no stale signedData can leak into submit.
  const items = [
    ...(refreshed.intents ?? []).map((item) => ({ chainId: item.intent.intentChainId, actions: item.requiredActions })),
    ...(refreshed.preHooks ?? []).map((item) => ({ chainId: item.hook.chainId, actions: item.requiredActions })),
    ...(refreshed.postHooks ?? []).map((item) => ({ chainId: item.hook.chainId, actions: item.requiredActions })),
  ];

  let count = 0;
  for (const item of items) {
    if (item.chainId !== CHAIN_IDS.Solana) continue;
    for (const action of item.actions ?? []) {
      if (action.type !== SignatureTypes.SignTransaction) continue;
      const data = action.data as SolanaSign;
      // Pass the proposal's original service-signed bytes, not the old wallet-signedData entry.
      data.data = await refreshSolanaTransaction(data.data);
      count++;
    }
  }
  if (count === 0) throw new Error("Bundle has no Solana SignTransaction actions to refresh");
  return refreshed;
}
