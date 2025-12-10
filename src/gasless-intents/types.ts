export type GetBundlesFilterParams = {
  intentOwner?: string;
  intentAuthority?: string;
  userId?: string;
  referralCode?: string;
  orderIds?: Array<string>;
  createdFrom?: string;
  createdTo?: string;
  updatedFrom?: string;
  updatedTo?: string;
  sort?: string;
  page?: number;
  pageSize?: number;
}

export type GetBundleListResponse = PaginatedResponseMetadata & {
  bundles: Array<Bundle>
}

export enum CancelBundleReasonCodes {
  USER_REQUEST = "USER_REQUEST",
  RISK_LIMIT = "RISK_LIMIT",
  SYSTEM_ABORT = "SYSTEM_ABORT"
}

/**
 * `creationTimestamp` and `expirationTimestamp` parameters are used for idempotency purposes - not as time-window filters. 
 */
export type BundleCancelRequest = {
  bundleId?: string,
  userId?: string,
  intentOwners?: string[],
  cancelAuthority: {
    partnerCancelAuthority?: string,
    intentOwner?: string,
    intentAuthority?: string
  },
  creationTimestamp: string,
  expirationTimestamp: string,
  signature?: string,
  reasonCode?: CancelBundleReasonCodes,
}

export type BundleCancelResponse = {
  cancelledBundles: string[];
  idempotencyKey: string;
}

export enum TradingAlgorithm {
  MARKET = "market"
}

/** TODO: Remove support - deprecated in V1.1 */
export type SameChainTrade = {
  chainId: number;
  tokenIn: string;
  tokenInAmount: string;
  tokenInMinAmount: string;
  tokenInMaxAmount: string;
  tokenOut: string;
  tokenOutRecipient: string;
  authorityAddress: string;

  // Flags
  prependOperatingExpenses: boolean;

  // Optional affiliate fee params
  affiliateFeePercent?: number;
  affiliateFeeRecipient?: string;
}

/** TODO: Remove support - deprecated in V1.1 */
export type CrossChainTrade = {
  // Source chain params
  srcChainId: number;
  srcChainTokenIn: string;
  srcChainTokenInAmount: string;
  srcChainTokenInMinAmount: string;
  srcChainTokenInMaxAmount: string;

  // Destination chain params
  dstChainId: number;
  dstChainTokenOut: string;
  dstChainTokenOutAmount: string;
  dstChainTokenOutRecipient: string;

  // Authorities - can patch trades
  srcChainAuthorityAddress: string;
  dstChainAuthorityAddress: string;

  // Flags
  prependOperatingExpenses: boolean;
  ptp?: boolean;

  // Optional affiliate fee params
  affiliateFeePercent?: number;
  affiliateFeeRecipient?: string;
}

export type Trade = {
  // Source chain params
  srcChainId: number;
  srcChainTokenIn: string;
  srcChainTokenInAmount: string;
  srcChainTokenInMinAmount: string;
  srcChainTokenInMaxAmount: string;

  // Destination chain params
  dstChainId: number;
  dstChainTokenOut: string;
  dstChainTokenOutAmount: string;
  dstChainTokenOutRecipient: string;

  // Authorities - can patch trades
  srcChainAuthorityAddress: string;
  dstChainAuthorityAddress: string;
  srcAllowedCancelBeneficiary?: string;

  // Optional affiliate fee params
  affiliateFeePercent?: number;
  affiliateFeeRecipient?: string;

  // Flags
  prependOperatingExpenses: boolean;
  ptp?: boolean;

  // TODO: Define the fields
  allowedTaker?: null;
  dlnHook?: null;
  metadata?: null;
}

export type BundleProposeBody = {

  requestId?: string;
  userId?: string;

  expirationTimestamp: number; // Unix timestamp in seconds
  enableAccountAbstraction: boolean;
  isAtomic: boolean;
  tradingAlgorithm: TradingAlgorithm;
  trades: Array<SameChainTrade | CrossChainTrade>;
  preHooks?: Array<Hook>;
  postHooks: Array<Hook>;
  referralCode?: number;
}

export type BundleProposeBodyV1_1 = {
  // Client-side UUIDs
  requestId?: string;
  userId?: string;

  // Timestamps
  expirationTimestamp: number; // Unix timestamp in seconds

  // Flags
  enableAccountAbstraction: boolean;
  isAtomic: boolean;
  tradingAlgorithm: TradingAlgorithm;
  trades: Array<Trade>;
  preHooks?: Array<any>;
  postHooks: Array<Hook>;
  referralCode?: number;
}

export enum SignatureTypes {
  Sign712 = "Sign712",
  Sign712MetaMask = "Sign712MetaMask",
  Sign7702Authorization = "Sign7702Authorization",
  Sign = "Sign", // Solana Hex Sign - Authorization
  SignTransaction = "SignTransaction", // Solana Versioned Transaction signing
  Transaction = "Transaction" // Could be EVM or Solana - Solana doesn't have `value` and `to` fields.
}

// Type for EIP-712 data
export type EIP712Data = {
  domain: {
    name: string;
    version: string;
    chainId: number;
    verifyingContract: string;
  };
  types: {
    EIP712Domain?: Array<{ name: string; type: string }>;
    [key: string]: Array<{ name: string; type: string }> | undefined;
  };
  primaryType: string;
  message: any;
}

// Type for Sign712MetaMask specific data
export type Sign712MetaMaskData = {
  toSign: EIP712Data;
  calls?: Array<{
    to: string;
    data: string;
    value: string;
  }>;
}

// Type for Sign7702Authorization specific data
export type Sign7702AuthorizationData = {
  contractAddress: string;
  nonce: number;
  chainId?: number;
}

// Combined action data type using discriminated union
export type ActionData =
  | (EIP712Data & { toSign?: never; calls?: never; contractAddress?: never; nonce?: never })
  | (Sign712MetaMaskData & { contractAddress?: never; nonce?: never })
  | (Sign7702AuthorizationData & { domain?: never; types?: never; message?: never; toSign?: never })
  | Tx
  | SolanaSign;

export type Action = {
  type: SignatureTypes;
  actionId: string;
  actions: Array<string>;
  data: ActionData;
}

export type Receiver = {
  address: string;
  destinationChainIds: number[];
}

export type InputToken = {
  address: string;
  minPartialAmount: string;
  maxPartialAmount: string;
  constrainBudget: string;
}

export type TakeToken = {
  fromTokenChainId: number;
  fromTokenAddress: string;
  takeTokenAddress: string;
  takeTokenChainId: number;
  price: string;
}

export type Intent = {
  intentId: string;
  intentChainId: number;
  intentAuthority: string;
  intentOwner: string;
  expirationTimestamp: number;
  intentTimestamp: number;
  intentType: string;
  srcAllowedSender: string[];
  inputTokens: InputToken[];
  takeTokens: TakeToken[];
  receiverDetails: Receiver[];
  dstAuthorityAddress: Receiver[];
}

export type IntentPayload = {
  intent: Intent;
  requiredActions: Array<Action>;
}

export type TokenResult = {
  amount: string, // The output token amount
  approximateUsdValue: number, // The approximate USD value of the output token
  chainId: number, // The chain ID of the output token
  recipientAddress: string, // The recipient address for the output token
  tokenAddress: string // The token address for the output token
}

export type PostHookPayload = {
  requiredActions: Array<Action>;
  hook: {
    chainId: number;
  }
}

export enum TradeStatus {
  processing = "processing",
  failed = "failed",
  cancelled = "cancelled",
  fulfilled = "fulfilled",
  sent = "sent",
}

export enum BundleStatus {
  processing = "processing",
  expired = "expired",
  cancelled = "cancelled",
  created = "created",
}

export type Bundle = {
  intents: Array<IntentPayload>,
  postHooks: Array<PostHookPayload>,
  tokenResult: Array<TokenResult>,
  trades: Array<SameChainTrade | CrossChainTrade | Trade>,
  status?: BundleStatus

  // Flags
  enableAccountAbstraction: boolean,
  isAtomic: boolean,

  // Optional fields
  requestId?: string,
  userId?: string,
  partnerCancelAuthority?: Array<string>,
  referralCode?: number

  // Signatures
  signedData?: Array<{ actionId: string, signedData: string }>;

  // Only when cancelled
  cancel?: CancelBundleData;
}

export type CancelBundleData = {
  preImage: string;
  signature: string;
  authority: string;
  createdAt: string;
  reason?: string;
}

export type PaginatedResponseMetadata = {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export type Hook = {
  isAtomic: boolean;
  data: string;
  to: string;
  value: string;
  chainId: number;
  tokenAddress: string;
  from: string;
  preparePreRequiredActions?: boolean;
}

/**
 * `to` and `value` are only available for EVM transactions.
 */
export type Tx = {
  to?: string;
  value?: string;
  data: string;
}

export type SolanaSign = {
  data: string;
}

export enum ApiVersion {
  V1_0 = "V1_0",
  V1_1 = "V1_1"
}