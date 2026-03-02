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

export type Trade = {
  // Source chain params
  srcChainId: number;
  srcChainTokenIn: string;
  srcChainTokenInAmount: string;
  srcChainTokenInMinAmount?: string;
  srcChainTokenInMaxAmount?: string;

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

export type BundleBase = {
  // Client-side UUIDs
  requestId?: string; // Client-side UUID for idempotency, enforced on /submit endpoint
  userId?: string; // Client side user ID, enforced on /submit endpoint

  // Flags
  enableAccountAbstraction: boolean;
  isAtomic: boolean;

  trades: Array<Trade>;
  referralCode?: number;
}

export type BundleProposeBody = BundleBase & {
  expirationTimestamp: number; // Unix timestamp in seconds
  tradingAlgorithm: TradingAlgorithm;
  preHooks?: Array<ExtendedHook | SimpleHook>;
  postHooks?: Array<ExtendedHook | SimpleHook>;
}

export type SubmitBundleResponse = {
  bundleId: string; 
  message?: string; // Optional message field for additional info (e.g. if a duplicate bundle is detected based on requestId)
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

// Type for Sign7702Authorization specific data
export type Sign7702AuthorizationData = {
  contractAddress: `0x${string}`;
  nonce: number;
  chainId?: number;
}

// Combined action data type using discriminated union
export type ActionData =
  | (EIP712Data & { toSign?: never; calls?: never; contractAddress?: never; nonce?: never })
  | (Sign7702AuthorizationData & { domain?: never; types?: never; message?: never; toSign?: never })
  | Tx
  | SolanaSign;

export type Action = {
  type: SignatureTypes;
  actionId: string;
  actions: Array<ActionType>;
  data: ActionData;
  description: string;
  actionCosts: Array<ActionCostItem>;
  details?: ActionDetails;
}

export enum ActionType {
  // Shared
  Budget = "Budget",
  Intent = "Intent",
  Wrap = "Wrap", 
  
  // EVM only
  Delegate = "Delegate",
  Hook = "Hook",

  // Solana Only
  Compensation = "Compensation",
  Operation = "Operation",
}

export type ActionCostItem = {
  chainId: number;
  tokenAddress: string;
  amount: string;
  approximateUsdValue: number;
  type: ActionCostItemType;
  networkDetails?: NetworkDetails // EVM-chains only
}

export enum ActionCostItemType {
  PROTOCOL_COST = "PROTOCOL_COST", 
  SOLVER_COST = "SOLVER_COST", 
  PARTNER_COST = "PARTNER_COST", 
  SOLVER_EXECUTION_COST = "SOLVER_EXECUTION_COST"
}

export type NetworkDetails = {
  gasLimit: string;
  gasPrice: string;
  baseFee: string;
  maxFeePerGas: string;
  maxPriorityFeePerGas: string;
}

export type ActionDetails = {
  transactionCalls: Array<Tx>
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

export type HookPayload = {
  requiredActions: Array<Action>;
  hook: {
    chainId: number;
    placeHolders?: PlaceHolder[];
    gasCompensationInfo?: GasCompensationInfo;
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

export type Bundle = BundleBase & {
  intents: Array<IntentPayload>,
  postHooks: Array<HookPayload>,
  preHooks: Array<HookPayload>,
  tokenResult: Array<TokenResult>,
  status?: BundleStatus,
  partnerCancelAuthority?: Array<string>,

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
  additionalAmount?: string; // Optional field for ERC-20 post-hooks that need to reserve extra tokens for the post-hook action
}

export type PlaceHolder = {
  nameVariable: string;      // e.g. "amount1" — matches {amount1} in data
  tokenAddress: string;      // token used for cumulative amount lookup
  address: string;           // user address for grouping key
  additionalAmount?: string; // optional offset added to cumulative amount
};

export type GasCompensationInfo = {
  tokenAddress: string;
  chainId: number;
  sender: string;
};

export type ExtendedHook = {
  isAtomic: boolean;
  data: string;              // hex calldata with {amount1}, {amount2}, etc.
  to: string;
  value: string;             // wei string; can be "{amountN}" for native transfers
  chainId: number;
  from: string;
  placeHolders: PlaceHolder[]; // Array required, can be empty
  gasCompensationInfo?: GasCompensationInfo;
};

export type SimpleHook = Hook;  // Alias for semantic clarity alongside ExtendedHook

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
