// Explorer / Bundle Aggregator Service (BAS) types. Consumed by `GET /v1/explorer/bundles` (list) and
// `GET /v1/explorer/bundles/{id}` (detail), plus the `explorer_bundle_update` WS event. Distinct from the
// partner-tracking `*Tracking` types in `./tracking.types.ts` — explorer responses have a completely different
// shape centred on `tradeGroups[]` and `execBatches[]`.

import type { PlaceHolder } from "./types";

// --- Bundle Aggregator Service (BAS / Explorer) types ---

export type ExplorerListFilterParams = {
  type?: "Market";
  srcChain?: string;            // comma-separated chain IDs
  dstChain?: string;            // comma-separated chain IDs
  status?: string;              // comma-separated statuses
  createdFrom?: string;
  createdTo?: string;
  orderId?: string;             // singular on the new endpoint
  bundleId?: string;            // comma-separated bundle IDs
  q?: string;                   // full-text: addresses, hashes, IDs
  limit?: number;
  page?: number;
  afterCursor?: number;         // offset alternative to page
};

export type ExplorerChain = {
  id: number;
  name?: string;
  icon?: string;
};

export type ExplorerToken = {
  chainId: number;
  address: string;
  amount: string;
  symbol?: string;
  decimals?: number;
  iconUrl?: string;
  usd?: string;
};

export type ExplorerTokens = {
  tokens: ExplorerToken[];
  usdAmount: string;
};

export type ExplorerCounters = {
  trades: number;
  hooks: number;
};

export enum OperatingExpenseType {
  ProtocolCost = "PROTOCOL_COST",
  SolverCost = "SOLVER_COST",
  PartnerCost = "PARTNER_COST",
  NetworkCost = "NETWORK_COST",
  TotalNetworkCost = "TOTAL_NETWORK_COST_USD"
}

export type ExplorerOperatingExpense = {
  costChainId: number;
  costTokenAddress?: string;
  amount?: string;
  approximateUsdValue?: number | null;
  type?: OperatingExpenseType;
  feeBps?: number | null;
  details?: { originalChainId: number };
  tokenIconUrl?: string | null;
  chainIconUrl?: string | null;
};

export type ExplorerBundleListItem = {
  id: string;
  status: ExplorerTradeStatus;
  type: ExplorerBundleType;
  chains: ExplorerChain[];
  src: ExplorerTokens;
  dst: ExplorerTokens;
  counters: ExplorerCounters;
  isAtomic: boolean;
  debridgeApp?: number;
  partnerFeeBps?: number | null;
  lockSrcTokenBalanceUpdate?: boolean;
  referralCode?: string;
  orderIds: string[];
  operatingExpenses: ExplorerOperatingExpense[];
  createdAt: string;
  updatedAt?: string;
};

export type ExplorerBundleListResponse = {
  data: ExplorerBundleListItem[];
  meta: {
    offset: number;
    limit: number;
    total: number;
    hasMore: boolean;
    nextOffset?: number | null;
  };
};

// --- Explorer detail: enums + nested DTOs ---

export enum ExplorerTradeStatus {
  Created = "created",
  PartiallyFulfilled = "partially_fulfilled",
  Fulfilled = "fulfilled",
  Expired = "expired",
  Cancelled = "cancelled",
  Failed = "failed",
}

export enum ExplorerBundleType {
  Unspecified = "Unspecified",
  Market = "Market",
}

export enum ExplorerExecBatchStatus {
  Pending = "Pending",
  Completed = "Completed",
  Cancelled = "Cancelled",
  Expired = "Expired",
}

export enum ExplorerExecBatchTradeStatus {
  Pending = "Pending",
  Completed = "Completed",
  Failed = "Failed",
}

export enum ExplorerBatchFulfillStatus {
  Pending = "Pending",
  Completed = "Completed",
  Reverted = "Reverted",
  Failed = "Failed",
  Expired = "Expired",
  Cancelled = "Cancelled",
}

export enum ExplorerHookPhase {
  PreHook = "PreHook",
  PostHook = "PostHook",
}

export enum ExplorerHookStatus {
  Pending = "Pending",
  Ok = "Ok",
  Reverted = "Reverted",
}

export enum ExplorerPriceKind {
  Executed = "Executed",
  Estimated = "Estimated",
}

export enum ExplorerFailureType {
  NotEnoughBalance = "not_enough_balance",
  IntentExpired = "intent_expired",
  NotProfitable = "not_profitable",
  CompensationHookDoesntCoverExpenses = "compensation_hook_doesnt_cover_expenses",
  NotEnoughAllowance = "not_enough_allowance",
  ExpiredActionsBlockHash = "expired_actions_block_hash",
  NotValidSignatures = "not_valid_signatures",
  InternalError = "internal_error",
}

/** CoalescedOnchainTx — srcTx / dstTx shape. All fields nullable per spec. */
export type CoalescedOnchainTx = {
  transactionHash: string | null;
  blockNumber: string | null;
  blockHash: string | null;
  finalizedAtBlock: string | null;
  blockTimestamp: number | null;
};

export type ExplorerPrice = {
  pair: string;
  quoteIn?: string;
  feeIncluded: boolean;
  value: string;
  kind: ExplorerPriceKind;
};

/** Trade-side wrapper used inside tradeGroups[].trades[]. `usd` is required per spec. */
export type ExplorerTradeToken = {
  token: ExplorerToken;
  usd: string;
};

/** Trade-side wrapper used inside execBatches[].trades[]. `usd` is optional per spec. */
export type ExplorerTradeSide = {
  token: ExplorerToken;
  usd?: string;
};

/**
 * Hook as carried in tradeGroups[].hooks[] and execBatches[].hooks[].
 * `hookId` and `failureType` are NOT in the OpenAPI schema but appear at
 * runtime in live WS/REST payloads, so they are modelled as optional.
 */
export type ExplorerHook = {
  phase: ExplorerHookPhase;
  chainId: number;
  to: string;
  from: string;
  isAtomic: boolean;
  executedSrc?: boolean;
  executedDst?: boolean;
  finalizedSrc?: boolean;
  finalizedDst?: boolean;
  executedBlockSrc?: string | null;
  executedBlockDst?: string | null;
  finalizedBlockSrc?: string | null;
  finalizedBlockDst?: string | null;
  txData?: string;
  value?: string;
  tokenAddress?: string;
  placeholders?: PlaceHolder[];
  txHash?: string | null;
  status?: ExplorerHookStatus;
  // Runtime-observed, not yet in OpenAPI:
  hookId?: string;
  failureType?: ExplorerFailureType | null;
};

export type ExplorerTrade = {
  id: string;
  intentId: string;
  src: ExplorerTradeToken;
  dst: ExplorerTradeToken;
  receiverAddress: string;
  externalCallData?: string | null;
  status: ExplorerTradeStatus;
  orderId?: string | null;
  executedSrc: boolean;
  executedDst: boolean;
  finalizedSrc: boolean;
  finalizedDst: boolean;
  executedBlockSrc?: string | null;
  executedBlockDst?: string | null;
  finalizedBlockSrc?: string | null;
  finalizedBlockDst?: string | null;
  srcTx?: CoalescedOnchainTx | null;
  dstTx?: CoalescedOnchainTx | null;
  price?: ExplorerPrice | null;
};

export type ExplorerIntent = {
  intentId: string;
  chainId?: number;
  intentOwner?: string;
  intentAuthority?: string;
  cancelAuthority?: string;
  externalCallDataHash?: string | null;
};

export type ExplorerTradeGroupSummary = {
  opsCompleted: number;
  opsTotal: number;
  filledPct: number;
};

export type ExplorerTradeGroup = {
  id: string;
  trades: ExplorerTrade[];
  hooks: ExplorerHook[];
  status: ExplorerTradeStatus;
  intents: ExplorerIntent[];
  summary: ExplorerTradeGroupSummary;
};

export type ExplorerIntentExecutionTx = {
  intentId: string | null;
  chainId: number | null;
  txHash: string | null;
  executedAt: string | null;
};

export type ExplorerBatchFulfill = {
  dstChainId: number;
  txHash: string | null;
  status: ExplorerBatchFulfillStatus;
};

export type ExplorerExecBatchStats = {
  opsCompleted: number;
  opsTotal: number;
  filledPct: number;
};

export type ExplorerExecBatchTrade = {
  id: string;
  bundleTradeId: string;
  intentExecutionTx: ExplorerIntentExecutionTx;
  status: ExplorerExecBatchTradeStatus;
  failureType?: ExplorerFailureType | null;
  orderId?: string | null;
  externalCallData?: string | null;
  transactionHash?: string | null;
  src?: ExplorerTradeSide;
  dst?: ExplorerTradeSide;
  srcTx?: CoalescedOnchainTx | null;
  dstTx?: CoalescedOnchainTx | null;
  price?: ExplorerPrice | null;
  executedSrc: boolean;
  executedDst: boolean;
  finalizedSrc: boolean;
  finalizedDst: boolean;
  executedBlockSrc?: string | null;
  executedBlockDst?: string | null;
  finalizedBlockSrc?: string | null;
  finalizedBlockDst?: string | null;
};

export type ExplorerExecBatch = {
  id: string;
  createdAt: string;
  updatedAt: string;
  executedAt: string | null;
  trades: ExplorerExecBatchTrade[];
  hooks: ExplorerHook[];
  batchFulfill: ExplorerBatchFulfill;
  status: ExplorerExecBatchStatus;
  stats: ExplorerExecBatchStats;
  executedSrc: boolean;
  executedDst: boolean;
  finalizedSrc: boolean;
  finalizedDst: boolean;
};

export type ExplorerBundleDetail = ExplorerBundleListItem & {
  summary: {
    tradesCount: number;
    batchesCount: number;
    opsCount: number;
    opsCompleted: number;
    opsfilledPct: number;
    srcUSD: string;
    dstUSD: string;
  };
  tradeGroups: ExplorerTradeGroup[];
  execBatches: ExplorerExecBatch[];
  expirationTimestamp?: number;
  requestId?: string;
  cancelAuthorities?: string[];
};
