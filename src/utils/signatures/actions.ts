import { decodeFunctionData, getAddress } from "viem";
import {
  Action,
  ActionCostItemType,
  ActionType,
  Bundle,
  EnsureErc20AllowanceData,
  SignatureTypes,
  Tx,
} from "@gasless-intents/types";
import { CHAIN_IDS } from "@utils/chains";
import { EVM_NATIVE_TOKEN } from "@utils/constants";
import { Erc20Abi } from "@utils/contract-calls/abis";

export type RequiredActionEntry = {
  scope: "intent" | "preHook" | "postHook";
  itemIndex: number;
  actionIndex: number;
  chainId?: number;
  action: Action;
};

export type Erc20AllowanceRequirement = {
  chainId: number;
  token: `0x${string}`;
  spender: `0x${string}`;
  amount: bigint;
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

export function findErc20AllowanceRequirement(bundle: Bundle): Erc20AllowanceRequirement | undefined {
  for (const entry of collectRequiredActions(bundle)) {
    if (entry.chainId === undefined) continue;

    if (entry.action.type === SignatureTypes.EnsureErc20Allowance) {
      const data = entry.action.data as EnsureErc20AllowanceData;
      return {
        chainId: data.chainId,
        token: getAddress(data.token),
        spender: getAddress(data.allowanceHolder),
        amount: BigInt(data.minAmount),
      };
    }

    if (
      entry.action.type === SignatureTypes.Transaction &&
      entry.action.actions.includes(ActionType.Budget)
    ) {
      const tx = entry.action.data as Tx;
      if (!tx.to) continue;

      try {
        const decoded = decodeFunctionData({ abi: Erc20Abi.Approve, data: tx.data as `0x${string}` });
        if (decoded.functionName !== "approve") continue;
        const [spender, amount] = decoded.args;
        return {
          chainId: entry.chainId,
          token: getAddress(tx.to),
          spender: getAddress(spender),
          amount,
        };
      } catch {
      }
    }
  }

  return undefined;
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
