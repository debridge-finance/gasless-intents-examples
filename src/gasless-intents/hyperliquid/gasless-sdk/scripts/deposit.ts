import path from 'node:path';
import { config as loadDotenv } from 'dotenv';
import { parseUnits, Wallet } from 'ethers';
import BigNumber from 'bignumber.js';

import { AppConfig, loadConfig } from '../config';
import {
  BalanceReader,
  ChainInfo,
  FALLBACK_HYPERCORE_TOKENS,
  FALLBACK_SOLANA_DECIMALS,
  FALLBACK_USDC_ADDRESSES,
  HYPERLIQUID_CORE_CHAIN_ID,
  HyperCoreTokenConstant,
  SourceRpc,
  hyperliquidAddressUrl,
  hyperliquidTxUrl,
  isHyperLiquidChainId,
  isSolanaChainId,
  resolveSolanaTokenAddress,
  resolveSourceChain,
  shouldUsePermitQuoteMode,
} from '../chains';
import {
  ApiClient,
  AssetData,
  BundleDetails,
  BundleResponse,
  BundleSide,
  BundleSideToken,
  CreateBundleRequest,
  DstChainTokenOut,
  Explorer,
  GaslessApiClient,
  GaslessBundleResponse,
  GaslessCreateBundleRequest,
  GaslessSubmitBundleRequest,
  GaslessSubmitBundleResponse,
  GaslessTradeRequestItem,
  GaslessTradeResponse,
  IntentResponse,
  PolymorphicAsset,
  SignedDataItem,
  SrcChainTokenIn,
  SubmitBundleRequest,
  SubmitBundleResponse,
  TradeRequest,
  TradeResponse,
  validateSingleTradeIntent,
} from '../api';
import {
  AllowanceCheck,
  AllowanceRequirement,
  checkAllowance,
  extractAllowanceRequirement,
  hasPermitAction,
  signRequiredActions,
} from '../signing';
import { CoreBalance, floorEvmAmountToCore, readCoreSpotBalance } from '../hyper';
import {
  ApprovalSummary,
  BalanceRow,
  DepositReport,
  Deviation,
  FinalDeviation,
  FlowReporter,
  LinkRow,
  MaxDetail,
  ReconRow,
  ReportHeader,
  Timeline,
  TxRow,
  collectTxs,
  deriveUnitUsdPrice,
  deviation,
  priceQuote,
  toHuman,
} from '../report';
import {
  AMOUNT_PATTERN,
  CommonFlags,
  EXPIRATION_WINDOW_SECONDS,
  HEARTBEAT_MS,
  TOKEN_ADDRESS_PATTERN,
  emptyFlags,
  generateRequestId,
  parseCommonFlag,
  requireValue,
  resolveChainRpcUrl,
  runCli,
  sleep,
  validateToken,
} from '../cli';
import {
  QuoteAddresses,
  SolanaRpc,
  TradeWalletContext,
  formatWalletSummary,
  resolveTradeWallets,
  signSolanaRequiredActions,
} from '../solana';

const TOOL_ROOT: string = path.resolve(__dirname, '..');

export interface DepositArgs extends CommonFlags {
  fromChain: string;
  fromChainId: number;
  fromToken: string;
  amount: string;
  toChain: string;
  toChainId: number;
  toToken: string;
  approve: boolean;
}

const USAGE: string =
  'Usage: --from <Chain|chainId> <token|0xAddress> <amount|max> ' +
  '--to <HyperLiquid|Chain|chainId> <token|0xAddress> ' +
  '[--dry-run] [--approve] [--account <0xaddr>] [--recipient <0xaddr|base58>]';

function fail(message: string): never {
  throw new Error(`${message}\n${USAGE}`);
}

function rejectHyperEvmDestination(chainArg: string): never {
  return fail(
    `--to ${chainArg} is not supported: HyperEVM and HyperCore are two layers of one network. ` +
      `Use "HyperLiquid" to deposit into the HyperCore spot balance; a real HyperEVM ERC-20 ` +
      `destination is a plain EVM route this tool does not model yet.`,
  );
}

export function parseArgs(argv: string[]): DepositArgs {
  const flags: CommonFlags = emptyFlags();
  let fromChain: string | undefined;
  let fromChainId: number | undefined;
  let fromToken: string | undefined;
  let amount: string | undefined;
  let toChain: string | undefined;
  let toChainId: number | undefined;
  let toToken: string | undefined;
  let approve: boolean = false;

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
        const chainArg: string = requireValue(argv, i + 1, '--from chain');
        const chain: ChainInfo = resolveSourceChain(chainArg);
        fromChain = chain.name;
        fromChainId = chain.chainId;
        fromToken = validateToken(requireValue(argv, i + 2, '--from token'));
        amount = requireValue(argv, i + 3, '--from amount');
        i += 4;
        break;
      }
      case '--to': {
        const chainArg: string = requireValue(argv, i + 1, '--to chain');
        const tokenArg: string = validateToken(requireValue(argv, i + 2, '--to token'));
        const normalized: string = chainArg.toLowerCase();
        if (normalized === 'hyperevm' || normalized === '999' || normalized === '100000022') {
          rejectHyperEvmDestination(chainArg);
        }
        if (normalized === 'hyperliquid' || normalized === 'hypercore') {
          toChain = 'HyperLiquid';
          toChainId = HYPERLIQUID_CORE_CHAIN_ID;
        } else {
          const chain: ChainInfo = resolveSourceChain(chainArg);
          toChain = chain.name;
          toChainId = chain.chainId;
        }
        toToken = tokenArg;
        i += 3;
        break;
      }
      case '--approve': {
        approve = true;
        i += 1;
        break;
      }
      default: {
        fail(`Unknown argument "${flag}"`);
      }
    }
  }

  if (
    fromChain === undefined ||
    fromChainId === undefined ||
    fromToken === undefined ||
    amount === undefined
  ) {
    fail('Missing --from <chain> <token> <amount>');
  }
  if (toChain === undefined || toChainId === undefined || toToken === undefined) {
    fail('Missing --to <chain> <token>');
  }
  if (amount !== 'max' && !AMOUNT_PATTERN.test(amount)) {
    fail(`Invalid amount "${amount}" (expected a decimal number or "max")`);
  }

  return {
    ...flags,
    fromChain,
    fromChainId,
    fromToken,
    amount,
    toChain,
    toChainId,
    toToken,
    approve,
  };
}

export function computeMaxRaw(balance: bigint, opex: bigint, reserve: number): bigint {
  const reservedOpex: BigNumber = new BigNumber(opex.toString())
    .times(reserve)
    .integerValue(BigNumber.ROUND_DOWN);

  const max: BigNumber = BigNumber.max(0, new BigNumber(balance.toString()).minus(reservedOpex));

  return BigInt(max.toFixed());
}

export const UNLIMITED_ALLOWANCE_THRESHOLD: bigint = 2n ** 128n;

export interface AllowanceStageInput {
  reporter: FlowReporter;
  rpc?: SourceRpc;
  bundle: { intents: IntentResponse[] };
  walletAddress: string;
  srcDecimals: number;
  srcChain: ChainInfo;
  fromChain: string;
  dryRun: boolean;
  approve: boolean;
  wallet?: Wallet;
  skipAllowance?: boolean;
}

export interface AllowanceStageResult {
  approval?: ApprovalSummary;
  approveTxs: TxRow[];
}

export async function runAllowanceStage(input: AllowanceStageInput): Promise<AllowanceStageResult> {
  const { reporter, bundle, walletAddress, srcDecimals, srcChain, fromChain } = input;
  let approval: ApprovalSummary | undefined;
  const approveTxs: TxRow[] = [];

  await reporter.step('Check allowance', async (): Promise<void> => {
    if (input.skipAllowance) {
      reporter.event('Skipping allowance check (Solana source or permit-mode route)', {});
      return;
    }
    if (hasPermitAction(bundle)) {
      reporter.event('Bundle uses permit approval — skipping on-chain allowance check', {});
      return;
    }
    if (input.rpc === undefined) {
      throw new Error('Internal error: allowance check requested without an EVM RPC client.');
    }
    const rpc: SourceRpc = input.rpc;
    const requirement: AllowanceRequirement | null = extractAllowanceRequirement(bundle);
    if (requirement === null) {
      reporter.event('No approval action in bundle; skipping allowance check', {});
      return;
    }

    const setApproval = (c: AllowanceCheck): void => {
      approval = {
        spender: requirement.spender,
        token: requirement.token,
        required: toHuman(c.required, srcDecimals),
        current:
          c.current > UNLIMITED_ALLOWANCE_THRESHOLD ? 'unlimited' : toHuman(c.current, srcDecimals),
        sufficient: c.sufficient,
      };
    };

    const check: AllowanceCheck = await checkAllowance(rpc, walletAddress, requirement);
    setApproval(check);
    if (check.sufficient || input.dryRun) {
      return;
    }

    if (!input.approve) {
      throw new Error(
        `Insufficient ERC-20 allowance for token ${requirement.token} to spender ${requirement.spender}: ` +
          `have ${check.current.toString()}, need ${check.required.toString()}. ` +
          `Approve the spender first, or pass --approve to have this tool send an unlimited approve ` +
          `(needs native gas on ${fromChain}). This tool otherwise never sends transactions.`,
      );
    }
    if (input.wallet === undefined) {
      throw new Error('--approve requires HL_PRIVATE_KEY to send the approval transaction.');
    }

    reporter.event('insufficient allowance — sending unlimited approve', {
      token: requirement.token,
      spender: requirement.spender,
      from: walletAddress,
      note: `needs native gas on ${fromChain}`,
    });
    const approveHash: string = await rpc.approveUnlimited(
      input.wallet,
      requirement.token,
      requirement.spender,
    );
    approveTxs.push({ side: 'src', hash: approveHash, url: srcChain.txUrl(approveHash) });
    reporter.event('approve confirmed', { txHash: approveHash, url: srcChain.txUrl(approveHash) });

    const recheck: AllowanceCheck = await checkAllowance(rpc, walletAddress, requirement);
    setApproval(recheck);
    if (!recheck.sufficient) {
      throw new Error(
        `Allowance still insufficient after the approve tx (${approveHash}) — check the transaction on the source-chain explorer.`,
      );
    }
  });

  return { approval, approveTxs };
}

const HYPEREVM_DLN_CHAIN_ID: number = 100000022;
const HYPEREVM_CHAIN_ID: number = 999;
const ACCEPTED_HL_DST_CHAIN_IDS: readonly number[] = [
  HYPERLIQUID_CORE_CHAIN_ID,
  HYPEREVM_DLN_CHAIN_ID,
  HYPEREVM_CHAIN_ID,
];

export interface DepositDeps {
  cfg: AppConfig;
  args: DepositArgs;
  api: ApiClient;
  gaslessApi: GaslessApiClient;
  explorer: Explorer;
  tradeWallets: TradeWalletContext;
  evmRpc?: SourceRpc;
  solanaRpc?: SolanaRpc;
  reporter: FlowReporter;
}

interface ResolvedSourceToken {
  address: string;
  decimals: number;
  usdPrice?: string;
  fromFallbackConstant: boolean;
}

interface ResolvedDestinationToken {
  address: string;
  coreDecimals: number;
  usdPrice: string;
}

function findAssetBySymbol(assets: PolymorphicAsset[], symbol: string): AssetData | undefined {
  const match: PolymorphicAsset | undefined = assets.find(
    (asset: PolymorphicAsset): boolean => asset.data.symbol === symbol,
  );
  return match?.data;
}

function nowExpirationTimestamp(): number {
  return Math.floor(Date.now() / 1000) + EXPIRATION_WINDOW_SECONDS;
}

function buildTradeRequest(params: {
  srcChainId: number;
  srcTokenAddress: string;
  srcAmountRaw: bigint;
  dstTokenAddress: string;
  quote: QuoteAddresses;
}): TradeRequest {
  return {
    srcChainId: params.srcChainId,
    srcChainTokenIn: params.srcTokenAddress,
    srcChainTokenInAmount: params.srcAmountRaw.toString(),
    dstChainId: HYPERLIQUID_CORE_CHAIN_ID,
    dstChainTokenOut: params.dstTokenAddress,
    dstChainTokenOutAmount: 'auto',
    prependOperatingExpenses: true,
    srcChainAuthorityAddress: params.quote.srcChainAuthorityAddress,
    dstChainTokenOutRecipient: params.quote.dstChainTokenOutRecipient,
    dstChainAuthorityAddress: params.quote.dstChainAuthorityAddress,
  };
}

function buildCreateBundleRequest(params: {
  requestId: string;
  srcChainId: number;
  srcTokenAddress: string;
  trade: TradeRequest;
  referralCode?: number;
  enableAccountAbstraction: boolean;
  userId?: string;
}): CreateBundleRequest {
  return {
    requestId: params.requestId,
    expirationTimestamp: nowExpirationTimestamp(),
    enableAccountAbstraction: params.enableAccountAbstraction,
    isAtomic: false,
    userId: params.userId,
    tradingAlgorithm: 'market',
    referralCode: params.referralCode,
    trades: [params.trade],
    postHooks: [],
    preHooks: [],
    costToken: {
      chainId: params.srcChainId,
      tokenAddress: params.srcTokenAddress,
    },
  };
}

function findAssetByAddress(assets: PolymorphicAsset[], address: string): AssetData | undefined {
  const lower: string = address.toLowerCase();
  return assets.find(
    (asset: PolymorphicAsset): boolean => asset.data.address?.toLowerCase() === lower,
  )?.data;
}

async function resolveSourceToken(
  api: ApiClient,
  rpc: SourceRpc,
  fromChainId: number,
  fromChainName: string,
  tokenArg: string,
  reporter: FlowReporter,
): Promise<ResolvedSourceToken> {
  let assets: PolymorphicAsset[] = [];
  try {
    assets = await api.getAssets(fromChainId);
  } catch (error: unknown) {
    const message: string = error instanceof Error ? error.message : String(error);
    reporter.event('source assets endpoint unavailable — resolving from arg/constant', {
      chainId: fromChainId,
      message,
    });
  }

  const isAddress: boolean = TOKEN_ADDRESS_PATTERN.test(tokenArg);

  let asset: AssetData | undefined;
  let address: string | undefined;
  let fromFallbackConstant: boolean = false;

  if (isAddress) {
    address = tokenArg;
    asset = findAssetByAddress(assets, tokenArg);
  } else {
    asset = findAssetBySymbol(assets, tokenArg);
    address = asset?.address;
    if (address === undefined) {
      const fallback: string | undefined =
        tokenArg === 'USDC' ? FALLBACK_USDC_ADDRESSES[fromChainName] : undefined;
      if (fallback === undefined) {
        throw new Error(
          `Could not resolve source token address for "${tokenArg}" on ${fromChainName} ` +
            `(chainId ${fromChainId}) from the assets endpoint, and no verified fallback ` +
            `constant exists. Pass the token as a 0x address instead.`,
        );
      }
      address = fallback;
      fromFallbackConstant = true;
      reporter.event('WARNING: source token address resolved from a hard-coded constant', {
        symbol: tokenArg,
        chain: fromChainName,
        address,
        reason: 'assets endpoint unavailable or returned no address for this symbol',
      });
    }
  }

  const decimals: number = await rpc.decimals(address);
  const usdPrice: string | undefined = asset?.usdPrice;

  return { address, decimals, usdPrice, fromFallbackConstant };
}

async function resolveSolanaSourceToken(
  solanaRpc: SolanaRpc,
  tokenArg: string,
  reporter: FlowReporter,
): Promise<ResolvedSourceToken> {
  const address: string = resolveSolanaTokenAddress(tokenArg);
  const knownDecimals: number | undefined = FALLBACK_SOLANA_DECIMALS[address];
  const decimals: number = knownDecimals ?? (await solanaRpc.decimals(address));
  if (knownDecimals === undefined) {
    reporter.event('resolved Solana token decimals from RPC', { address, decimals });
  }
  return {
    address,
    decimals,
    usdPrice: undefined,
    fromFallbackConstant: knownDecimals !== undefined,
  };
}

async function resolveDestinationToken(
  api: ApiClient,
  symbol: string,
  reporter: FlowReporter,
): Promise<ResolvedDestinationToken> {
  let assets: PolymorphicAsset[] = [];
  try {
    assets = await api.getAssets(HYPERLIQUID_CORE_CHAIN_ID);
  } catch (error: unknown) {
    reporter.event('HyperCore assets endpoint unavailable — resolving destination from constant', {
      chainId: HYPERLIQUID_CORE_CHAIN_ID,
      message: error instanceof Error ? error.message : String(error),
    });
  }

  const asset: AssetData | undefined = findAssetBySymbol(assets, symbol);
  if (asset !== undefined && asset.address !== undefined && asset.decimals !== undefined) {
    const usdPrice: string = asset.usdPrice ?? '1';
    if (asset.usdPrice === undefined) {
      reporter.event('WARNING: destination USD price defaulted to 1.0', { symbol });
    }
    return { address: asset.address, coreDecimals: asset.decimals, usdPrice };
  }

  const fallback: HyperCoreTokenConstant | undefined = FALLBACK_HYPERCORE_TOKENS[symbol];
  if (fallback === undefined) {
    throw new Error(
      `Could not resolve HyperCore token "${symbol}" from GET /api/chains/${HYPERLIQUID_CORE_CHAIN_ID}/assets, ` +
        `and no verified fallback constant exists. Only USDC has a fallback; the endpoint may be down (500).`,
    );
  }
  reporter.event('WARNING: destination token resolved from a hard-coded constant', {
    symbol,
    address: fallback.address,
    reason: 'HyperCore assets endpoint unavailable or returned no address/decimals for this symbol',
  });
  return {
    address: fallback.address,
    coreDecimals: fallback.coreDecimals,
    usdPrice: fallback.usdPrice,
  };
}

function pickSideToken(side: BundleSide | undefined, address: string): BundleSideToken | undefined {
  if (side === undefined || side.tokens.length === 0) {
    return undefined;
  }
  const lower: string = address.toLowerCase();
  return side.tokens.find((t: BundleSideToken): boolean => t.address.toLowerCase() === lower);
}

export async function runDeposit(deps: DepositDeps): Promise<DepositReport> {
  const { cfg, args, api, gaslessApi, explorer, tradeWallets, evmRpc, solanaRpc, reporter } = deps;

  const solanaSource: boolean = tradeWallets.solanaSource;
  const quote: QuoteAddresses = tradeWallets.quote;
  const walletAddress: string = quote.srcChainAuthorityAddress;
  const recipient: string = quote.dstChainTokenOutRecipient;
  const evmWallet: Wallet | undefined = tradeWallets.evm?.wallet;
  const referralCode: number | undefined = cfg.referralCode;
  const enableAccountAbstraction: boolean = solanaSource;

  const srcChain: ChainInfo = resolveSourceChain(String(args.fromChainId));

  const scannerLinks: LinkRow[] = [
    {
      label: `${args.fromChain} account`,
      url: solanaSource ? srcChain.addressUrl(walletAddress) : srcChain.addressUrl(walletAddress),
    },
    { label: 'HyperCore recipient', url: hyperliquidAddressUrl(recipient) },
  ];

  reporter.param('from', `${args.amount} ${args.fromToken} on ${args.fromChain}`);
  reporter.param('to', `${args.toToken} on ${args.toChain}`);
  reporter.param('recipient', recipient);

  const { source, destination } = await reporter.step(
    'Resolve tokens & chains',
    async (): Promise<{ source: ResolvedSourceToken; destination: ResolvedDestinationToken }> => {
      const src: ResolvedSourceToken =
        solanaSource && solanaRpc !== undefined
          ? await resolveSolanaSourceToken(solanaRpc, args.fromToken, reporter)
          : await resolveSourceToken(
              api,
              evmRpc!,
              srcChain.chainId,
              srcChain.name,
              args.fromToken,
              reporter,
            );
      const dst: ResolvedDestinationToken = await resolveDestinationToken(
        api,
        args.toToken,
        reporter,
      );
      return { source: src, destination: dst };
    },
  );

  const sourceBalanceReader = solanaSource ? solanaRpc! : evmRpc!;

  let maxDetail: MaxDetail | undefined;
  const amountRaw: bigint = await reporter.step('Resolve amount', async (): Promise<bigint> => {
    if (args.amount !== 'max') {
      return parseUnits(args.amount, source.decimals);
    }
    const balance: bigint = await sourceBalanceReader.balanceOf(source.address, walletAddress);
    const probeTrade: TradeRequest = buildTradeRequest({
      srcChainId: srcChain.chainId,
      srcTokenAddress: source.address,
      srcAmountRaw: balance,
      dstTokenAddress: destination.address,
      quote,
    });
    const probeRequest: CreateBundleRequest = buildCreateBundleRequest({
      requestId: generateRequestId(),
      srcChainId: srcChain.chainId,
      srcTokenAddress: source.address,
      trade: probeTrade,
      referralCode,
      enableAccountAbstraction,
      userId: quote.userId,
    });
    const probe: BundleResponse = await api.createBundle(probeRequest);
    const opexStr: string | undefined = probe.trades[0]?.prependedOperatingExpenseCost;
    if (opexStr === undefined) {
      reporter.event(
        'WARNING: max probe returned no prependedOperatingExpenseCost; assuming 0',
        {},
      );
    }
    const opex: bigint = opexStr !== undefined ? BigInt(opexStr) : 0n;
    const resultRaw: bigint = computeMaxRaw(balance, opex, cfg.maxOpexReserve);
    maxDetail = {
      balance: toHuman(balance, source.decimals),
      opex: toHuman(opex, source.decimals),
      reserve: cfg.maxOpexReserve,
      resultAmount: toHuman(resultRaw, source.decimals),
    };
    return resultRaw;
  });

  const requestId: string = generateRequestId();
  const bundle: BundleResponse = await reporter.step(
    'Create bundle',
    async (): Promise<BundleResponse> => {
      const trade: TradeRequest = buildTradeRequest({
        srcChainId: srcChain.chainId,
        srcTokenAddress: source.address,
        srcAmountRaw: amountRaw,
        dstTokenAddress: destination.address,
        quote,
      });
      const request: CreateBundleRequest = buildCreateBundleRequest({
        requestId,
        srcChainId: srcChain.chainId,
        srcTokenAddress: source.address,
        trade,
        referralCode,
        enableAccountAbstraction,
        userId: quote.userId,
      });
      const response: BundleResponse = await api.createBundle(request);
      reporter.attach('bundle-response', response, 'json');
      return response;
    },
  );

  const { trade, intent } = await reporter.step(
    'Validate bundle',
    async (): Promise<{ trade: TradeResponse; intent: IntentResponse }> =>
      validateSingleTradeIntent(bundle, {
        acceptedSrcChainIds: [srcChain.chainId],
        acceptedDstChainIds: ACCEPTED_HL_DST_CHAIN_IDS,
        requireRequiredActions: true,
        requireConstraintBudget: true,
      }),
  );

  const { approval, approveTxs } = await runAllowanceStage({
    reporter,
    rpc: evmRpc,
    bundle,
    walletAddress,
    srcDecimals: source.decimals,
    srcChain,
    fromChain: args.fromChain,
    dryRun: args.dryRun,
    approve: args.approve,
    wallet: evmWallet,
    skipAllowance: solanaSource,
  });

  const srcTokenIn: SrcChainTokenIn = trade.srcChainTokenIn;
  const dstTokenOut: DstChainTokenOut = trade.dstChainTokenOut;
  const opexRaw: bigint =
    trade.prependedOperatingExpenseCost !== undefined
      ? BigInt(trade.prependedOperatingExpenseCost)
      : 0n;
  const guaranteedRaw: bigint = floorEvmAmountToCore(
    BigInt(dstTokenOut.amount),
    dstTokenOut.decimals,
    destination.coreDecimals,
  );

  const payHuman: string = toHuman(BigInt(srcTokenIn.amount), source.decimals);
  const receiveEstimateHuman: string = toHuman(
    BigInt(dstTokenOut.recommendedAmount),
    dstTokenOut.decimals,
  );
  const dstApproxUsd: number =
    dstTokenOut.recommendedApproximateUsdValue ?? dstTokenOut.approximateUsdValue;
  const srcUsdPrice: string = deriveUnitUsdPrice(
    srcTokenIn.approximateUsdValue,
    payHuman,
    source.usdPrice,
  );
  const dstUsdPrice: string = deriveUnitUsdPrice(
    dstApproxUsd,
    receiveEstimateHuman,
    destination.usdPrice,
  );

  const { pay, fee, receiveEstimate, receiveGuaranteed } = priceQuote({
    payRaw: BigInt(srcTokenIn.amount),
    opexRaw,
    srcDecimals: source.decimals,
    srcUsdPrice,
    srcSymbol: args.fromToken,
    recommendedRaw: BigInt(dstTokenOut.recommendedAmount),
    guaranteedRaw,
    dstDecimals: dstTokenOut.decimals,
    dstUsdPrice,
    dstSymbol: args.toToken,
  });

  const { srcBefore, dstBefore } = await reporter.step(
    'Snapshot balances',
    async (): Promise<{ srcBefore: bigint; dstBefore: CoreBalance | undefined }> => {
      const before: bigint = await sourceBalanceReader.balanceOf(source.address, walletAddress);
      let dst: CoreBalance | undefined;
      try {
        dst = await readCoreSpotBalance(api, args.toToken, recipient);
      } catch (error: unknown) {
        reporter.event('HyperCore balance unavailable — destination balance shown as n/a', {
          token: args.toToken,
          message: error instanceof Error ? error.message : String(error),
        });
      }
      return { srcBefore: before, dstBefore: dst };
    },
  );

  const srcBeforeHuman: string = toHuman(srcBefore, source.decimals);
  const dstBeforeHuman: string =
    dstBefore !== undefined ? toHuman(dstBefore.rawCore, dstBefore.coreDecimals) : 'n/a';
  const srcExpectedAfterHuman: string = new BigNumber(srcBeforeHuman).minus(pay.human).toFixed();
  const dstExpectedAfterHuman: string =
    dstBefore !== undefined
      ? new BigNumber(dstBeforeHuman).plus(receiveGuaranteed.human).toFixed()
      : 'n/a';

  const balances: BalanceRow[] = [
    {
      chain: args.fromChain,
      symbol: args.fromToken,
      before: srcBeforeHuman,
      expectedAfter: srcExpectedAfterHuman,
    },
    {
      chain: args.toChain,
      symbol: args.toToken,
      before: dstBeforeHuman,
      expectedAfter: dstExpectedAfterHuman,
    },
  ];

  if (args.dryRun) {
    const dryHeader: ReportHeader = {
      fromChain: args.fromChain,
      fromToken: args.fromToken,
      amount: maxDetail?.resultAmount ?? args.amount,
      toChain: args.toChain,
      toToken: args.toToken,
    };
    const dryRunSummary: string =
      `DRY RUN — built & priced ${pay.human} ${args.fromToken} → ` +
      `${receiveGuaranteed.human} ${args.toToken} on HyperCore; not signed or submitted`;
    return {
      header: dryHeader,
      quote: { pay, fee, receiveEstimate, receiveGuaranteed },
      maxDetail,
      balances,
      reconciliation: [],
      txs: [],
      links: scannerLinks,
      timeline: {},
      finalDeviations: [],
      summaryLine: dryRunSummary,
      dryRun: true,
      approval,
    };
  }

  const signedData: SignedDataItem[] = await reporter.step(
    'Sign required actions',
    async (): Promise<SignedDataItem[]> => {
      if (solanaSource) {
        const keypair = tradeWallets.solana?.keypair;
        if (keypair === undefined) {
          throw new Error(
            'Internal error: a real Solana-source deposit reached Sign without HL_SOLANA_PRIVATE_KEY.',
          );
        }
        const connection = solanaRpc!.getConnection();
        return signSolanaRequiredActions({
          connection,
          keypair,
          api: gaslessApi,
          intents: bundle.intents,
        });
      }
      if (evmWallet === undefined) {
        throw new Error('Internal error: a real deposit reached the Sign stage without a wallet.');
      }
      return signRequiredActions(evmWallet, intent.requiredActions);
    },
  );

  const bundleId: string = await reporter.step('Submit bundle', async (): Promise<string> => {
    const request: SubmitBundleRequest = {
      enableAccountAbstraction,
      isAtomic: false,
      requestId,
      intents: bundle.intents,
      trades: bundle.trades,
      signedData,
      referralCode: bundle.referralCode ?? referralCode,
    };
    const response: SubmitBundleResponse = await api.submitBundle(request);
    const id: string =
      response.bundleId && response.bundleId.length > 0 ? response.bundleId : requestId;
    if (id.length === 0) {
      throw new Error('Submit returned an empty bundleId.');
    }
    return id;
  });

  const timeline: Timeline = {};
  const reconciliation: ReconRow[] = [];
  const finalDeviations: FinalDeviation[] = [];
  let txs: TxRow[] = [...approveTxs];
  let reconciled: boolean = false;
  let reachedTerminal: boolean = false;
  let creditedHuman: string | undefined;
  let creditedDeviation: Deviation | undefined;
  let creditedAt: number | undefined;

  const CREDIT_GRACE_MS: number = Math.min(20000, Math.floor(cfg.pollTimeoutMs / 2));

  await reporter.step('Observe bundle to terminal status', async (): Promise<void> => {
    const t0: number = Date.now();
    const deadline: number = t0 + cfg.pollTimeoutMs;
    let indexed: boolean = false;
    let lastStatus: string | undefined;
    let lastHeartbeat: number = t0;
    const seenTxs: Set<string> = new Set<string>();

    reporter.event('submitted — observing bundle (this can take a few minutes)', {
      bundleId,
      details: `${cfg.explorerApiUrl}/bundles/${bundleId}`,
      timeoutS: Math.round(cfg.pollTimeoutMs / 1000),
    });

    while (Date.now() < deadline) {
      const elapsedS: number = (Date.now() - t0) / 1000;

      const details: BundleDetails | null = await explorer.getBundleDetails(bundleId);
      if (details !== null) {
        txs = [
          ...approveTxs,
          ...collectTxs(details, {
            srcTxUrl: (hash: string): string => srcChain.txUrl(hash),
            dstTxUrl: hyperliquidTxUrl,
          }),
        ];
        if (!indexed) {
          indexed = true;
          reporter.event('bundle indexed on explorer', { bundleId });
        }
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
        if (!reconciled && details.src !== undefined && details.dst !== undefined) {
          const srcSide: BundleSideToken | undefined = pickSideToken(details.src, source.address);
          const dstSide: BundleSideToken | undefined = pickSideToken(
            details.dst,
            destination.address,
          );
          const usableSide = (side: BundleSideToken | undefined): side is BundleSideToken =>
            side !== undefined &&
            Number.isFinite(side.decimals) &&
            /^\d+$/.test(String(side.amount));
          if (usableSide(srcSide) && usableSide(dstSide)) {
            const srcExplorerHuman: string = toHuman(BigInt(srcSide.amount), srcSide.decimals);
            const dstExplorerHuman: string = toHuman(BigInt(dstSide.amount), dstSide.decimals);
            reconciliation.push({
              field: 'Source amount',
              quote: pay.human,
              explorer: srcExplorerHuman,
              deviation: deviation(pay.human, srcExplorerHuman, srcUsdPrice),
            });
            reconciliation.push({
              field: 'Destination amount',
              quote: receiveGuaranteed.human,
              explorer: dstExplorerHuman,
              deviation: deviation(receiveGuaranteed.human, dstExplorerHuman, dstUsdPrice),
            });
            reconciled = true;
          }
        }
        if (details.status === 'fulfilled' && timeline.fulfilledS === undefined) {
          timeline.fulfilledS = elapsedS;
        }
        if (details.status === 'finalized' && timeline.finalizedS === undefined) {
          timeline.finalizedS = elapsedS;
        }
      }

      if (timeline.srcDebitedS === undefined) {
        const current: bigint = await sourceBalanceReader.balanceOf(source.address, walletAddress);
        if (current < srcBefore) {
          timeline.srcDebitedS = elapsedS;
          const debitedHuman: string = toHuman(srcBefore - current, source.decimals);
          balances[0].actualAfter = toHuman(current, source.decimals);
          finalDeviations.push({
            label: 'Debited vs pay',
            deviation: deviation(pay.human, debitedHuman, srcUsdPrice),
          });
          reporter.event('source debited', {
            amount: `${debitedHuman} ${args.fromToken}`,
            afterS: Math.round(elapsedS),
          });
        }
      }

      if (timeline.dstCreditedS === undefined && dstBefore !== undefined) {
        const current: CoreBalance = await readCoreSpotBalance(api, args.toToken, recipient);
        if (current.rawCore > dstBefore.rawCore) {
          timeline.dstCreditedS = elapsedS;
          creditedAt = Date.now();
          creditedHuman = toHuman(current.rawCore - dstBefore.rawCore, current.coreDecimals);
          creditedDeviation = deviation(receiveGuaranteed.human, creditedHuman, dstUsdPrice);
          balances[1].actualAfter = toHuman(current.rawCore, current.coreDecimals);
          finalDeviations.push({
            label: 'Credited vs guaranteed',
            deviation: creditedDeviation,
          });
          reporter.event('destination credited on HyperCore', {
            amount: `${creditedHuman} ${args.toToken}`,
            afterS: Math.round(elapsedS),
          });
        }
      }

      const currentStatus: string | undefined = details?.status;
      if (currentStatus === 'fulfilled' || currentStatus === 'finalized') {
        reachedTerminal = true;
      }

      if (timeline.dstCreditedS !== undefined) {
        if (reachedTerminal) break;
        if (creditedAt !== undefined && Date.now() - creditedAt >= CREDIT_GRACE_MS) break;
      }

      if (Date.now() - lastHeartbeat >= HEARTBEAT_MS) {
        lastHeartbeat = Date.now();
        reporter.event('waiting…', {
          status: lastStatus ?? 'not yet indexed',
          srcDebited: timeline.srcDebitedS !== undefined,
          dstCredited: timeline.dstCreditedS !== undefined,
          elapsedS: Math.round(elapsedS),
          remainingS: Math.round((deadline - Date.now()) / 1000),
        });
      }

      await sleep(cfg.pollIntervalMs);
    }
  });

  const bundleUrl: string = `${cfg.explorerApiUrl}/bundles/${bundleId}`;
  const header: ReportHeader = {
    fromChain: args.fromChain,
    fromToken: args.fromToken,
    amount: maxDetail?.resultAmount ?? args.amount,
    toChain: args.toChain,
    toToken: args.toToken,
    bundleId,
    bundleUrl,
  };
  const links: LinkRow[] = [{ label: 'Bundle (explorer API)', url: bundleUrl }, ...scannerLinks];

  const unmet: string[] = [];
  if (timeline.srcDebitedS === undefined) unmet.push('source debit');
  if (timeline.dstCreditedS === undefined) unmet.push('destination credit');

  const destinationLabel: string = 'HyperCore';
  const receivedHuman: string = creditedHuman ?? receiveGuaranteed.human;
  const elapsedSeconds: number | undefined =
    timeline.dstCreditedS ?? timeline.fulfilledS ?? timeline.finalizedS;
  const elapsedText: string =
    elapsedSeconds !== undefined ? ` in ${elapsedSeconds.toFixed(1)}s` : '';
  const bpsText: string =
    creditedDeviation !== undefined
      ? ` (${creditedDeviation.bps >= 0 ? '+' : '−'}${Math.abs(creditedDeviation.bps).toFixed(2)} bps vs quote)`
      : '';

  const explorerNote: string =
    unmet.length === 0 && !reachedTerminal
      ? ' — explorer status not indexed within the window'
      : '';
  if (explorerNote.length > 0) {
    reporter.event(
      'deposit confirmed on-chain (credit observed); explorer did not index the bundle',
      {
        bundleId,
      },
    );
  }

  const summaryLine: string =
    unmet.length === 0
      ? `✓ Deposited ${pay.human} ${args.fromToken} → ${receivedHuman} ${args.toToken} on ${destinationLabel}${elapsedText}${bpsText}${explorerNote}`
      : `✗ Deposit incomplete after ${(cfg.pollTimeoutMs / 1000).toFixed(0)}s — unmet: ${unmet.join(', ')} (bundle ${bundleId})`;

  return {
    header,
    quote: { pay, fee, receiveEstimate, receiveGuaranteed },
    maxDetail,
    balances,
    reconciliation,
    txs,
    links,
    timeline,
    finalDeviations,
    summaryLine,
    approval,
  };
}

export interface GaslessTradeDeps {
  cfg: AppConfig;
  args: DepositArgs;
  api: GaslessApiClient;
  tradeWallets: TradeWalletContext;
  evmSrcRpc?: SourceRpc;
  evmDstRpc?: SourceRpc;
  solanaSrcRpc?: SolanaRpc;
  solanaDstRpc?: SolanaRpc;
  reporter: FlowReporter;
}

function resolveTokenAddress(
  tokenArg: string,
  chainName: string,
  side: 'source' | 'destination',
  chainId: number,
): string {
  if (isSolanaChainId(chainId)) {
    return resolveSolanaTokenAddress(tokenArg);
  }
  if (TOKEN_ADDRESS_PATTERN.test(tokenArg)) {
    return tokenArg;
  }
  if (tokenArg === 'USDC') {
    const fallback: string | undefined = FALLBACK_USDC_ADDRESSES[chainName];
    if (fallback !== undefined) {
      return fallback;
    }
  }
  throw new Error(
    `Cannot resolve ${side} token "${tokenArg}" on ${chainName}. Pass a 0x address ` +
      `(symbol resolution for non-HyperLiquid chains is not supported yet; only USDC has a ` +
      `verified fallback, on ${Object.keys(FALLBACK_USDC_ADDRESSES).join(', ')}).`,
  );
}

function buildGaslessTradeRequest(params: {
  srcChainId: number;
  srcTokenAddress: string;
  srcAmountRaw: bigint;
  dstChainId: number;
  dstTokenAddress: string;
  quote: QuoteAddresses;
}): GaslessTradeRequestItem {
  return {
    srcChainId: params.srcChainId,
    srcChainTokenIn: params.srcTokenAddress,
    srcChainTokenInAmount: params.srcAmountRaw.toString(),
    dstChainId: params.dstChainId,
    dstChainTokenOut: params.dstTokenAddress,
    dstChainTokenOutAmount: 'auto',
    prependOperatingExpenses: true,
    srcChainAuthorityAddress: params.quote.srcChainAuthorityAddress,
    dstChainTokenOutRecipient: params.quote.dstChainTokenOutRecipient,
    dstChainAuthorityAddress: params.quote.dstChainAuthorityAddress,
  };
}

function buildCreateRequest(params: {
  requestId: string;
  srcChainId: number;
  srcTokenAddress: string;
  quote: QuoteAddresses;
  trade: GaslessTradeRequestItem;
  referralCode?: number;
  fromChainId: number;
  toChainId: number;
}): GaslessCreateBundleRequest {
  const usePermit: boolean = shouldUsePermitQuoteMode(params.fromChainId, params.toChainId);
  const enableAccountAbstraction: boolean = isSolanaChainId(params.fromChainId);
  return {
    requestId: params.requestId,
    enableAccountAbstraction,
    isAtomic: false,
    userId: params.quote.userId,
    tradingAlgorithm: 'market',
    referralCode: params.referralCode,
    ...(usePermit
      ? { approvalMode: 'permit' as const, approveAmountFlag: 'unlimited' as const }
      : {}),
    trades: [params.trade],
    postHooks: [],
    preHooks: [],
    costToken: {
      chainId: params.srcChainId,
      tokenAddress: params.srcTokenAddress,
    },
  };
}

export async function runGaslessTrade(deps: GaslessTradeDeps): Promise<DepositReport> {
  const {
    cfg,
    args,
    api,
    tradeWallets,
    evmSrcRpc,
    evmDstRpc,
    solanaSrcRpc,
    solanaDstRpc,
    reporter,
  } = deps;

  const quote: QuoteAddresses = tradeWallets.quote;
  const walletAddress: string = quote.srcChainAuthorityAddress;
  const recipient: string = quote.dstChainTokenOutRecipient;
  const evmWallet: Wallet | undefined = tradeWallets.evm?.wallet;
  const solanaSource: boolean = tradeWallets.solanaSource;
  const enableAccountAbstraction: boolean = solanaSource;
  const referralCode: number | undefined = cfg.referralCode;

  const srcChain: ChainInfo = resolveSourceChain(String(args.fromChainId));
  const dstChain: ChainInfo = resolveSourceChain(String(args.toChainId));
  const srcBalanceReader: BalanceReader = isSolanaChainId(args.fromChainId)
    ? solanaSrcRpc!
    : evmSrcRpc!;
  const dstBalanceReader: BalanceReader = isSolanaChainId(args.toChainId)
    ? solanaDstRpc!
    : evmDstRpc!;

  const scannerLinks: LinkRow[] = [
    { label: `${args.fromChain} account`, url: srcChain.addressUrl(walletAddress) },
    { label: `${args.toChain} recipient`, url: dstChain.addressUrl(recipient) },
  ];

  reporter.param('from', `${args.amount} ${args.fromToken} on ${args.fromChain}`);
  reporter.param('to', `${args.toToken} on ${args.toChain}`);
  reporter.param('recipient', recipient);

  const { srcTokenAddress, dstTokenAddress, srcDecimals } = await reporter.step(
    'Resolve tokens & chains',
    async (): Promise<{
      srcTokenAddress: string;
      dstTokenAddress: string;
      srcDecimals: number;
    }> => {
      const srcAddr: string = resolveTokenAddress(
        args.fromToken,
        srcChain.name,
        'source',
        args.fromChainId,
      );
      const dstAddr: string = resolveTokenAddress(
        args.toToken,
        dstChain.name,
        'destination',
        args.toChainId,
      );
      const decimals: number = await srcBalanceReader.decimals(srcAddr);
      return { srcTokenAddress: srcAddr, dstTokenAddress: dstAddr, srcDecimals: decimals };
    },
  );

  let maxDetail: MaxDetail | undefined;
  const amountRaw: bigint = await reporter.step('Resolve amount', async (): Promise<bigint> => {
    if (args.amount !== 'max') {
      return parseUnits(args.amount, srcDecimals);
    }
    const balance: bigint = await srcBalanceReader.balanceOf(srcTokenAddress, walletAddress);
    const probeTrade: GaslessTradeRequestItem = buildGaslessTradeRequest({
      srcChainId: srcChain.chainId,
      srcTokenAddress,
      srcAmountRaw: balance,
      dstChainId: args.toChainId,
      dstTokenAddress,
      quote,
    });
    const probe: GaslessBundleResponse = await api.createBundle(
      buildCreateRequest({
        requestId: generateRequestId(),
        srcChainId: srcChain.chainId,
        srcTokenAddress,
        quote,
        trade: probeTrade,
        referralCode,
        fromChainId: args.fromChainId,
        toChainId: args.toChainId,
      }),
    );
    const opexStr: string | undefined = probe.trades[0]?.prependedOperatingExpenseCost;
    if (opexStr === undefined) {
      reporter.event(
        'WARNING: max probe returned no prependedOperatingExpenseCost; assuming 0',
        {},
      );
    }
    const opex: bigint = opexStr !== undefined ? BigInt(opexStr) : 0n;
    const resultRaw: bigint = computeMaxRaw(balance, opex, cfg.maxOpexReserve);
    maxDetail = {
      balance: toHuman(balance, srcDecimals),
      opex: toHuman(opex, srcDecimals),
      reserve: cfg.maxOpexReserve,
      resultAmount: toHuman(resultRaw, srcDecimals),
    };
    return resultRaw;
  });

  const requestId: string = generateRequestId();
  const bundle: GaslessBundleResponse = await reporter.step(
    'Create bundle',
    async (): Promise<GaslessBundleResponse> => {
      const trade: GaslessTradeRequestItem = buildGaslessTradeRequest({
        srcChainId: srcChain.chainId,
        srcTokenAddress,
        srcAmountRaw: amountRaw,
        dstChainId: args.toChainId,
        dstTokenAddress,
        quote,
      });
      const response: GaslessBundleResponse = await api.createBundle(
        buildCreateRequest({
          requestId,
          srcChainId: srcChain.chainId,
          srcTokenAddress,
          quote,
          trade,
          referralCode,
          fromChainId: args.fromChainId,
          toChainId: args.toChainId,
        }),
      );
      reporter.attach('bundle-response', response, 'json');
      return response;
    },
  );

  const { trade, intent } = await reporter.step(
    'Validate bundle',
    async (): Promise<{ trade: GaslessTradeResponse; intent: IntentResponse }> =>
      validateSingleTradeIntent(bundle, {
        acceptedSrcChainIds: [srcChain.chainId],
        acceptedDstChainIds: [args.toChainId],
        requireRequiredActions: true,
        requireConstraintBudget: false,
      }),
  );

  const { approval, approveTxs } = await runAllowanceStage({
    reporter,
    rpc: evmSrcRpc,
    bundle,
    walletAddress,
    srcDecimals,
    srcChain,
    fromChain: args.fromChain,
    dryRun: args.dryRun,
    approve: args.approve,
    wallet: evmWallet,
    skipAllowance: solanaSource,
  });

  const srcTokenIn: SrcChainTokenIn = trade.srcChainTokenIn;
  const dstTokenOut = trade.dstChainTokenOut;
  const opexRaw: bigint =
    trade.prependedOperatingExpenseCost !== undefined
      ? BigInt(trade.prependedOperatingExpenseCost)
      : 0n;
  const guaranteedRaw: bigint = BigInt(dstTokenOut.amount);
  const recommendedRaw: bigint = BigInt(dstTokenOut.recommendedAmount ?? dstTokenOut.amount);

  const payHuman: string = toHuman(BigInt(srcTokenIn.amount), srcDecimals);
  const receiveEstimateHuman: string = toHuman(recommendedRaw, dstTokenOut.decimals);
  const dstApproxUsd: number =
    dstTokenOut.recommendedApproximateUsdValue ?? dstTokenOut.approximateUsdValue;
  const srcUsdPrice: string = deriveUnitUsdPrice(
    srcTokenIn.approximateUsdValue,
    payHuman,
    undefined,
  );
  const dstUsdPrice: string = deriveUnitUsdPrice(dstApproxUsd, receiveEstimateHuman, undefined);

  const { pay, fee, receiveEstimate, receiveGuaranteed } = priceQuote({
    payRaw: BigInt(srcTokenIn.amount),
    opexRaw,
    srcDecimals,
    srcUsdPrice,
    srcSymbol: args.fromToken,
    recommendedRaw,
    guaranteedRaw,
    dstDecimals: dstTokenOut.decimals,
    dstUsdPrice,
    dstSymbol: args.toToken,
  });

  const { srcBefore, dstBefore } = await reporter.step(
    'Snapshot balances',
    async (): Promise<{ srcBefore: bigint; dstBefore: bigint }> => {
      const src: bigint = await srcBalanceReader.balanceOf(srcTokenAddress, walletAddress);
      const dst: bigint = await dstBalanceReader.balanceOf(dstTokenAddress, recipient);
      return { srcBefore: src, dstBefore: dst };
    },
  );

  const srcBeforeHuman: string = toHuman(srcBefore, srcDecimals);
  const dstBeforeHuman: string = toHuman(dstBefore, dstTokenOut.decimals);
  const srcExpectedAfterHuman: string = new BigNumber(srcBeforeHuman).minus(pay.human).toFixed();
  const dstExpectedAfterHuman: string = new BigNumber(dstBeforeHuman)
    .plus(receiveGuaranteed.human)
    .toFixed();

  const balances: BalanceRow[] = [
    {
      chain: args.fromChain,
      symbol: args.fromToken,
      before: srcBeforeHuman,
      expectedAfter: srcExpectedAfterHuman,
    },
    {
      chain: args.toChain,
      symbol: args.toToken,
      before: dstBeforeHuman,
      expectedAfter: dstExpectedAfterHuman,
    },
  ];

  if (args.dryRun) {
    return {
      header: {
        fromChain: args.fromChain,
        fromToken: args.fromToken,
        amount: maxDetail?.resultAmount ?? args.amount,
        toChain: args.toChain,
        toToken: args.toToken,
      },
      quote: { pay, fee, receiveEstimate, receiveGuaranteed },
      maxDetail,
      balances,
      reconciliation: [],
      txs: [],
      links: scannerLinks,
      timeline: {},
      finalDeviations: [],
      summaryLine:
        `DRY RUN — built & priced ${pay.human} ${args.fromToken} → ${receiveGuaranteed.human} ` +
        `${args.toToken} on ${args.toChain}; not signed or submitted`,
      dryRun: true,
      approval,
    };
  }

  const signedData: SignedDataItem[] = await reporter.step(
    'Sign required actions',
    async (): Promise<SignedDataItem[]> => {
      if (solanaSource) {
        const keypair = tradeWallets.solana?.keypair;
        if (keypair === undefined) {
          throw new Error(
            'Internal error: a real Solana-source trade reached Sign without HL_SOLANA_PRIVATE_KEY.',
          );
        }
        const connection = solanaSrcRpc!.getConnection();
        return signSolanaRequiredActions({
          connection,
          keypair,
          api,
          intents: bundle.intents,
        });
      }
      if (evmWallet === undefined) {
        throw new Error('Internal error: a real trade reached the Sign stage without a wallet.');
      }
      return signRequiredActions(evmWallet, intent.requiredActions);
    },
  );

  const bundleId: string = await reporter.step('Submit bundle', async (): Promise<string> => {
    const request: GaslessSubmitBundleRequest = {
      enableAccountAbstraction,
      isAtomic: false,
      requestId,
      userId: quote.userId,
      intents: bundle.intents,
      trades: bundle.trades,
      signedData,
      bundleCosts: bundle.bundleCosts,
      deBridgeApp: 'DESWAP',
      referralCode: bundle.referralCode ?? referralCode,
    };
    const response: GaslessSubmitBundleResponse = await api.submitBundle(request);
    const id: string =
      response.bundleId !== undefined && response.bundleId.length > 0
        ? response.bundleId
        : requestId;
    return id;
  });

  const timeline: Timeline = {};
  const finalDeviations: FinalDeviation[] = [];
  const txs: TxRow[] = [...approveTxs];
  let creditedHuman: string | undefined;
  let creditedDeviation: Deviation | undefined;

  await reporter.step('Observe balances to terminal status', async (): Promise<void> => {
    const t0: number = Date.now();
    const deadline: number = t0 + cfg.pollTimeoutMs;
    let lastHeartbeat: number = t0;

    reporter.event('submitted — observing on-chain balances (this can take a few minutes)', {
      bundleId,
      timeoutS: Math.round(cfg.pollTimeoutMs / 1000),
    });

    while (Date.now() < deadline) {
      const elapsedS: number = (Date.now() - t0) / 1000;

      if (timeline.srcDebitedS === undefined) {
        const current: bigint = await srcBalanceReader.balanceOf(srcTokenAddress, walletAddress);
        if (current < srcBefore) {
          timeline.srcDebitedS = elapsedS;
          const debitedHuman: string = toHuman(srcBefore - current, srcDecimals);
          balances[0].actualAfter = toHuman(current, srcDecimals);
          finalDeviations.push({
            label: 'Debited vs pay',
            deviation: deviation(pay.human, debitedHuman, srcUsdPrice),
          });
          reporter.event('source debited', {
            amount: `${debitedHuman} ${args.fromToken}`,
            afterS: Math.round(elapsedS),
          });
        }
      }

      if (timeline.dstCreditedS === undefined) {
        const current: bigint = await dstBalanceReader.balanceOf(dstTokenAddress, recipient);
        if (current > dstBefore) {
          timeline.dstCreditedS = elapsedS;
          creditedHuman = toHuman(current - dstBefore, dstTokenOut.decimals);
          creditedDeviation = deviation(receiveGuaranteed.human, creditedHuman, dstUsdPrice);
          balances[1].actualAfter = toHuman(current, dstTokenOut.decimals);
          finalDeviations.push({
            label: 'Credited vs guaranteed',
            deviation: creditedDeviation,
          });
          reporter.event('destination credited', {
            amount: `${creditedHuman} ${args.toToken}`,
            afterS: Math.round(elapsedS),
          });
        }
      }

      if (timeline.srcDebitedS !== undefined && timeline.dstCreditedS !== undefined) {
        break;
      }

      if (Date.now() - lastHeartbeat >= HEARTBEAT_MS) {
        lastHeartbeat = Date.now();
        reporter.event('waiting…', {
          srcDebited: timeline.srcDebitedS !== undefined,
          dstCredited: timeline.dstCreditedS !== undefined,
          elapsedS: Math.round(elapsedS),
          remainingS: Math.round((deadline - Date.now()) / 1000),
        });
      }

      await sleep(cfg.pollIntervalMs);
    }
  });

  const header: ReportHeader = {
    fromChain: args.fromChain,
    fromToken: args.fromToken,
    amount: maxDetail?.resultAmount ?? args.amount,
    toChain: args.toChain,
    toToken: args.toToken,
    bundleId,
  };
  const links: LinkRow[] = scannerLinks;

  const unmet: string[] = [];
  if (timeline.srcDebitedS === undefined) unmet.push('source debit');
  if (timeline.dstCreditedS === undefined) unmet.push('destination credit');

  const receivedHuman: string = creditedHuman ?? receiveGuaranteed.human;
  const elapsedSeconds: number | undefined = timeline.dstCreditedS;
  const elapsedText: string =
    elapsedSeconds !== undefined ? ` in ${elapsedSeconds.toFixed(1)}s` : '';
  const bpsText: string =
    creditedDeviation !== undefined
      ? ` (${creditedDeviation.bps >= 0 ? '+' : '−'}${Math.abs(creditedDeviation.bps).toFixed(2)} bps vs quote)`
      : '';

  const summaryLine: string =
    unmet.length === 0
      ? `✓ Traded ${pay.human} ${args.fromToken} → ${receivedHuman} ${args.toToken} on ${args.toChain}${elapsedText}${bpsText}`
      : `✗ Trade incomplete after ${(cfg.pollTimeoutMs / 1000).toFixed(0)}s — unmet: ${unmet.join(', ')} (bundle ${bundleId})`;

  return {
    header,
    quote: { pay, fee, receiveEstimate, receiveGuaranteed },
    maxDetail,
    balances,
    reconciliation: [],
    txs,
    links,
    timeline,
    finalDeviations,
    summaryLine,
    approval,
  };
}

async function main(): Promise<number> {
  loadDotenv({ path: path.resolve(__dirname, '../.env') });

  const cfg: AppConfig = loadConfig();
  const args: DepositArgs = parseArgs(process.argv.slice(2));
  const tradeWallets: TradeWalletContext = resolveTradeWallets(cfg, args);

  const gaslessApi: GaslessApiClient = new GaslessApiClient(
    cfg.gaslessApiUrl,
    cfg.gaslessSubmitUrl,
    cfg.gaslessRefreshSolanaTxUrl,
  );

  const involvesHyperLiquid: boolean = isHyperLiquidChainId(args.toChainId);
  const solanaSource: boolean = isSolanaChainId(args.fromChainId);
  const solanaDestination: boolean = isSolanaChainId(args.toChainId);

  const srcChain: ChainInfo = resolveSourceChain(String(args.fromChainId));
  const evmSrcRpc: SourceRpc | undefined = solanaSource
    ? undefined
    : new SourceRpc(resolveChainRpcUrl(cfg, srcChain));
  const solanaSrcRpc: SolanaRpc | undefined = solanaSource
    ? new SolanaRpc(cfg.solanaRpcUrl)
    : undefined;

  return runCli({
    flags: args,
    toolRoot: TOOL_ROOT,
    alertBps: cfg.deviationAlertBps,
    flow: (reporter: FlowReporter): Promise<DepositReport> => {
      reporter.event('wallet context', { summary: formatWalletSummary(tradeWallets) });

      if (involvesHyperLiquid) {
        return runDeposit({
          cfg,
          args,
          api: new ApiClient(cfg.apiBaseUrl),
          gaslessApi,
          explorer: new Explorer(cfg.explorerApiUrl),
          tradeWallets,
          evmRpc: evmSrcRpc,
          solanaRpc: solanaSrcRpc,
          reporter,
        });
      }

      const dstChain: ChainInfo = resolveSourceChain(String(args.toChainId));
      const evmDstRpc: SourceRpc | undefined = solanaDestination
        ? undefined
        : new SourceRpc(resolveChainRpcUrl(cfg, dstChain));
      const solanaDstRpc: SolanaRpc | undefined = solanaDestination
        ? new SolanaRpc(cfg.solanaRpcUrl)
        : undefined;

      return runGaslessTrade({
        cfg,
        args,
        api: gaslessApi,
        tradeWallets,
        evmSrcRpc,
        evmDstRpc,
        solanaSrcRpc,
        solanaDstRpc,
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
    const message: string = error instanceof Error ? error.message : String(error);
    process.stderr.write(`✗ gasless-sdk failed: ${message}\n`);
    process.exitCode = 1;
  });
