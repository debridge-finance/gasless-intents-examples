import { CHAIN_IDS } from "@utils/chains";
import { USDC } from "@utils/constants";

// --- Destination ---

export const evmDestinationAddress = "0x55A8f5cce1d53D9Ff84EC0962882b447E5914dB8";
// const solanaDestinationAddress = "862oLANNqhdXyUCwLJPBqUHrScrqNR4yoGWGTxjZftKs";
// Everything consolidates to USDC on Polygon at evmDestinationAddress, so the
// Solana destination above is intentionally unused.

// --- Final destination token (everything consolidates here) ---

export const destinationChainId = CHAIN_IDS.Polygon;
export const destinationToken = USDC.Polygon;

/** Human-readable label for the destination token, used in console output. */
export const destinationLabel = "USDC on Polygon";

// --- Thresholds & flags ---

/** Skip any holding worth less than this in USD (incl. native gas dust). */
export const minimumUsdValue = 1;

/**
 * With a full-balance sweep we want fees taken *out of* the input amount, so the
 * amount we specify is exactly what leaves the wallet. Hence prepend = false.
 * (prepend = true would charge the operating expense on top of the input, which
 * we can't cover when sweeping 100% of a balance.)
 */
export const prependOperatingExpenses = false;

/** Leave a little SOL behind for rent / transaction fees on the Solana side. */
export const solReserveLamports = 2_000_000n; // 0.002 SOL

export const referralCode = 110000002;
