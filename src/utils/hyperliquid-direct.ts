import { decodeFunctionData, getAddress, parseAbi, parseUnits } from "viem";

import { Action, ActionType, Bundle, EIP712Data, SignatureTypes, Tx } from "@gasless-intents/types";
import { CHAIN_IDS } from "@utils/chains";
import { HYPERCORE, HYPEREVM } from "@utils/constants";
import { Erc20Abi } from "@utils/contract-calls/abis";
import {
  fail,
  isTypedData,
  requireAddress,
  requireDomain,
  requireEqual,
} from "@utils/hyperliquid-withdrawal";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const SEND_ASSET_PRIMARY_TYPE = "HyperliquidTransaction:SendAsset";

const EVM_WALLET_TX_OPERATION = "EvmWalletTx";

const USDC_DEPOSIT_WALLET_ABI = parseAbi(["function deposit(uint256 amount, uint32 destinationDex)"]);
const SPOT_DEX = 0;

export type HyperEvmDepositTransaction = {
  actionId: string;
  role: "approve" | "deposit";
  to: `0x${string}`;
  value: bigint;
  data: `0x${string}`;
};

function hasOperation(action: Action, operation: string): boolean {
  return (action.actions as string[]).includes(operation);
}

function decodeApprove(data: `0x${string}`) {
  try {
    return decodeFunctionData({ abi: Erc20Abi.Approve, data }).args;
  } catch {
    return fail("approve.data", "approve(address,uint256) calldata", data.slice(0, 10));
  }
}

function decodeDeposit(data: `0x${string}`) {
  try {
    return decodeFunctionData({ abi: USDC_DEPOSIT_WALLET_ABI, data }).args;
  } catch {
    return fail("deposit.data", "deposit(uint256,uint32) calldata", data.slice(0, 10));
  }
}

export function verifyHyperEvmUsdcDeposit(params: {
  bundle: Bundle;
  owner: `0x${string}`;
  amount: bigint;
}): HyperEvmDepositTransaction[] {
  const { bundle, owner, amount } = params;
  if (bundle.trades.length !== 1 || bundle.intents.length !== 1) {
    throw new Error("Refusing to broadcast: a direct deposit must contain exactly one trade and one intent.");
  }

  const trade = bundle.trades[0];
  requireEqual("trade.dstChainTokenOut.chainId", String(CHAIN_IDS.HyperCore), trade.dstChainTokenOut.chainId);
  requireAddress("trade.dstChainTokenOutRecipient", owner, trade.dstChainTokenOutRecipient);

  const transactions = bundle.intents[0].requiredActions.map((action): HyperEvmDepositTransaction => {
    if (action.type !== SignatureTypes.Transaction) {
      fail(`${action.actionId}.type`, SignatureTypes.Transaction, action.type);
    }
    const tx = action.data as Tx;
    if (typeof tx.to !== "string") fail(`${action.actionId}.to`, "an EVM address", tx.to);
    const to = getAddress(tx.to);
    const data = tx.data as `0x${string}`;
    const value = BigInt(tx.value ?? "0");
    if (value !== 0n) fail(`${action.actionId}.value`, "0", value.toString());

    if (hasOperation(action, ActionType.Budget)) {
      const [spender, approved] = decodeApprove(data);
      requireAddress("approve.to", HYPERCORE.USDC.address, to);
      requireAddress("approve.spender", HYPEREVM.usdcDepositWallet, spender);
      if (approved < amount) fail("approve.amount", `at least ${amount.toString()}`, approved.toString());
      return { actionId: action.actionId, role: "approve", to, value, data };
    }

    if (hasOperation(action, EVM_WALLET_TX_OPERATION)) {
      const [deposited, destinationDex] = decodeDeposit(data);
      requireAddress("deposit.to", HYPEREVM.usdcDepositWallet, to);
      requireEqual("deposit.amount", amount.toString(), deposited.toString());
      requireEqual("deposit.destinationDex", String(SPOT_DEX), destinationDex);
      return { actionId: action.actionId, role: "deposit", to, value, data };
    }

    return fail(
      `${action.actionId}.actions`,
      `${ActionType.Budget} or ${EVM_WALLET_TX_OPERATION}`,
      action.actions.join(","),
    );
  });

  const depositIndex = transactions.findIndex((tx) => tx.role === "deposit");
  const approveCount = transactions.filter((tx) => tx.role === "approve").length;
  if (depositIndex === -1 || transactions.length !== approveCount + 1 || approveCount > 1) {
    throw new Error(
      `Refusing to broadcast: expected one deposit and at most one approve, got ${transactions.length} transactions.`,
    );
  }
  if (depositIndex !== transactions.length - 1) {
    throw new Error("Refusing to broadcast: the approve must come before the deposit.");
  }

  return transactions;
}

export function verifyHyperCoreUsdcSendToHyperEvm(params: {
  bundle: Bundle;
  owner: `0x${string}`;
  amount: bigint;
}): Action & { data: EIP712Data } {
  const { bundle, owner, amount } = params;
  if (bundle.trades.length !== 1 || bundle.intents.length !== 1) {
    throw new Error("Refusing to sign: a direct transfer must contain exactly one trade and one intent.");
  }

  const trade = bundle.trades[0];
  const actions = bundle.intents[0].requiredActions;
  if (actions.length !== 1) {
    throw new Error(`Refusing to sign: expected exactly one SendAsset action, got ${actions.length}.`);
  }
  const action = actions[0];
  if (!isTypedData(action) || action.data.primaryType !== SEND_ASSET_PRIMARY_TYPE) {
    fail("action", `${SignatureTypes.Sign712} ${SEND_ASSET_PRIMARY_TYPE}`, `${action.type} ${(action.data as Partial<EIP712Data>).primaryType}`);
  }

  requireDomain("SendAsset", action.data, {
    name: "HyperliquidSignTransaction",
    version: "1",
    chainId: HYPEREVM.chainId,
    verifyingContract: ZERO_ADDRESS,
  });

  const message = action.data.message;
  requireAddress("SendAsset.destination", HYPERCORE.USDC.systemAddress, message.destination);
  requireEqual("SendAsset.token", "USDC", message.token);
  requireEqual("SendAsset.hyperliquidChain", "Mainnet", message.hyperliquidChain);
  requireEqual("SendAsset.sourceDex", "spot", message.sourceDex);
  requireEqual("SendAsset.destinationDex", "spot", message.destinationDex);
  requireEqual("SendAsset.fromSubAccount", "", message.fromSubAccount);

  if (typeof message.amount !== "string") fail("SendAsset.amount", "a decimal string", message.amount);
  const fractional = message.amount.split(".")[1] ?? "";
  if (fractional.length > HYPERCORE.USDC.coreDecimals) {
    fail("SendAsset.amount", `at most ${HYPERCORE.USDC.coreDecimals} fractional digits`, message.amount);
  }
  requireEqual(
    "SendAsset.amount",
    amount.toString(),
    parseUnits(message.amount, HYPERCORE.USDC.evmDecimals).toString(),
  );

  requireAddress("trade.dstChainTokenOutRecipient", owner, trade.dstChainTokenOutRecipient);
  requireAddress("trade.dstChainTokenOut.address", HYPERCORE.USDC.address, trade.dstChainTokenOut.address);

  return action;
}
