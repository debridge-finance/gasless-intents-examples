import { getTransferHook } from "@utils/hooks/erc20-hooks";
import { ExtendedHook, Trade } from "@gasless-intents/types";
import {
  destinationChainId,
  destinationToken,
  evmDestinationAddress,
  prependOperatingExpenses,
} from "./config";
import { Holding } from "../wallet-holdings/holding";

/**
 * True when the holding is already the destination token on the destination
 * chain (EVM only). There's nothing to swap — it just needs to move to the
 * destination address — so a plain ERC-20 transfer hook is used instead of a
 * (wasteful, likely-rejected) same-token trade.
 */
export function isSameEvmChainSameToken(holding: Holding): boolean {
  return (
    holding.chainName !== "Solana" &&
    !holding.isNative &&
    holding.chainId === destinationChainId &&
    holding.tokenAddress.toLowerCase() === destinationToken.toLowerCase()
  );
}

/**
 * Transfers the given amount via a prehook. The amount is passed as
 * `additionalAmount`; the backend substitutes it into the transfer calldata.
 */
export function buildTransferHook(holding: Holding, amountRaw: bigint, evmSigner: string): ExtendedHook {
  return getTransferHook(
    evmSigner, // sender (holds the funds)
    evmDestinationAddress, // beneficiary
    holding.tokenAddress,
    holding.chainId,
    amountRaw.toString(), // additionalAmount
  );
}

/** Builds a swap/bridge trade converting the given amount into USDC on Polygon. */
export function buildTrade(holding: Holding, amountRaw: bigint, evmSigner: string, solanaSigner: string): Trade {
  const isSolana = holding.chainName === "Solana";
  // Source-chain authority must be the wallet that controls the funds.
  const sourceAuthority = isSolana ? solanaSigner : evmSigner;

  return {
    srcChainId: holding.chainId,
    srcChainTokenIn: holding.tokenAddress,
    srcChainTokenInAmount: amountRaw.toString(),
    srcChainAuthorityAddress: sourceAuthority,

    dstChainId: destinationChainId,
    dstChainTokenOut: destinationToken,
    dstChainTokenOutAmount: "auto",
    dstChainTokenOutRecipient: evmDestinationAddress,
    // Destination-chain authority (can patch the trade) — the EVM destination,
    // since everything lands as USDC on Polygon.
    dstChainAuthorityAddress: evmDestinationAddress,

    prependOperatingExpenses,
  };
}
