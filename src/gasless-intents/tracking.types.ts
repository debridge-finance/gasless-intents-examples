// Tracking types for partner tracking endpoints.
//
// The `Bundle`, `TradeResult`, `TradeTokenIn`, `TradeTokenOut`, `IntentPayload`, and `Action` types in `./types.ts`
// describe the PROPOSE / SUBMIT response shape (`POST /v1.1/gasless/bundles`, `POST /v1.1/gasless/bundles/submit`).
// The tracking endpoints (`GET /v1/gasless/bundles`, `GET /v1/gasless/bundles/{bundleId}`) return a substantially
// different shape: different field names (`tokenIn` vs `srcChainTokenIn`), different nested fields, different
// top-level fields.

import type { Intent, BundleStatus, TradingAlgorithm, PlaceHolder } from "./types";

export type TradeTokenInTracking = {
  chainId: number;
  address: string;
  amount: string;        // native smallest units — source of truth
  isWrapped: boolean;    // e.g. WMATIC → true, USDC → false
  decimals: number;
  iconUrl: string;
  symbol: string;
  usd: string;           // execution-time USD approximation
};

export type TradeTokenOutTracking = {
  chainId: number;
  address: string;
  amount: string;        // native smallest units — source of truth
  minAmount: string;     // slippage floor for this output
  decimals: number;
  iconUrl: string;
  symbol: string;
  usd: string;           // execution-time USD approximation
};

export type SubtradeTracking = {
  id: string;
  status: string;
  tokenInAmount: string;        // partial-fill input, native smallest units
  tokenOutAmount: string;       // partial-fill output, native smallest units
  tokenOutMinAmount: string;
  orderId?: string;             // populated once the subtrade is posted on-chain
  transactionHash?: string;     // src-chain fulfillment tx hash; populated on fulfillment
  createdAt: string;
};

export type TradeResultTracking = {
  id: string;
  tradeId: string;
  intentId: string;
  receiverAddress: string;
  srcAuthorityAddress: string;
  dstAuthorityAddress: string;
  externalCall: unknown | null;
  externalCallData: string | null;
  status: string;
  executedSrc: boolean;
  executedDst: boolean;
  finalizedSrc: boolean;
  finalizedDst: boolean;
  executedBlockSrc: string | null;
  executedBlockDst: string | null;
  finalizedBlockSrc: string | null;
  finalizedBlockDst: string | null;
  fulfilledTransactionHash: string | null;
  tokenIn: TradeTokenInTracking;
  tokenOut: TradeTokenOutTracking;
  subtrades: SubtradeTracking[];
};

/**
 * Flat data container for a required action on tracking responses. Only one of the five fields is populated at a time,
 * determined by the action's numeric `type`. Declared separately from `ActionData` because the tracking wire shape
 * differs from the propose-time `ActionData` discriminated union.
 */
export type ActionDataTracking = {
  eip712Data: unknown | null;
  delegateData: unknown | null;
  userOp: unknown | null;
  txCall: unknown | null;
  solanaCall: unknown | null;
};

export type RequiredActionTracking = {
  actionId: string;
  actions: number[];              // numeric action-type codes (see ActionType values, numeric encoding differs)
  data: ActionDataTracking;
  delegationId: string | null;
  // TODO(types): replace `unknown` with `GasPaymentTracking | null` once the server actually populates this
  // field. All 598 captured required-action observations (including user-initiated cancellation and hook flows)
  // have `gasPayment === null`; the `GasPaymentTracking` shape below is spec-only (openapi
  // `gasless-api_GasPaymentDto`) and unverified against runtime.
  gasPayment: unknown | null;
  signedData: string;             // hex signature
  status: string | null;          // non-null ('fulfilled', etc.) after execution; null pre-fulfillment
  type: number;                   // numeric type (e.g. 3, 2) — differs from the declared SignatureTypes string enum
  transactionHash: string | null; // hash of fulfillment tx; null pre-fulfillment (key always present)
  updatedAt?: string;             // only emitted after the action is fulfilled on-chain
};

export type IntentPayloadTracking = {
  intentId: string;
  intent: Omit<Intent, "intentId">;   // tracking wire's intent object omits intentId (it lives on the parent IntentPayloadTracking)
  requiredActions: RequiredActionTracking[];
  externalCallDataHash: string | null;
  // Populated after the intent executes on its source chain; absent while the intent is still in `created`.
  executedAt?: string;
  executionTxChainId?: number;
  executionTxHash?: string;
};

/**
 * Tracking-shape type for a `Bundle` as returned by partner tracking endpoints
 * (`GET /v1/gasless/bundles`, `GET /v1/gasless/bundles/{bundleId}`).
 *
 * Differs from the propose/submit-time `Bundle` type in `./types.ts` in several structural ways (field renames,
 * different nested types, no `bundleCosts` / `trades[].costsDetails` / action-level cost data). See
 * `tracking/explorer-api.mdx` for the full diff.
 */
export type BundleTracking = {
  bundleId: string;
  referralCode: string;
  status: BundleStatus;
  isAtomic: boolean;
  tradingAlgorithm: TradingAlgorithm;
  trades: Array<TradeResultTracking>;
  intents: Array<IntentPayloadTracking>;
  preHooks: Array<HookPayloadTracking>;
  postHooks: Array<HookPayloadTracking>;
  partnerCancelAuthority: string[]; // empty array when none configured
  userId: string | null;            // key always present; value is null when no client-supplied userId
  cancel?: CancelBundleTracking;    // only when the bundle is cancelled
  executedSrc: boolean;
  executedDst: boolean;
  finalizedSrc: boolean;
  finalizedDst: boolean;
  lockSrcTokenBalanceUpdate: boolean;
  expirationTimestamp: number;
  createdAt: string;
  updatedAt: string;
};

/**
 * Hook payload on the tracking wire. Verified against a real bundle with populated hooks
 * (`0x8333cb2b...` — 1 preHook, 2 postHooks, all arbitrum delegation calls). Distinct from the propose-time
 * `HookPayload` / `ExtendedHook` shapes in `./types.ts`: tracking emits lowercase `placeholders` (vs
 * propose-time `placeHolders`), block-number fields are always-present-with-null, and the runtime omits openapi
 * fields while adding `placeholders`.
 */
export type HookPayloadTracking = {
  isAtomic: boolean;
  data: string;
  to: string;
  value: string;              // wei string, e.g. "0" when no native transfer
  chainId: number;
  tokenAddress: string;
  from: string;
  requiredActions: RequiredActionTracking[];
  placeholders: PlaceHolder[];  // lowercase on wire (propose-time uses `placeHolders`); can be empty
  executedSrc: boolean;
  executedDst: boolean;
  finalizedSrc: boolean;
  finalizedDst: boolean;
  executedBlockSrc: string | null;   // always-present with null pre-execution
  executedBlockDst: string | null;
  finalizedBlockSrc: string | null;
  finalizedBlockDst: string | null;
};

/**
 * Bundle cancellation data on the tracking wire. Verified against a real user-cancelled bundle
 * (`0x0e62c1d5...`): runtime emits only `authority`, `createdAt`, `reason` — openapi DTO
 * `gasless-api_BundleCancelDto` also lists `preImage` / `signature`, but those describe the cancel-submission
 * input, not the tracking-response output. `reason` values observed: `"USER_REQUEST"` (see
 * `CancelBundleReasonCodes` enum in `./types.ts`).
 */
export type CancelBundleTracking = {
  authority: string;
  createdAt: string;
  reason?: string;
};

/**
 * Gas-payment describing how a required action's gas was funded. Derived from openapi `gasless-api_GasPaymentDto`.
 * Populated on `user_token` / `spread` flows; `null` on `sponsor` (and across our captured corpus — never populated).
 */
export type GasPaymentBasicDetailsTracking = {
  nativeTokenAmount: string;
  approximateUsdEquivalent: string;
};

export type TakenUserTokensTracking = {
  tokenAddress: string;
  tokenAmount: string;
};

export type GasPaymentTracking = {
  type?: "sponsor" | "user_token" | "spread";
  basicDetails?: GasPaymentBasicDetailsTracking;
  takenUserTokens?: TakenUserTokensTracking[];
};
