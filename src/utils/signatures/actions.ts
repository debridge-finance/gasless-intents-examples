import { Action, ActionCostItemType, ActionType, Bundle, SignatureTypes } from "@gasless-intents/types";
import { CHAIN_IDS } from "@utils/chains";
import { EVM_NATIVE_TOKEN } from "@utils/constants";

export type RequiredActionEntry = {
  scope: "intent" | "preHook" | "postHook";
  itemIndex: number;
  actionIndex: number;
  chainId?: number;
  action: Action;
};

export function collectRequiredActions(bundle: Bundle): RequiredActionEntry[] {
  return [
    ...collectActions(bundle.intents, "intent", (item) => item.intent.intentChainId),
    ...collectActions(bundle.preHooks, "preHook", (item) => item.hook.chainId),
    ...collectActions(bundle.postHooks, "postHook", (item) => item.hook.chainId),
  ];
}

export function summarizeRequiredActions(entries: RequiredActionEntry[]): string[] {
  return entries.map((entry) => {
    const labels = entry.action.actions.join(", ");
    const chain = entry.chainId ?? "unknown chain";
    return `${entry.action.type} [${labels}] on ${chain}`;
  });
}

export function isRefillActivated(bundle: Bundle, actions = collectRequiredActions(bundle)): boolean {
  return (
    bundle.useRefill === true &&
    actions.some(
      (entry) => entry.action.type === SignatureTypes.PreSignedMessage && entry.action.actions.includes(ActionType.SignRefill),
    )
  );
}

export function findBudgetApprovalAction(bundle: Bundle): RequiredActionEntry | undefined {
  return collectRequiredActions(bundle).find(
    (entry) => entry.action.type === SignatureTypes.Transaction && entry.action.actions.includes(ActionType.Budget),
  );
}

export function getApprovalNativeGasCost(action: Action, chainId = CHAIN_IDS.Arbitrum): bigint {
  return (action.actionCosts ?? [])
    .filter(
      (cost) =>
        cost.type === ActionCostItemType.NETWORK_COST &&
        cost.costChainId === chainId &&
        cost.costTokenAddress.toLowerCase() === EVM_NATIVE_TOKEN,
    )
    .reduce((total, cost) => total + BigInt(cost.amount), 0n);
}

function collectActions<T extends { requiredActions?: Action[] }>(
  items: T[] | undefined,
  scope: RequiredActionEntry["scope"],
  getChainId: (item: T) => number | undefined,
): RequiredActionEntry[] {
  const entries: RequiredActionEntry[] = [];

  for (const [itemIndex, item] of (items ?? []).entries()) {
    for (const [actionIndex, action] of (item.requiredActions ?? []).entries()) {
      entries.push({
        scope,
        itemIndex,
        actionIndex,
        chainId: getChainId(item),
        action,
      });
    }
  }

  return entries;
}
