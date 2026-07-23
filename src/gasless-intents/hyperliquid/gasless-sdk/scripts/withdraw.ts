import path from 'node:path';
import { config as loadDotenv } from 'dotenv';
import BigNumber from 'bignumber.js';
import { formatUnits, parseUnits, Wallet } from 'ethers';

import { AppConfig, loadConfig } from '../config';
import {
  BalanceReader,
  ChainInfo,
  CoreSourceToken,
  FALLBACK_USDC_ADDRESSES,
  HYPERLIQUID_CORE_CHAIN_ID,
  SourceRpc,
  hyperliquidAddressUrl,
  hyperliquidTxUrl,
  isSolanaChainId,
  resolveCoreSourceToken,
  resolveSolanaTokenAddress,
  resolveSourceChain,
} from '../chains';
import {
  ApiClient,
  AssetData,
  BundleDetails,
  BundleResponse,
  CostsDetail,
  CreateBundleRequest,
  Eip712Domain,
  Eip712TypedData,
  Explorer,
  IntentResponse,
  JsonValue,
  PolymorphicAsset,
  RequiredAction,
  SignedDataItem,
  SubmitBundleRequest,
  SubmitBundleResponse,
  TradeRequest,
  TradeResponse,
  validateSingleTradeIntent,
} from '../api';
import {
  CoreBalance,
  HyperEvmClient,
  ceilEvmAmountToCore,
  coreRawToEvmRaw,
  readCoreSpotBalance,
} from '../hyper';
import {
  BalanceRow,
  DepositReport,
  Deviation,
  FinalDeviation,
  FlowReporter,
  LinkRow,
  ReportHeader,
  Timeline,
  TxRow,
  VerificationRow,
  collectTxs,
  deriveUnitUsdPrice,
  deviation,
  priceQuote,
  toHuman,
} from '../report';
import { isEip712TypedData, signRequiredActions } from '../signing';
import {
  SolanaRpc,
  TradeWalletContext,
  formatWalletSummary,
  resolveTradeWallets,
} from '../solana';
import {
  AMOUNT_PATTERN,
  CommonFlags,
  EXPIRATION_WINDOW_SECONDS,
  HEARTBEAT_MS,
  TOKEN_ADDRESS_PATTERN,
  emptyFlags,
  extractErrorMessage,
  generateRequestId,
  parseCommonFlag,
  requireValue,
  resolveChainRpcUrl,
  runCli,
  sleep,
  validateToken,
} from '../cli';

const TOOL_ROOT: string = path.resolve(__dirname, '..');

export interface WithdrawArgs extends CommonFlags {
  fromChain: string;
  fromChainId: number;
  fromToken: string;
  amount: string;
  toChain: string;
  toChainId: number;
  toToken: string;
}

const USAGE: string =
  'Usage: --from HyperLiquid <token|0xAddress> <amount|max> --to <Chain|chainId> <token|0xAddress> ' +
  '[--dry-run] [--account <0xaddr>] [--recipient <0xaddr|base58>]';

const HYPER_CORE_NAMES: readonly string[] = ['hyperliquid', 'hypercore'];
const HYPER_EVM_NAMES: readonly string[] = ['hyperevm', '999', '100000022'];

function fail(message: string): never {
  throw new Error(`${message}\n${USAGE}`);
}

function parseSourceChain(chainArg: string): number {
  if (!HYPER_CORE_NAMES.includes(chainArg.toLowerCase())) {
    fail(
      `--from ${chainArg} is not a withdraw source: a withdraw always starts on HyperCore ` +
        `(use "HyperLiquid"). To move funds INTO HyperLiquid, use "npm run deposit" instead.`,
    );
  }
  return HYPERLIQUID_CORE_CHAIN_ID;
}

function parseDestinationChain(chainArg: string): ChainInfo {
  const normalized: string = chainArg.toLowerCase();
  if (HYPER_CORE_NAMES.includes(normalized)) {
    fail(
      `--to ${chainArg} is not supported: HyperToHyper (HyperCore to HyperCore) is rejected by ` +
        `the API. Pick an external EVM chain as the withdraw destination.`,
    );
  }
  if (HYPER_EVM_NAMES.includes(normalized)) {
    fail(
      `--to ${chainArg} is not supported: HyperEVM and HyperCore are two layers of one network, ` +
        `and the API would either mis-route this as a deposit or forward a chain id DLN does not ` +
        `use. Pick an external EVM chain as the withdraw destination.`,
    );
  }
  try {
    return resolveSourceChain(chainArg);
  } catch (error: unknown) {
    fail(error instanceof Error ? error.message : String(error));
  }
}

export function parseWithdrawArgs(argv: string[]): WithdrawArgs {
  const flags: CommonFlags = emptyFlags();
  let fromChainId: number | undefined;
  let fromToken: string | undefined;
  let amount: string | undefined;
  let toChain: string | undefined;
  let toChainId: number | undefined;
  let toToken: string | undefined;

  let i: number = 0;
  while (i < argv.length) {
    let consumed: number;
    try {
      consumed = parseCommonFlag(argv, i, flags);
    } catch (error: unknown) {
      fail(error instanceof Error ? error.message : String(error));
    }
    if (consumed > 0) {
      i += consumed;
      continue;
    }

    const flag: string = argv[i];
    switch (flag) {
      case '--from': {
        fromChainId = parseSourceChain(requireValue(argv, i + 1, '--from chain'));
        fromToken = validateToken(requireValue(argv, i + 2, '--from token'));
        amount = requireValue(argv, i + 3, '--from amount');
        i += 4;
        break;
      }
      case '--to': {
        const chain: ChainInfo = parseDestinationChain(requireValue(argv, i + 1, '--to chain'));
        toChain = chain.name;
        toChainId = chain.chainId;
        toToken = validateToken(requireValue(argv, i + 2, '--to token'));
        i += 3;
        break;
      }
      case '--approve': {
        fail(
          '--approve does not apply to a withdraw: HyperCore has no allowance model, so there is ' +
            'nothing to approve. The SendAsset signature IS the authorization to move your spot ' +
            'balance, and it costs no gas.',
        );
        break;
      }
      default: {
        fail(`Unknown argument "${flag}"`);
      }
    }
  }

  if (fromChainId === undefined || fromToken === undefined || amount === undefined) {
    fail('Missing --from HyperLiquid <token> <amount>');
  }
  if (toChain === undefined || toChainId === undefined || toToken === undefined) {
    fail('Missing --to <chain> <token>');
  }
  if (amount !== 'max' && !AMOUNT_PATTERN.test(amount)) {
    fail(`Invalid amount "${amount}" (expected a decimal number or "max")`);
  }

  return {
    ...flags,
    fromChain: 'HyperLiquid',
    fromChainId,
    fromToken,
    amount,
    toChain,
    toChainId,
    toToken,
  };
}

export const SEND_ASSET_PRIMARY_TYPE: string = 'HyperliquidTransaction:SendAsset';
export const SIGNED_INTENT_PRIMARY_TYPE: string = 'SignedIntent';

const HYPEREVM_CHAIN_ID: number = 999;
const CORE_TO_HEVM_COST_TYPE: string = 'HyperLiquid.CoreToHevm';
const ZERO_ADDRESS: string = '0x0000000000000000000000000000000000000000';
const TOKEN_ID_PATTERN: RegExp = /^[A-Za-z0-9]+:0x[0-9a-f]{32}$/;

export interface WithdrawActions {
  sendAsset: Eip712TypedData;
  sendAssetActionId: string;
  signedIntent: Eip712TypedData;
  signedIntentActionId: string;
}

export function extractWithdrawActions(intent: IntentResponse): WithdrawActions {
  const sendAssets: RequiredAction[] = [];
  const signedIntents: RequiredAction[] = [];

  for (const action of intent.requiredActions) {
    if (action.type !== 'Sign712' || !isEip712TypedData(action.data)) {
      continue;
    }
    if (action.data.primaryType === SEND_ASSET_PRIMARY_TYPE) {
      sendAssets.push(action);
    }
    if (action.data.primaryType === SIGNED_INTENT_PRIMARY_TYPE) {
      signedIntents.push(action);
    }
  }

  if (sendAssets.length > 1 || signedIntents.length > 1) {
    throw new Error(
      `Refusing to sign: the bundle carries duplicate HyperLiquid actions ` +
        `(${sendAssets.length} SendAsset, ${signedIntents.length} SignedIntent). Exactly one of ` +
        `each is expected; a duplicate could route funds to an unverified destination.`,
    );
  }

  const sendAsset: Eip712TypedData | undefined =
    sendAssets[0] !== undefined && isEip712TypedData(sendAssets[0].data)
      ? sendAssets[0].data
      : undefined;
  const signedIntent: Eip712TypedData | undefined =
    signedIntents[0] !== undefined && isEip712TypedData(signedIntents[0].data)
      ? signedIntents[0].data
      : undefined;
  const sendAssetActionId: string | undefined = sendAssets[0]?.actionId;
  const signedIntentActionId: string | undefined = signedIntents[0]?.actionId;

  if (
    sendAsset === undefined ||
    sendAssetActionId === undefined ||
    signedIntent === undefined ||
    signedIntentActionId === undefined
  ) {
    throw new Error(
      'The API returned a bundle with no HyperLiquid actions (expected both a ' +
        `${SIGNED_INTENT_PRIMARY_TYPE} and a ${SEND_ASSET_PRIMARY_TYPE} Sign712 action). ` +
        'This usually means srcChainAuthorityAddress was ignored or the source token is not ' +
        'supported by HyperLiquid.',
    );
  }

  return { sendAsset, sendAssetActionId, signedIntent, signedIntentActionId };
}

export interface VerifyInput {
  trade: TradeResponse;
  intent: IntentResponse;
  actions: WithdrawActions;
  derivedEscrow: string;
  sourceToken: CoreSourceToken;
  evmDecimals: number;
  coreDecimals?: number;
  destinationToken: string;
  recipient: string;
  escrowFactory: string;
  isMax: boolean;
  coreBalanceRawEvm?: bigint;
  toleranceBps: number;
  toleranceUsd: number;
  srcUnitUsdPrice?: string;
}

export interface VerifiedWithdraw {
  rows: VerificationRow[];
  coreDebitRawEvm: bigint;
}

function requireStringField(
  message: Record<string, JsonValue>,
  key: string,
  action: string = 'SendAsset',
): string {
  const value: JsonValue | undefined = message[key];
  if (typeof value !== 'string') {
    throw new Error(
      `Refusing to sign: the ${key} field of the ${action} message is missing or not a string ` +
        `(got ${JSON.stringify(value)}).`,
    );
  }
  return value;
}

function requirePresent(value: string | undefined, field: string): string {
  if (value === undefined) {
    throw new Error(
      `Refusing to sign: the response omits ${field}, so it cannot be verified. ` +
        'Nothing was signed and nothing was submitted.',
    );
  }
  return value;
}

function failVerify(field: string, expected: string, actual: string, why: string): never {
  throw new Error(
    `Refusing to sign — ${field} did not verify.\n` +
      `  expected: ${expected}\n` +
      `  actual:   ${actual}\n` +
      `  ${why}\n` +
      'Nothing was signed and nothing was submitted.',
  );
}

function checkEqual(
  rows: VerificationRow[],
  field: string,
  expected: string,
  actual: string,
  why: string,
): void {
  if (expected !== actual) {
    failVerify(field, expected, actual, why);
  }
  rows.push({ field, expected, actual, ok: true });
}

function checkEqualIgnoringCase(
  rows: VerificationRow[],
  field: string,
  expected: string,
  actual: string,
  why: string,
): void {
  if (expected.toLowerCase() !== actual.toLowerCase()) {
    failVerify(field, expected, actual, why);
  }
  rows.push({ field, expected, actual, ok: true });
}

function describeDomain(domain: Eip712Domain): string {
  return `${domain.name}/${domain.version}/${domain.chainId}/${domain.verifyingContract.toLowerCase()}`;
}

export function readGasReserve(costsDetails: CostsDetail[] | undefined): bigint | undefined {
  if (costsDetails === undefined) {
    return undefined;
  }
  const entry: CostsDetail | undefined = costsDetails.find(
    (detail: CostsDetail): boolean => detail.type === CORE_TO_HEVM_COST_TYPE,
  );
  const raw: string | undefined = entry?.payload?.coreToEvmTransferGasCostRawAmount;
  if (raw === undefined || !/^\d+$/.test(raw)) {
    return undefined;
  }
  return BigInt(raw);
}

function toleranceAllowance(input: VerifyInput, payRaw: bigint): bigint {
  const bpsAllowance: bigint = (payRaw * BigInt(input.toleranceBps)) / 10000n;
  if (input.srcUnitUsdPrice === undefined) {
    return bpsAllowance;
  }
  const price: BigNumber = new BigNumber(input.srcUnitUsdPrice);
  if (!price.isFinite() || price.isLessThanOrEqualTo(0)) {
    return bpsAllowance;
  }
  const usdAllowance: bigint = parseUnits(
    new BigNumber(input.toleranceUsd).div(price).toFixed(input.evmDecimals, BigNumber.ROUND_UP),
    input.evmDecimals,
  );
  return usdAllowance > bpsAllowance ? usdAllowance : bpsAllowance;
}

function verifyAmount(input: VerifyInput, rows: VerificationRow[], signed: bigint): void {
  const payRaw: bigint = BigInt(input.trade.srcChainTokenIn.amount);
  const gasReserve: bigint | undefined = readGasReserve(input.trade.costsDetails);
  const human = (raw: bigint): string => formatUnits(raw, input.evmDecimals);

  if (input.isMax) {
    checkEqual(
      rows,
      'SendAsset.amount',
      human(payRaw),
      human(signed),
      'In max mode the signed amount must equal the quoted source amount exactly.',
    );
  } else if (gasReserve !== undefined && input.coreDecimals !== undefined) {
    const upper: bigint = ceilEvmAmountToCore(
      payRaw + gasReserve,
      input.evmDecimals,
      input.coreDecimals,
    );
    if (signed > upper) {
      failVerify(
        'SendAsset.amount',
        `at most ${human(upper)} (quoted source + published Core->EVM gas reserve)`,
        human(signed),
        'The signed amount exceeds the quoted source amount plus the published gas reserve; the ' +
          'API is asking you to move more than you were quoted.',
      );
    }
    rows.push({
      field: 'SendAsset.amount',
      expected: `${human(payRaw)}..${human(upper)}`,
      actual: human(signed),
      ok: true,
    });
  } else {
    const reason: string =
      gasReserve === undefined
        ? 'gas reserve not published in costsDetails'
        : 'Core decimals unknown for this token';
    const allowance: bigint = toleranceAllowance(input, payRaw);
    const ceiling: bigint = payRaw + allowance;
    if (signed > ceiling) {
      failVerify(
        'SendAsset.amount',
        `at most ${human(ceiling)}`,
        human(signed),
        `The exact amount could not be reconstructed (${reason}), so a tolerance bound was ` +
          'applied instead — and the signed amount exceeds it.',
      );
    }
    rows.push({
      field: 'SendAsset.amount',
      expected: `<= ${human(ceiling)}`,
      actual: human(signed),
      ok: true,
      note: `bounded — ${reason}`,
    });
  }

  if (signed < payRaw) {
    failVerify(
      'SendAsset.amount',
      `at least the quoted source amount ${human(payRaw)}`,
      human(signed),
      'A SendAsset below the source amount cannot fund the withdraw and would be rejected later.',
    );
  }

  const budget: string | undefined = input.intent.intent.inputToken?.[0]?.constraintBudget;
  if (budget === undefined) {
    throw new Error('Refusing to sign: the intent carries no inputToken[0].constraintBudget.');
  }
  if (signed < BigInt(budget)) {
    failVerify(
      'SendAsset.amount',
      `at least the signed intent budget ${human(BigInt(budget))}`,
      human(signed),
      'The escrow rejects a SendAsset that does not cover the intent budget.',
    );
  }

  if (input.coreBalanceRawEvm !== undefined && signed > input.coreBalanceRawEvm) {
    failVerify(
      'SendAsset.amount',
      `at most your Core spot balance ${human(input.coreBalanceRawEvm)}`,
      human(signed),
      'The SendAsset would move more than you hold on HyperCore.',
    );
  }
}

export function verifyWithdrawActions(input: VerifyInput): VerifiedWithdraw {
  const rows: VerificationRow[] = [];
  const message: Record<string, JsonValue> = input.actions.sendAsset.message;

  const apiFactory: string = input.actions.signedIntent.domain.verifyingContract;
  if (apiFactory.toLowerCase() !== input.escrowFactory.toLowerCase()) {
    throw new Error(
      `Refusing to sign — HL_ESCROW_FACTORY does not match the API.\n` +
        `  configured: ${input.escrowFactory}\n` +
        `  API uses:   ${apiFactory}\n` +
        `  The escrow address is derived from this factory, so a mismatch means every locally\n` +
        `  derived escrow is wrong. Point HL_ESCROW_FACTORY at the environment you are calling\n` +
        `  (HL_API_BASE_URL) and re-run.\n` +
        'Nothing was signed and nothing was submitted.',
    );
  }

  checkEqualIgnoringCase(
    rows,
    'SendAsset.destination',
    input.derivedEscrow,
    requireStringField(message, 'destination'),
    'The destination must be YOUR escrow, derived on-chain from EscrowManagerFactory.',
  );

  checkEqualIgnoringCase(
    rows,
    'trade.srcChainAuthorityAddress',
    input.derivedEscrow,
    requirePresent(input.trade.srcChainAuthorityAddress, 'trade.srcChainAuthorityAddress'),
    'The trade authority must be the same derived escrow.',
  );

  const signed: bigint = parseUnits(requireStringField(message, 'amount'), input.evmDecimals);
  verifyAmount(input, rows, signed);

  const token: string = requireStringField(message, 'token');
  if (input.sourceToken.tokenId !== undefined) {
    const expectedToken: string = `${input.sourceToken.symbol}:${input.sourceToken.tokenId}`;
    if (expectedToken !== token) {
      failVerify(
        'SendAsset.token',
        expectedToken,
        token,
        'The signed token must be the Core asset you asked to withdraw.',
      );
    }
    rows.push({
      field: 'SendAsset.token',
      expected: expectedToken,
      actual: token,
      ok: true,
      note: input.sourceToken.verified
        ? undefined
        : 'tokenId from API tokenlist — not independently verified',
    });
  } else {
    if (!TOKEN_ID_PATTERN.test(token)) {
      failVerify(
        'SendAsset.token',
        'SYMBOL:0x<32 hex>',
        token,
        'The token identifier is not in HyperCore SYMBOL:tokenId form.',
      );
    }
    rows.push({
      field: 'SendAsset.token',
      expected: 'SYMBOL:0x<32 hex>',
      actual: token,
      ok: true,
      note: 'token outside the verified allowlist — review this value yourself',
    });
  }

  checkEqual(
    rows,
    'SendAsset.hyperliquidChain',
    'Mainnet',
    requireStringField(message, 'hyperliquidChain'),
    'A non-Mainnet action would be signed for the wrong network.',
  );
  checkEqual(
    rows,
    'SendAsset.sourceDex',
    'spot',
    requireStringField(message, 'sourceDex'),
    'The withdraw must move a SPOT balance.',
  );
  checkEqual(
    rows,
    'SendAsset.destinationDex',
    'spot',
    requireStringField(message, 'destinationDex'),
    'The withdraw must land on the escrow SPOT balance.',
  );
  checkEqual(
    rows,
    'SendAsset.fromSubAccount',
    '',
    requireStringField(message, 'fromSubAccount'),
    'A non-empty sub-account would move funds from somewhere other than your main account.',
  );
  checkEqual(
    rows,
    'SendAsset.domain',
    describeDomain({
      name: 'HyperliquidSignTransaction',
      version: '1',
      chainId: HYPEREVM_CHAIN_ID,
      verifyingContract: ZERO_ADDRESS,
    }),
    describeDomain(input.actions.sendAsset.domain),
    'The EIP-712 domain pins which contract/chain the signature is valid for.',
  );
  checkEqual(
    rows,
    'SignedIntent.domain',
    describeDomain({
      name: 'deBridgeEscrow',
      version: '1',
      chainId: HYPEREVM_CHAIN_ID,
      verifyingContract: input.escrowFactory,
    }),
    describeDomain(input.actions.signedIntent.domain),
    'The intent signature must be scoped to the configured EscrowManagerFactory.',
  );
  checkEqual(
    rows,
    'SignedIntent.intentId',
    input.intent.intent.intentId,
    requireStringField(input.actions.signedIntent.message, 'intentId', 'SignedIntent'),
    'Consistency between the two actions of the same bundle.',
  );

  checkEqualIgnoringCase(
    rows,
    'trade.dstChainTokenOutRecipient',
    input.recipient,
    requirePresent(input.trade.dstChainTokenOutRecipient, 'trade.dstChainTokenOutRecipient'),
    'The payout recipient must be the address you asked for — the fill is irreversible.',
  );
  checkEqualIgnoringCase(
    rows,
    'trade.dstChainTokenOut.address',
    input.destinationToken,
    input.trade.dstChainTokenOut.address,
    'The payout token must be the one you asked for.',
  );

  return { rows, coreDebitRawEvm: signed };
}

const HYPERCORE_CHAIN_ID: number = 200000001;
const HYPEREVM_DLN_CHAIN_ID: number = 100000022;
const ACCEPTED_HL_SRC_CHAIN_IDS: readonly number[] = [
  HYPERCORE_CHAIN_ID,
  HYPEREVM_DLN_CHAIN_ID,
  HYPEREVM_CHAIN_ID,
];

export interface WithdrawDeps {
  cfg: AppConfig;
  args: WithdrawArgs;
  api: ApiClient;
  explorer: Explorer;
  evmDstRpc?: SourceRpc;
  solanaDstRpc?: SolanaRpc;
  hyperEvmRpc: SourceRpc;
  hyperEvm: HyperEvmClient;
  account: string;
  recipient: string;
  wallet?: Wallet;
  reporter: FlowReporter;
}

interface ResolvedSource {
  token: CoreSourceToken;
  evmDecimals: number;
  coreDecimals?: number;
  usdPrice?: string;
}

interface ResolvedDestination {
  address: string;
  decimals: number;
}

function resolveCoreSourceFromAssets(
  assets: PolymorphicAsset[],
  tokenArg: string,
  reporter: FlowReporter,
  originalError: unknown,
): CoreSourceToken {
  const upper: string = tokenArg.toUpperCase();
  const data: AssetData | undefined = assets.find(
    (asset: PolymorphicAsset): boolean => (asset.data.symbol ?? '').toUpperCase() === upper,
  )?.data;
  if (data === undefined || data.address === undefined || data.tokenId === undefined) {
    throw originalError;
  }
  reporter.event('source token resolved from the API tokenlist — tokenId NOT independently verified', {
    symbol: data.symbol,
    address: data.address,
    tokenId: data.tokenId,
  });
  return {
    symbol: data.symbol ?? upper,
    address: data.address,
    tokenId: data.tokenId,
    coreDecimals: data.decimals,
    evmDecimals: data.evmDecimals,
    verified: false,
  };
}

async function resolveSource(
  api: ApiClient,
  hyperEvmRpc: SourceRpc,
  tokenArg: string,
  reporter: FlowReporter,
): Promise<ResolvedSource> {
  let assets: PolymorphicAsset[] = [];
  try {
    assets = await api.getAssets(HYPERCORE_CHAIN_ID);
  } catch (error: unknown) {
    reporter.event('HyperCore assets endpoint unavailable — using client constants', {
      message: error instanceof Error ? error.message : String(error),
    });
  }

  let token: CoreSourceToken;
  try {
    token = resolveCoreSourceToken(tokenArg);
  } catch (error: unknown) {
    token = resolveCoreSourceFromAssets(assets, tokenArg, reporter, error);
  }

  const match: PolymorphicAsset | undefined = assets.find(
    (asset: PolymorphicAsset): boolean =>
      asset.data.address?.toLowerCase() === token.address.toLowerCase(),
  );

  const evmDecimals: number | undefined = token.evmDecimals ?? match?.data.evmDecimals;
  const resolvedEvmDecimals: number = evmDecimals ?? (await hyperEvmRpc.decimals(token.address));
  const coreDecimals: number | undefined = token.coreDecimals ?? match?.data.decimals;

  if (!token.verified && token.tokenId === undefined) {
    reporter.event('WARNING: source token is outside the verified allowlist', {
      token: token.address,
      consequence:
        'tokenId and Core-decimal assertions degrade to format checks, and the Core spot ' +
        'balance cannot be read (it is keyed by symbol)',
    });
  }
  if (token.symbol !== 'USDC') {
    reporter.event('WARNING: non-USDC withdraw depends on a live estimator price', {
      symbol: token.symbol,
      consequence:
        'the API can answer 500/503 if it cannot price this asset; USDC is priced unconditionally',
    });
  }

  return {
    token,
    evmDecimals: resolvedEvmDecimals,
    coreDecimals,
    usdPrice: match?.data.usdPrice,
  };
}

async function resolveDestination(
  dstReader: BalanceReader,
  tokenArg: string,
  chainName: string,
  chainId: number,
): Promise<ResolvedDestination> {
  if (isSolanaChainId(chainId)) {
    const solanaAddress: string = resolveSolanaTokenAddress(tokenArg);
    return { address: solanaAddress, decimals: await dstReader.decimals(solanaAddress) };
  }
  let address: string | undefined;
  if (TOKEN_ADDRESS_PATTERN.test(tokenArg)) {
    address = tokenArg;
  } else if (tokenArg.toUpperCase() === 'USDC') {
    address = FALLBACK_USDC_ADDRESSES[chainName];
  }
  if (address === undefined) {
    throw new Error(
      `Cannot resolve destination token "${tokenArg}" on ${chainName}: there is no verified ` +
        `constant for it (only USDC, on ${Object.keys(FALLBACK_USDC_ADDRESSES).join(', ')}). ` +
        `Pass the token as a 0x address instead.`,
    );
  }
  return { address, decimals: await dstReader.decimals(address) };
}

function buildCreateBundleRequest(params: {
  requestId: string;
  srcTokenAddress: string;
  srcAmount: string;
  dstChainId: number;
  dstTokenAddress: string;
  account: string;
  recipient: string;
  referralCode?: number;
}): CreateBundleRequest {
  const trade: TradeRequest = {
    srcChainId: HYPERCORE_CHAIN_ID,
    srcChainTokenIn: params.srcTokenAddress,
    srcChainTokenInAmount: params.srcAmount,
    dstChainId: params.dstChainId,
    dstChainTokenOut: params.dstTokenAddress,
    dstChainTokenOutAmount: 'auto',
    prependOperatingExpenses: true,
    srcChainAuthorityAddress: params.account,
    dstChainTokenOutRecipient: params.recipient,
    dstChainAuthorityAddress: params.recipient,
  };
  return {
    requestId: params.requestId,
    expirationTimestamp: Math.floor(Date.now() / 1000) + EXPIRATION_WINDOW_SECONDS,
    enableAccountAbstraction: false,
    isAtomic: false,
    tradingAlgorithm: 'market',
    referralCode: params.referralCode,
    trades: [trade],
    postHooks: [],
    preHooks: [],
  };
}

export async function runWithdraw(deps: WithdrawDeps): Promise<DepositReport> {
  const {
    cfg,
    args,
    api,
    explorer,
    evmDstRpc,
    solanaDstRpc,
    hyperEvmRpc,
    hyperEvm,
    account,
    recipient,
    wallet,
    reporter,
  } = deps;

  const dstChain: ChainInfo = resolveSourceChain(String(args.toChainId));
  const dstReader: BalanceReader = isSolanaChainId(args.toChainId) ? solanaDstRpc! : evmDstRpc!;
  const referralCode: number | undefined = cfg.referralCode;

  const scannerLinks: LinkRow[] = [
    { label: 'HyperCore account', url: hyperliquidAddressUrl(account) },
    { label: `${args.toChain} recipient`, url: dstChain.addressUrl(recipient) },
  ];

  reporter.param('from', `${args.amount} ${args.fromToken} on HyperCore`);
  reporter.param('to', `${args.toToken} on ${args.toChain}`);
  reporter.param('recipient', recipient);

  const { source, destination } = await reporter.step(
    'Resolve tokens & chains',
    async (): Promise<{ source: ResolvedSource; destination: ResolvedDestination }> => ({
      source: await resolveSource(api, hyperEvmRpc, args.fromToken, reporter),
      destination: await resolveDestination(dstReader, args.toToken, args.toChain, args.toChainId),
    }),
  );

  const isMax: boolean = args.amount === 'max';
  const srcAmount: string = await reporter.step(
    'Resolve amount',
    async (): Promise<string> =>
      isMax ? 'max' : parseUnits(args.amount, source.evmDecimals).toString(),
  );

  const requestId: string = generateRequestId();
  const bundle: BundleResponse = await reporter.step(
    'Create bundle',
    async (): Promise<BundleResponse> => {
      const response: BundleResponse = await api.createBundle(
        buildCreateBundleRequest({
          requestId,
          srcTokenAddress: source.token.address,
          srcAmount,
          dstChainId: args.toChainId,
          dstTokenAddress: destination.address,
          account,
          recipient,
          referralCode,
        }),
      );
      reporter.attach('bundle-response', response, 'json');
      return response;
    },
  );

  const { trade, intent, actions } = await reporter.step(
    'Validate bundle',
    async (): Promise<{
      trade: TradeResponse;
      intent: IntentResponse;
      actions: WithdrawActions;
    }> => {
      const validated: { trade: TradeResponse; intent: IntentResponse } = validateSingleTradeIntent(
        bundle,
        {
          acceptedSrcChainIds: ACCEPTED_HL_SRC_CHAIN_IDS,
          acceptedDstChainIds: [args.toChainId],
          requireRequiredActions: false,
          requireConstraintBudget: false,
        },
      );
      if (validated.trade.dstChainTokenOut.decimals !== destination.decimals) {
        throw new Error(
          `Destination token decimals mismatch: the API says ` +
            `${validated.trade.dstChainTokenOut.decimals}, the token at ${destination.address} on ` +
            `${args.toChain} reports ${destination.decimals}. Refusing to price a withdraw on ` +
            `numbers that disagree.`,
        );
      }
      return { ...validated, actions: extractWithdrawActions(validated.intent) };
    },
  );

  const { coreBefore, dstBefore } = await reporter.step(
    'Snapshot balances',
    async (): Promise<{ coreBefore?: CoreBalance; dstBefore: bigint }> => {
      const dst: bigint = await dstReader.balanceOf(destination.address, recipient);
      let core: CoreBalance | undefined;
      if (source.token.tokenId !== undefined) {
        try {
          core = await readCoreSpotBalance(api, source.token.symbol, account);
        } catch (error: unknown) {
          reporter.event('HyperCore balance unavailable — shown as n/a', {
            symbol: source.token.symbol,
            message: error instanceof Error ? error.message : String(error),
          });
        }
      }
      return { coreBefore: core, dstBefore: dst };
    },
  );

  const payRaw: bigint = BigInt(trade.srcChainTokenIn.amount);
  const opexRaw: bigint =
    trade.prependedOperatingExpenseCost !== undefined
      ? BigInt(trade.prependedOperatingExpenseCost)
      : 0n;
  const guaranteedRaw: bigint = BigInt(trade.dstChainTokenOut.amount);
  const recommendedRaw: bigint = isMax
    ? guaranteedRaw
    : BigInt(trade.dstChainTokenOut.recommendedAmount);

  const payHuman: string = toHuman(payRaw, source.evmDecimals);
  const receiveEstimateHuman: string = toHuman(recommendedRaw, trade.dstChainTokenOut.decimals);
  const srcUsdPrice: string = deriveUnitUsdPrice(
    trade.srcChainTokenIn.approximateUsdValue,
    payHuman,
    source.usdPrice,
  );
  const dstUsdPrice: string = deriveUnitUsdPrice(
    trade.dstChainTokenOut.recommendedApproximateUsdValue ??
      trade.dstChainTokenOut.approximateUsdValue,
    receiveEstimateHuman,
    undefined,
  );

  const { pay, fee, receiveEstimate, receiveGuaranteed } = priceQuote({
    payRaw,
    opexRaw,
    srcDecimals: source.evmDecimals,
    srcUsdPrice,
    srcSymbol: source.token.symbol,
    recommendedRaw,
    guaranteedRaw,
    dstDecimals: trade.dstChainTokenOut.decimals,
    dstUsdPrice,
    dstSymbol: args.toToken,
  });

  const { verified, escrowAddress } = await reporter.step(
    'Verify actions before signing',
    async (): Promise<{ verified: VerifiedWithdraw; escrowAddress: string }> => {
      const derivedEscrow: string = await hyperEvm.deriveEscrowAddress(account);
      reporter.event('escrow derived on-chain from EscrowManagerFactory', {
        owner: account,
        escrow: derivedEscrow,
        factory: cfg.escrowFactory,
      });
      const coreBalanceRawEvm: bigint | undefined =
        coreBefore !== undefined
          ? coreRawToEvmRaw(coreBefore.rawCore, coreBefore.coreDecimals, source.evmDecimals)
          : undefined;
      const result: VerifiedWithdraw = verifyWithdrawActions({
        trade,
        intent,
        actions,
        derivedEscrow,
        sourceToken: source.token,
        evmDecimals: source.evmDecimals,
        coreDecimals: source.coreDecimals,
        destinationToken: destination.address,
        recipient,
        escrowFactory: cfg.escrowFactory,
        isMax,
        coreBalanceRawEvm,
        toleranceBps: cfg.coreDebitToleranceBps,
        toleranceUsd: cfg.coreDebitToleranceUsd,
        srcUnitUsdPrice: srcUsdPrice,
      });
      reporter.attach('verifications', result.rows, 'json');
      return { verified: result, escrowAddress: derivedEscrow };
    },
  );

  const coreDebitHuman: string = toHuman(verified.coreDebitRawEvm, source.evmDecimals);
  const coreBeforeHuman: string =
    coreBefore !== undefined ? toHuman(coreBefore.rawCore, coreBefore.coreDecimals) : 'n/a';
  const dstBeforeHuman: string = toHuman(dstBefore, trade.dstChainTokenOut.decimals);

  const balances: BalanceRow[] = [
    {
      chain: 'HyperCore',
      symbol: source.token.symbol,
      before: coreBeforeHuman,
      expectedAfter:
        coreBefore !== undefined
          ? new BigNumber(coreBeforeHuman).minus(coreDebitHuman).toFixed()
          : 'n/a',
    },
    {
      chain: args.toChain,
      symbol: args.toToken,
      before: dstBeforeHuman,
      expectedAfter: new BigNumber(dstBeforeHuman).plus(receiveGuaranteed.human).toFixed(),
    },
  ];

  const header: ReportHeader = {
    kind: 'Withdraw',
    fromChain: 'HyperCore',
    fromToken: source.token.symbol,
    amount: isMax ? coreDebitHuman : args.amount,
    toChain: args.toChain,
    toToken: args.toToken,
  };

  if (args.dryRun) {
    return {
      header,
      quote: { pay, fee, receiveEstimate, receiveGuaranteed },
      balances,
      reconciliation: [],
      txs: [],
      links: scannerLinks,
      timeline: {},
      finalDeviations: [],
      summaryLine:
        `DRY RUN — built, priced & verified ${coreDebitHuman} ${source.token.symbol} from ` +
        `HyperCore → ${receiveGuaranteed.human} ${args.toToken} on ${args.toChain}; ` +
        `not signed or submitted`,
      dryRun: true,
      verifications: verified.rows,
    };
  }

  reporter.event('signing withdraw', {
    coreDebit: `${coreDebitHuman} ${source.token.symbol} (before ${coreBeforeHuman})`,
    escrow: escrowAddress,
    receive: `~${receiveGuaranteed.human} ${args.toToken} on ${args.toChain}`,
    recipient,
  });

  if (wallet === undefined) {
    throw new Error('Internal error: a real withdraw reached the Sign stage without a wallet.');
  }
  const signer: Wallet = wallet;
  const signedData: SignedDataItem[] = await reporter.step(
    'Sign required actions',
    async (): Promise<SignedDataItem[]> => {
      const signed: SignedDataItem[] = await signRequiredActions(signer, intent.requiredActions);
      const ids: Set<string> = new Set(signed.map((item: SignedDataItem): string => item.actionId));
      if (
        signed.length !== 2 ||
        !ids.has(actions.sendAssetActionId) ||
        !ids.has(actions.signedIntentActionId)
      ) {
        throw new Error(
          `Refusing to submit: expected signatures for exactly the two verified HyperLiquid ` +
            `actions, got ${signed.length} (${[...ids].join(', ')}). Anything else would mean ` +
            `signing something that was never verified.`,
        );
      }
      return signed;
    },
  );

  const bundleId: string = await reporter.step('Submit bundle', async (): Promise<string> => {
    const request: SubmitBundleRequest = {
      enableAccountAbstraction: false,
      isAtomic: false,
      requestId,
      intents: bundle.intents,
      trades: bundle.trades,
      signedData,
      referralCode: bundle.referralCode ?? referralCode,
    };
    const response: SubmitBundleResponse = await api.submitBundle(request);
    const id: string =
      response.bundleId !== undefined && response.bundleId.length > 0
        ? response.bundleId
        : requestId;
    if (id.length === 0) {
      throw new Error('Submit returned an empty bundleId.');
    }
    return id;
  });

  const timeline: Timeline = {};
  const finalDeviations: FinalDeviation[] = [];
  let txs: TxRow[] = [];
  let creditedHuman: string | undefined;
  let creditedDeviation: Deviation | undefined;
  let creditedAt: number | undefined;
  let reachedTerminal: boolean = false;

  const creditGraceMs: number = Math.min(20000, Math.floor(cfg.withdrawPollTimeoutMs / 2));

  await reporter.step('Observe withdraw to terminal status', async (): Promise<void> => {
    const t0: number = Date.now();
    const deadline: number = t0 + cfg.withdrawPollTimeoutMs;
    let lastHeartbeat: number = t0;
    let lastStatus: string | undefined;
    const seenTxs: Set<string> = new Set<string>();

    reporter.event('submitted — observing (a withdraw runs four on-chain steps)', {
      bundleId,
      timeoutS: Math.round(cfg.withdrawPollTimeoutMs / 1000),
    });

    while (Date.now() < deadline) {
      const elapsedS: number = (Date.now() - t0) / 1000;

      const details: BundleDetails | null = await explorer
        .getBundleDetails(bundleId)
        .catch((): null => null);
      if (details !== null) {
        txs = collectTxs(details, {
          srcTxUrl: hyperliquidTxUrl,
          dstTxUrl: (hash: string): string => dstChain.txUrl(hash),
        });
        if (details.status !== lastStatus) {
          lastStatus = details.status;
          reporter.event('bundle status', {
            status: details.status,
            elapsedS: Math.round(elapsedS),
          });
        }
        for (const tx of txs) {
          if (!seenTxs.has(tx.hash)) {
            seenTxs.add(tx.hash);
            reporter.event(`tx (${tx.side})`, { hash: tx.hash, url: tx.url });
          }
        }
        if (details.status === 'fulfilled' && timeline.fulfilledS === undefined) {
          timeline.fulfilledS = elapsedS;
        }
        if (details.status === 'finalized' && timeline.finalizedS === undefined) {
          timeline.finalizedS = elapsedS;
        }
        if (details.status === 'fulfilled' || details.status === 'finalized') {
          reachedTerminal = true;
        }
      }

      if (timeline.srcDebitedS === undefined && coreBefore !== undefined) {
        try {
          const current: CoreBalance = await readCoreSpotBalance(api, source.token.symbol, account);
          if (current.rawCore < coreBefore.rawCore) {
            timeline.srcDebitedS = elapsedS;
            const debitedHuman: string = toHuman(
              coreBefore.rawCore - current.rawCore,
              current.coreDecimals,
            );
            balances[0].actualAfter = toHuman(current.rawCore, current.coreDecimals);
            finalDeviations.push({
              label: 'Core debit vs signed',
              deviation: deviation(coreDebitHuman, debitedHuman, srcUsdPrice),
            });
            reporter.event('HyperCore spot debited', {
              amount: `${debitedHuman} ${source.token.symbol}`,
              afterS: Math.round(elapsedS),
            });
          }
        } catch {
        }
      }

      if (timeline.dstCreditedS === undefined) {
        const current: bigint | undefined = await dstReader
          .balanceOf(destination.address, recipient)
          .catch((error: unknown): undefined => {
            reporter.event('destination balance read failed — retrying', {
              message: error instanceof Error ? error.message : String(error),
            });
            return undefined;
          });
        if (current !== undefined && current > dstBefore) {
          timeline.dstCreditedS = elapsedS;
          creditedAt = Date.now();
          creditedHuman = toHuman(current - dstBefore, trade.dstChainTokenOut.decimals);
          creditedDeviation = deviation(receiveGuaranteed.human, creditedHuman, dstUsdPrice);
          balances[1].actualAfter = toHuman(current, trade.dstChainTokenOut.decimals);
          finalDeviations.push({
            label: 'Credited vs guaranteed',
            deviation: creditedDeviation,
          });
          reporter.event(`destination credited on ${args.toChain}`, {
            amount: `${creditedHuman} ${args.toToken}`,
            afterS: Math.round(elapsedS),
          });
        }
      }

      if (timeline.dstCreditedS !== undefined) {
        if (reachedTerminal) break;
        if (creditedAt !== undefined && Date.now() - creditedAt >= creditGraceMs) break;
      }

      if (Date.now() - lastHeartbeat >= HEARTBEAT_MS) {
        lastHeartbeat = Date.now();
        reporter.event('waiting…', {
          status: lastStatus ?? 'not yet indexed',
          coreDebited: timeline.srcDebitedS !== undefined,
          dstCredited: timeline.dstCreditedS !== undefined,
          elapsedS: Math.round(elapsedS),
          remainingS: Math.round((deadline - Date.now()) / 1000),
        });
      }

      await sleep(cfg.pollIntervalMs);
    }
  });

  const bundleUrl: string = `${cfg.explorerApiUrl}/bundles/${bundleId}`;
  const links: LinkRow[] = [{ label: 'Bundle (explorer API)', url: bundleUrl }, ...scannerLinks];

  const coreDebitObserved: boolean = timeline.srcDebitedS !== undefined;
  const creditObserved: boolean = timeline.dstCreditedS !== undefined;
  const timeoutS: string = (cfg.withdrawPollTimeoutMs / 1000).toFixed(0);

  let summaryLine: string;
  if (creditObserved) {
    const receivedHuman: string = creditedHuman ?? receiveGuaranteed.human;
    const elapsedText: string =
      timeline.dstCreditedS !== undefined ? ` in ${timeline.dstCreditedS.toFixed(1)}s` : '';
    const bpsText: string =
      creditedDeviation !== undefined
        ? ` (${creditedDeviation.bps >= 0 ? '+' : '−'}${Math.abs(creditedDeviation.bps).toFixed(2)} bps vs quote)`
        : '';
    const coreNote: string = coreDebitObserved
      ? ''
      : ' — Core debit not observed (balance unreadable)';
    summaryLine =
      `✓ Withdrew ${coreDebitHuman} ${source.token.symbol} from HyperCore → ${receivedHuman} ` +
      `${args.toToken} on ${args.toChain}${elapsedText}${bpsText}${coreNote}`;
  } else if (coreDebitObserved) {
    summaryLine =
      `✗ Withdraw incomplete after ${timeoutS}s — your HyperCore balance was debited but ` +
      `${args.toChain} has not been credited yet. THE FUNDS ARE NOT LOST: they are in your escrow ` +
      `${escrowAddress} and the keeper is still working. intentId ${intent.intent.intentId}, ` +
      `bundle ${bundleId} (${bundleUrl}); recipient ${recipient} on ${args.toChain}.`;
  } else {
    summaryLine =
      `✗ Withdraw incomplete after ${timeoutS}s — nothing moved: the bundle was submitted but no ` +
      `HyperCore debit and no ${args.toChain} credit were observed. Bundle ${bundleId} ` +
      `(${bundleUrl}).`;
  }

  return {
    header: { ...header, bundleId, bundleUrl },
    quote: { pay, fee, receiveEstimate, receiveGuaranteed },
    balances,
    reconciliation: [],
    txs,
    links,
    timeline,
    finalDeviations,
    summaryLine,
    verifications: verified.rows,
  };
}

async function main(): Promise<number> {
  loadDotenv({ path: path.resolve(__dirname, '../.env') });

  const cfg: AppConfig = loadConfig();
  const args: WithdrawArgs = parseWithdrawArgs(process.argv.slice(2));
  const tradeWallets: TradeWalletContext = resolveTradeWallets(cfg, args);
  const account: string = tradeWallets.evm!.address;
  const wallet: Wallet | undefined = tradeWallets.evm?.wallet;
  const recipient: string = tradeWallets.quote.dstChainTokenOutRecipient;

  const dstChain: ChainInfo = resolveSourceChain(String(args.toChainId));
  const solanaDestination: boolean = isSolanaChainId(args.toChainId);
  const evmDstRpc: SourceRpc | undefined = solanaDestination
    ? undefined
    : new SourceRpc(resolveChainRpcUrl(cfg, dstChain));
  const solanaDstRpc: SolanaRpc | undefined = solanaDestination
    ? new SolanaRpc(cfg.solanaRpcUrl)
    : undefined;

  return runCli({
    flags: args,
    toolRoot: TOOL_ROOT,
    alertBps: cfg.deviationAlertBps,
    flow: (reporter: FlowReporter): Promise<DepositReport> => {
      reporter.event('wallet context', { summary: formatWalletSummary(tradeWallets) });
      return runWithdraw({
        cfg,
        args,
        api: new ApiClient(cfg.apiBaseUrl),
        explorer: new Explorer(cfg.explorerApiUrl),
        evmDstRpc,
        solanaDstRpc,
        hyperEvmRpc: new SourceRpc(cfg.hyperEvmRpcUrl),
        hyperEvm: new HyperEvmClient(cfg.hyperEvmRpcUrl, cfg.escrowFactory),
        account,
        recipient,
        wallet,
        reporter,
      });
    },
  });
}

main()
  .then((code: number): void => {
    process.exitCode = code;
  })
  .catch((error: unknown): void => {
    process.stderr.write(`✗ gasless-sdk withdraw failed: ${extractErrorMessage(error)}\n`);
    process.exitCode = 1;
  });
