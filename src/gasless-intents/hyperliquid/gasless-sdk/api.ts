import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';

export type TradingAlgorithm = 'market';

export type EvmActionKind =
  | 'Transaction'
  | 'Sign7702Authorization'
  | 'Sign712'
  | 'Sign712MetaMask'
  | 'EnsureErc20Allowance'
  | 'Permit'
  | 'Permit2612'
  | 'Permit2';

export type SolanaActionKind = 'SignTransaction' | 'Sign';

export type ActionKind = EvmActionKind | SolanaActionKind;

export type EvmActionOperation = 'Delegate' | 'Budget' | 'Intent' | 'Wrap' | 'Hook' | 'EvmWalletTx';

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export interface TradeRequest {
  srcChainId: number;
  srcChainTokenIn: string;
  srcChainTokenInAmount: string;
  dstChainId: number;
  dstChainTokenOut: string;
  dstChainTokenOutAmount: string;
  prependOperatingExpenses: boolean;
  srcChainAuthorityAddress: string;
  dstChainTokenOutRecipient: string;
  dstChainAuthorityAddress: string;
}

export interface CostTokenRef {
  chainId: number;
  tokenAddress: string;
}

export interface CreateBundleRequest {
  requestId: string;
  expirationTimestamp: number;
  enableAccountAbstraction: boolean;
  isAtomic: boolean;
  userId?: string;
  tradingAlgorithm: TradingAlgorithm;
  referralCode?: number;
  trades: TradeRequest[];
  postHooks: never[];
  preHooks: never[];
  costToken?: CostTokenRef;
}

export interface SrcChainTokenIn {
  amount: string;
  approximateUsdValue: number;
  approximateOperatingExpense?: string;
  chainId: number;
  address: string;
}

export interface DstChainTokenOut {
  amount: string;
  recommendedAmount: string;
  approximateUsdValue: number;
  recommendedApproximateUsdValue: number;
  chainId: number;
  address: string;
  decimals: number;
}

export interface CostsDetailPayload {
  coreToEvmTransferGasCostRawAmount?: string;
}

export interface CostsDetail {
  chain: string;
  type: string;
  payload?: CostsDetailPayload;
}

export interface TradeResponse {
  srcChainTokenIn: SrcChainTokenIn;
  dstChainTokenOut: DstChainTokenOut;
  prependedOperatingExpenseCost?: string;
  srcChainAuthorityAddress?: string;
  dstChainTokenOutRecipient?: string;
  costsDetails?: CostsDetail[];
}

export interface Eip712Domain {
  chainId: number;
  name: string;
  version: string;
  verifyingContract: string;
}

export interface Eip712TypeField {
  name: string;
  type: string;
}

export interface Eip712TypedData {
  domain: Eip712Domain;
  types: Record<string, Eip712TypeField[]>;
  primaryType: string;
  message: Record<string, JsonValue>;
}

export interface EvmTransactionData {
  to: string;
  data: string;
  value: string;
}

export interface EnsureErc20AllowanceData {
  chainId: number;
  token: string;
  minAmount: string;
  allowanceHolder: string;
}

export interface SolanaActionData {
  data?: string;
}

export type RequiredActionData =
  | Eip712TypedData
  | EvmTransactionData
  | EnsureErc20AllowanceData
  | SolanaActionData;

export interface RequiredActionDetails {
  transactionCalls?: EvmTransactionData[];
}

export interface RequiredAction {
  actionId: string;
  type: ActionKind;
  actions: string[];
  data: RequiredActionData;
  details?: RequiredActionDetails;
}

export interface IntentInputTokenConstraint {
  constraintBudget: string;
}

export interface IntentConstraints {
  intentId: string;
  inputToken?: IntentInputTokenConstraint[];
}

export interface IntentResponse {
  requiredActions: RequiredAction[];
  intent: IntentConstraints;
}

export interface CostItem {
  chainId: number;
  tokenAddress: string;
  amount: string;
  approximateUsdValue: number;
  type: string;
}

export interface BundleResponse {
  requestId: string;
  referralCode?: number;
  trades: TradeResponse[];
  intents: IntentResponse[];
  bundleCosts?: CostItem[];
}

export interface SignedDataItem {
  actionId: string;
  signedData: string;
}

export interface SubmitBundleRequest {
  enableAccountAbstraction: boolean;
  isAtomic: boolean;
  requestId: string;
  intents: IntentResponse[];
  trades: TradeResponse[];
  signedData: SignedDataItem[];
  referralCode?: number;
  bundleCosts?: CostItem[];
}

export interface SubmitBundleResponse {
  bundleId: string;
}

export interface ChainDto {
  id: number;
  name: string;
  explorerUrl: string;
  logoUrl: string;
  engine: string;
}

export interface AssetData {
  symbol: string;
  name?: string;
  decimals?: number;
  evmDecimals?: number;
  usdPrice?: string;
  balance?: string;
  usdValue?: string;
  address?: string;
  tokenId?: string;
}

export interface PolymorphicAsset {
  type: string;
  data: AssetData;
}

export interface GaslessTradeRequestItem {
  srcChainId: number;
  srcChainTokenIn: string;
  srcChainTokenInAmount: string;
  dstChainId: number;
  dstChainTokenOut: string;
  dstChainTokenOutAmount: string;
  prependOperatingExpenses: boolean;
  srcChainAuthorityAddress: string;
  dstChainTokenOutRecipient: string;
  dstChainAuthorityAddress: string;
}

export interface GaslessCostTokenRef {
  chainId: number;
  tokenAddress: string;
}

export interface GaslessCreateBundleRequest {
  requestId: string;
  enableAccountAbstraction: boolean;
  isAtomic: boolean;
  userId: string;
  tradingAlgorithm: TradingAlgorithm;
  referralCode?: number;
  approvalMode?: 'permit';
  approveAmountFlag?: 'unlimited';
  trades: GaslessTradeRequestItem[];
  postHooks: never[];
  preHooks: never[];
  costToken: GaslessCostTokenRef;
}

export interface GaslessDstChainTokenOut {
  amount: string;
  recommendedAmount?: string;
  approximateUsdValue: number;
  recommendedApproximateUsdValue?: number;
  chainId: number;
  address: string;
  decimals: number;
}

export interface GaslessTradeResponse {
  srcChainTokenIn: SrcChainTokenIn;
  dstChainTokenOut: GaslessDstChainTokenOut;
  prependedOperatingExpenseCost?: string;
}

export interface GaslessBundleResponse {
  requestId: string;
  referralCode?: number;
  trades: GaslessTradeResponse[];
  intents: IntentResponse[];
  bundleCosts?: CostItem[];
}

export interface GaslessSubmitBundleRequest {
  enableAccountAbstraction: boolean;
  isAtomic: boolean;
  requestId: string;
  userId: string;
  intents: IntentResponse[];
  trades: GaslessTradeResponse[];
  signedData: SignedDataItem[];
  bundleCosts?: CostItem[];
  deBridgeApp: 'DESWAP';
  referralCode?: number;
}

export interface GaslessSubmitBundleResponse {
  bundleId?: string;
}

function extractErrorCode(err: unknown): string | undefined {
  if (typeof err === 'object' && err !== null && 'code' in err) {
    const code: unknown = err.code;
    return typeof code === 'string' && code.length > 0 ? code : undefined;
  }
  return undefined;
}

export class ApiClient {
  private readonly baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private config(params?: Record<string, string>): AxiosRequestConfig {
    const base: AxiosRequestConfig = {
      baseURL: this.baseUrl,
      headers: { accept: 'application/json' },
      validateStatus: (): boolean => true,
    };
    return params !== undefined ? { ...base, params } : base;
  }

  private unwrap<T>(res: AxiosResponse<T>, context: string): T {
    if (res.status === 200 || res.status === 201) {
      return res.data;
    }
    const body: string = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
    throw new Error(`${context} failed with status ${res.status}: ${body}`);
  }

  private networkError(method: string, path: string, err: unknown): Error {
    const url: string = `${this.baseUrl}${path}`;
    const code: string | undefined = extractErrorCode(err);
    const codePart: string = code !== undefined ? ` [${code}]` : '';
    const rawMessage: string = err instanceof Error ? err.message : String(err);
    const messagePart: string = rawMessage.length > 0 ? `: ${rawMessage}` : '';
    return new Error(
      `${method} ${url}${codePart} failed (no response — check HL_API_BASE_URL / connectivity)${messagePart}`,
    );
  }

  private async send<T>(
    method: string,
    path: string,
    exec: () => Promise<AxiosResponse<T>>,
  ): Promise<T> {
    let res: AxiosResponse<T>;
    try {
      res = await exec();
    } catch (err: unknown) {
      throw this.networkError(method, path, err);
    }
    return this.unwrap(res, `${method} ${path}`);
  }

  async createBundle(req: CreateBundleRequest): Promise<BundleResponse> {
    return this.send(
      'POST',
      '/api/bundles',
      (): Promise<AxiosResponse<BundleResponse>> =>
        axios.post<BundleResponse>('/api/bundles', req, this.config()),
    );
  }

  async submitBundle(req: SubmitBundleRequest): Promise<SubmitBundleResponse> {
    return this.send(
      'POST',
      '/api/bundles/submit',
      (): Promise<AxiosResponse<SubmitBundleResponse>> =>
        axios.post<SubmitBundleResponse>('/api/bundles/submit', req, this.config()),
    );
  }

  async getChains(): Promise<ChainDto[]> {
    return this.send(
      'GET',
      '/api/chains',
      (): Promise<AxiosResponse<ChainDto[]>> => axios.get<ChainDto[]>('/api/chains', this.config()),
    );
  }

  async getAssets(chainId: number, holder?: string): Promise<PolymorphicAsset[]> {
    const path = `/api/chains/${chainId}/assets`;
    const params: Record<string, string> | undefined =
      holder !== undefined ? { holder } : undefined;
    return this.send(
      'GET',
      path,
      (): Promise<AxiosResponse<PolymorphicAsset[]>> =>
        axios.get<PolymorphicAsset[]>(path, this.config(params)),
    );
  }
}

export class GaslessApiClient {
  private readonly quoteUrl: string;
  private readonly submitUrl: string;
  private readonly refreshSolanaTxUrl: string;

  constructor(quoteUrl: string, submitUrl?: string, refreshSolanaTxUrl?: string) {
    this.quoteUrl = quoteUrl;
    this.submitUrl = submitUrl ?? `${quoteUrl}/submit`;
    this.refreshSolanaTxUrl =
      refreshSolanaTxUrl ?? `${quoteUrl.replace(/\/$/, '')}/refresh-solana-tx`;
  }

  private config(): AxiosRequestConfig {
    return {
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      validateStatus: (): boolean => true,
    };
  }

  private unwrap<T>(res: AxiosResponse<T>, context: string): T {
    if (res.status === 200 || res.status === 201) {
      return res.data;
    }
    const body: string = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
    throw new Error(`${context} failed with status ${res.status}: ${body}`);
  }

  private networkError(method: string, url: string, err: unknown): Error {
    const code: string | undefined = extractErrorCode(err);
    const codePart: string = code !== undefined ? ` [${code}]` : '';
    const rawMessage: string = err instanceof Error ? err.message : String(err);
    const messagePart: string = rawMessage.length > 0 ? `: ${rawMessage}` : '';
    return new Error(
      `${method} ${url}${codePart} failed (no response — check GASLESS_API_URL / connectivity)${messagePart}`,
    );
  }

  private async send<T>(
    method: string,
    url: string,
    exec: () => Promise<AxiosResponse<T>>,
  ): Promise<T> {
    let res: AxiosResponse<T>;
    try {
      res = await exec();
    } catch (err: unknown) {
      throw this.networkError(method, url, err);
    }
    return this.unwrap(res, `${method} ${url}`);
  }

  async createBundle(req: GaslessCreateBundleRequest): Promise<GaslessBundleResponse> {
    return this.send(
      'POST',
      this.quoteUrl,
      (): Promise<AxiosResponse<GaslessBundleResponse>> =>
        axios.post<GaslessBundleResponse>(this.quoteUrl, req, this.config()),
    );
  }

  async submitBundle(req: GaslessSubmitBundleRequest): Promise<GaslessSubmitBundleResponse> {
    return this.send(
      'POST',
      this.submitUrl,
      (): Promise<AxiosResponse<GaslessSubmitBundleResponse>> =>
        axios.post<GaslessSubmitBundleResponse>(this.submitUrl, req, this.config()),
    );
  }

  async refreshSolanaTransaction(serializedHex: string): Promise<string> {
    interface RefreshResponse {
      transaction?: string;
      errorMessage?: string;
    }
    const res = await this.send(
      'POST',
      this.refreshSolanaTxUrl,
      (): Promise<AxiosResponse<RefreshResponse>> =>
        axios.post<RefreshResponse>(
          this.refreshSolanaTxUrl,
          { transaction: serializedHex },
          this.config(),
        ),
    );
    if (res.transaction === undefined || res.transaction.length === 0) {
      throw new Error(
        `refreshSolanaTransaction returned no transaction: ${res.errorMessage ?? 'unknown error'}`,
      );
    }
    return res.transaction;
  }
}

export interface BundleTrade {
  id: string;
  intentId: string;
  status: string;
  orderId: string;
  srcTx?: { transactionHash: string };
  dstTx?: { transactionHash: string };
}

export interface BundleSideToken {
  chainId: number;
  address: string;
  amount: string;
  symbol: string;
  decimals: number;
  usd: string;
}

export interface BundleSide {
  tokens: BundleSideToken[];
  usdAmount: string;
}

export interface BundleDetails {
  id: string;
  status: string;
  type: string;
  orderIds: string[];
  createdAt: string;
  updatedAt: string;
  src?: BundleSide;
  dst?: BundleSide;
  tradeGroups: { trades: BundleTrade[] }[];
}

interface BundleSearchResponse {
  data?: Array<{ id?: string }>;
}

export class Explorer {
  private readonly baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  async findBundleIdByIntentId(intentId: string): Promise<string | null> {
    try {
      const res = await axios.get<BundleSearchResponse>(`${this.baseUrl}/bundles`, {
        params: { q: intentId, limit: 1, page: 1 },
        headers: { accept: 'application/json' },
      });
      const data = res.data?.data;
      if (!Array.isArray(data) || data.length === 0) {
        return null;
      }
      return data[0].id ?? null;
    } catch {
      return null;
    }
  }

  async getBundleDetails(bundleId: string): Promise<BundleDetails | null> {
    try {
      const res = await axios.get<BundleDetails>(`${this.baseUrl}/bundles/${bundleId}`, {
        headers: { accept: 'application/json' },
      });
      if (!res.data?.id) {
        return null;
      }
      return res.data;
    } catch {
      return null;
    }
  }
}

interface TradeLike {
  srcChainTokenIn: { chainId: number };
  dstChainTokenOut: { chainId: number };
}

export interface BundleShapeOptions {
  acceptedSrcChainIds: readonly number[];
  acceptedDstChainIds: readonly number[];
  requireRequiredActions: boolean;
  requireConstraintBudget: boolean;
}

function chainIdMismatch(side: 'src' | 'dst', accepted: readonly number[], actual: number): string {
  const detail: string =
    accepted.length === 1
      ? `requested ${accepted[0]}, got ${actual}.`
      : `expected one of ${accepted.join(', ')} (HyperLiquid family), got ${actual}.`;
  return `Bundle ${side} chainId mismatch: ${detail}`;
}

export function validateSingleTradeIntent<T extends TradeLike>(
  bundle: { trades: T[]; intents: IntentResponse[] },
  options: BundleShapeOptions,
): { trade: T; intent: IntentResponse } {
  if (bundle.trades.length !== 1) {
    throw new Error(`Expected exactly one trade in the bundle, got ${bundle.trades.length}.`);
  }
  if (bundle.intents.length !== 1) {
    throw new Error(`Expected exactly one intent in the bundle, got ${bundle.intents.length}.`);
  }
  const trade: T = bundle.trades[0];
  const intent: IntentResponse = bundle.intents[0];

  if (options.requireRequiredActions && intent.requiredActions.length === 0) {
    throw new Error('Bundle intent carries no requiredActions.');
  }
  if (options.requireConstraintBudget) {
    const budget: string | undefined = intent.intent.inputToken?.[0]?.constraintBudget;
    if (budget === undefined) {
      throw new Error('Bundle intent is missing inputToken[0].constraintBudget.');
    }
  }
  if (!options.acceptedSrcChainIds.includes(trade.srcChainTokenIn.chainId)) {
    throw new Error(
      chainIdMismatch('src', options.acceptedSrcChainIds, trade.srcChainTokenIn.chainId),
    );
  }
  if (!options.acceptedDstChainIds.includes(trade.dstChainTokenOut.chainId)) {
    throw new Error(
      chainIdMismatch('dst', options.acceptedDstChainIds, trade.dstChainTokenOut.chainId),
    );
  }
  return { trade, intent };
}
