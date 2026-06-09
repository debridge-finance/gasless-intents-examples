import { formatEther, WalletClient } from "viem";

import { ActionType, SignatureTypes, Tx, WalletClientMap } from "@gasless-intents/types";
import { getApprovalNativeGasCost, RequiredActionEntry } from "@utils/signatures/actions";
import { submitEvmTx } from "@utils/signatures/intent-signatures";

export type ApprovalGasCheck = {
  balanceWei: bigint;
  requiredWei: bigint;
  hasEnough: boolean;
};

type WaitForApprovalGasOptions = {
  approval: RequiredActionEntry;
  authorityAddress: `0x${string}`;
  pollIntervalMs: number;
  maxAttempts: number;
  onPoll?: (attempt: number, gasCheck: ApprovalGasCheck) => void;
};

type BalanceReader = {
  getBalance(parameters: { address: `0x${string}` }): Promise<bigint>;
};

const sleep = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

export function formatNativeWei(rawAmount: bigint | string): string {
  return `${formatEther(BigInt(rawAmount))} ETH`;
}

export async function getApprovalGasCheck(
  approval: RequiredActionEntry,
  authorityAddress: `0x${string}`,
  publicClient: BalanceReader,
): Promise<ApprovalGasCheck> {
  if (!approval.chainId) {
    throw new Error(`Approval action ${approval.action.actionId} has no chainId`);
  }

  const balanceWei = await publicClient.getBalance({ address: authorityAddress });
  const requiredWei = getApprovalNativeGasCost(approval.action, approval.chainId);

  return {
    balanceWei,
    requiredWei,
    hasEnough: balanceWei >= requiredWei,
  };
}

export async function waitForApprovalGas(
  publicClient: BalanceReader,
  options: WaitForApprovalGasOptions,
): Promise<ApprovalGasCheck | undefined> {
  for (let attempt = 1; attempt <= options.maxAttempts; attempt++) {
    const gasCheck = await getApprovalGasCheck(options.approval, options.authorityAddress, publicClient);
    options.onPoll?.(attempt, gasCheck);

    if (gasCheck.hasEnough) {
      return gasCheck;
    }

    if (attempt < options.maxAttempts) {
      await sleep(options.pollIntervalMs);
    }
  }

  return undefined;
}

export async function broadcastBudgetApproval(approval: RequiredActionEntry, walletClientMap: WalletClientMap): Promise<string> {
  if (!approval.chainId) {
    throw new Error(`Approval action ${approval.action.actionId} has no chainId`);
  }

  if (approval.action.type !== SignatureTypes.Transaction || !approval.action.actions.includes(ActionType.Budget)) {
    throw new Error(`Action ${approval.action.actionId} is not a Budget approval transaction`);
  }

  const walletClient = walletClientMap[approval.chainId] as WalletClient | undefined;
  if (!walletClient) {
    throw new Error(`No wallet client available for chainId ${approval.chainId}`);
  }

  return submitEvmTx(approval.action.data as Tx, walletClient);
}
