import { encodeFunctionData, Address } from "viem";
import { Erc20Abi, Erc4626Abi, AaveV3Abi, EchoWithSigAbi } from "@utils/contract-calls/abis";
import { EvmTx } from "@gasless-intents/types";
import { CHAIN_IDS } from "@utils/chains";
import { ECHO_WITH_SIG_BASE } from "@utils/constants";

export function createApproveCall(tokenAddress: Address, spenderAddress: Address, amount: bigint): EvmTx {
  const data = encodeFunctionData({
    abi: Erc20Abi.Approve,
    functionName: "approve",
    args: [spenderAddress, amount],
  });

  return {
    to: tokenAddress,
    data,
    value: 0n,
  };
}

export function createTransferCall(to: Address, amount: bigint): EvmTx {
  const data = encodeFunctionData({
    abi: Erc20Abi.Transfer,
    functionName: "transfer",
    args: [to, amount],
  });

  return {
    to,
    data,
    value: 0n,
  };
}

export function createDepositCall(vaultAddress: Address, amount: bigint, receiverAddress: Address): EvmTx {
  const data = encodeFunctionData({
    abi: Erc4626Abi.Deposit,
    functionName: "deposit",
    args: [amount, receiverAddress],
  });

  return {
    to: vaultAddress,
    data,
    value: 0n,
  };
}

/** AAVE V3 */

export function createAaveSupplyCall(
  contractAddress: `0x${string}`,
  assetAddress: `0x${string}`,
  supplyAmount: bigint,
  onBehalfOf: `0x${string}`,
  aaveReferralCode: number = 0,
): EvmTx {
  const data = encodeFunctionData({
    abi: AaveV3Abi.Supply,
    functionName: "supply",
    args: [assetAddress, supplyAmount, onBehalfOf, aaveReferralCode],
  });

  return {
    to: contractAddress,
    data,
    value: 0n,
  };
}

export function createAaveWithdrawCall(
  contractAddress: `0x${string}`,
  assetAddress: `0x${string}`,
  withdrawAmount: bigint,
  to: `0x${string}`,
) {
  const data = encodeFunctionData({
    abi: AaveV3Abi.Withdraw,
    functionName: "withdraw",
    args: [assetAddress, withdrawAmount, to],
  });

  return {
    to: contractAddress,
    data,
    value: 0n,
  };
}

/** EchoWithSig */

export type EchoWithSigMessageArgs = {
  user: `0x${string}`;
  nonce: `0x${string}`;
  message: string;
  deadline: bigint;
};

export function createEchoWithSigMessageTypedData(args: EchoWithSigMessageArgs) {
  return {
    domain: {
      name: "EchoWithSig",
      version: "1",
      chainId: CHAIN_IDS.Base,
      verifyingContract: ECHO_WITH_SIG_BASE as `0x${string}`,
    },
    types: {
      EchoMessage: [
        { name: "user", type: "address" },
        { name: "nonce", type: "bytes32" },
        { name: "message", type: "string" },
        { name: "deadline", type: "uint256" },
      ],
    },
    primaryType: "EchoMessage",
    message: args,
  } as const;
}

export function createEchoWithSigCallDataWithSignaturePlaceholder(args: EchoWithSigMessageArgs): `0x${string}` {
  const dummySig = ("0x" + "00".repeat(65)) as `0x${string}`;
  const encoded = encodeFunctionData({
    abi: EchoWithSigAbi.EchoWithSig,
    functionName: "echoWithSig",
    args: [args.user, args.nonce, args.message, args.deadline, dummySig],
  });

  // Last 192 hex chars = 65 sig bytes + 31 zero-pad bytes (3 * 32-byte ABI words).
  // bytes signature is the last argument, so this slice maps to the sig data slot.
  const head = encoded.slice(0, encoded.length - 192);
  const tail = "{signature.65}" + "00".repeat(31);
  return (head + tail) as `0x${string}`;
}
