import { Contract, JsonRpcProvider, MaxUint256, TransactionResponse, Wallet } from 'ethers';

export interface ChainInfo {
  chainId: number;
  name: string;
  aliases: string[];
  txUrl: (hash: string) => string;
  addressUrl: (address: string) => string;
  defaultRpcUrl: string;
}

export const HYPERLIQUID_CORE_CHAIN_ID: number = 200000001;

export function isHyperLiquidChainId(chainId: number): boolean {
  return chainId === HYPERLIQUID_CORE_CHAIN_ID;
}

export function hyperliquidTxUrl(hash: string): string {
  return `https://app.hyperliquid.xyz/explorer/tx/${hash}`;
}
export function hyperliquidAddressUrl(address: string): string {
  return `https://app.hyperliquid.xyz/explorer/address/${address}`;
}

function explorerTxUrl(host: string): (hash: string) => string {
  return (hash: string): string => `https://${host}/tx/${hash}`;
}

function explorerAddressUrl(host: string): (address: string) => string {
  return (address: string): string => `https://${host}/address/${address}`;
}

export const SOLANA_CHAIN_ID: number = 7565164;

export function isSolanaChainId(chainId: number): boolean {
  return chainId === SOLANA_CHAIN_ID;
}

export function isCrossVmTrade(fromChainId: number, toChainId: number): boolean {
  return isSolanaChainId(fromChainId) !== isSolanaChainId(toChainId);
}

export function isSolanaOnRoute(fromChainId: number, toChainId: number): boolean {
  return isSolanaChainId(fromChainId) || isSolanaChainId(toChainId);
}

export function shouldUsePermitQuoteMode(fromChainId: number, toChainId: number): boolean {
  return !isSolanaChainId(fromChainId) && isSolanaOnRoute(fromChainId, toChainId);
}

export const SUPPORTED_SOURCE_CHAINS: ChainInfo[] = [
  {
    chainId: 1,
    name: 'Ethereum',
    aliases: ['eth', 'ethereum'],
    txUrl: explorerTxUrl('etherscan.io'),
    addressUrl: explorerAddressUrl('etherscan.io'),
    defaultRpcUrl: 'https://ethereum-rpc.publicnode.com',
  },
  {
    chainId: 10,
    name: 'Optimism',
    aliases: ['op', 'optimism'],
    txUrl: explorerTxUrl('optimistic.etherscan.io'),
    addressUrl: explorerAddressUrl('optimistic.etherscan.io'),
    defaultRpcUrl: 'https://optimism-rpc.publicnode.com',
  },
  {
    chainId: 56,
    name: 'BNB',
    aliases: ['bnb', 'bsc', 'binance'],
    txUrl: explorerTxUrl('bscscan.com'),
    addressUrl: explorerAddressUrl('bscscan.com'),
    defaultRpcUrl: 'https://bsc-rpc.publicnode.com',
  },
  {
    chainId: 100,
    name: 'Gnosis',
    aliases: ['gnosis', 'xdai'],
    txUrl: explorerTxUrl('gnosisscan.io'),
    addressUrl: explorerAddressUrl('gnosisscan.io'),
    defaultRpcUrl: 'https://gnosis-rpc.publicnode.com',
  },
  {
    chainId: 137,
    name: 'Polygon',
    aliases: ['polygon', 'matic'],
    txUrl: explorerTxUrl('polygonscan.com'),
    addressUrl: explorerAddressUrl('polygonscan.com'),
    defaultRpcUrl: 'https://polygon-bor-rpc.publicnode.com',
  },
  {
    chainId: 8453,
    name: 'Base',
    aliases: ['base'],
    txUrl: explorerTxUrl('basescan.org'),
    addressUrl: explorerAddressUrl('basescan.org'),
    defaultRpcUrl: 'https://base-rpc.publicnode.com',
  },
  {
    chainId: 42161,
    name: 'Arbitrum',
    aliases: ['arbitrum', 'arb'],
    txUrl: explorerTxUrl('arbiscan.io'),
    addressUrl: explorerAddressUrl('arbiscan.io'),
    defaultRpcUrl: 'https://arbitrum-one-rpc.publicnode.com',
  },
  {
    chainId: 43114,
    name: 'Avalanche',
    aliases: ['avalanche', 'avax'],
    txUrl: explorerTxUrl('snowtrace.io'),
    addressUrl: explorerAddressUrl('snowtrace.io'),
    defaultRpcUrl: 'https://avalanche-c-chain-rpc.publicnode.com',
  },
  {
    chainId: 59144,
    name: 'Linea',
    aliases: ['linea'],
    txUrl: explorerTxUrl('lineascan.build'),
    addressUrl: explorerAddressUrl('lineascan.build'),
    defaultRpcUrl: 'https://linea-rpc.publicnode.com',
  },
  {
    chainId: SOLANA_CHAIN_ID,
    name: 'Solana',
    aliases: ['sol', 'solana'],
    txUrl: (hash: string): string => `https://solscan.io/tx/${hash}`,
    addressUrl: (address: string): string => `https://solscan.io/account/${address}`,
    defaultRpcUrl: 'https://api.mainnet-beta.solana.com',
  },
];

function supportedChainsSummary(): string {
  return SUPPORTED_SOURCE_CHAINS.map(
    (chain: ChainInfo): string => `${chain.name}(${chain.chainId})`,
  ).join(', ');
}

export function resolveSourceChain(nameOrId: string): ChainInfo {
  const needle: string = nameOrId.trim().toLowerCase();

  if (/^\d+$/.test(needle)) {
    const byId: ChainInfo | undefined = SUPPORTED_SOURCE_CHAINS.find(
      (chain: ChainInfo): boolean => chain.chainId === Number(needle),
    );
    if (byId !== undefined) {
      return byId;
    }
  }

  const byName: ChainInfo | undefined = SUPPORTED_SOURCE_CHAINS.find(
    (chain: ChainInfo): boolean =>
      chain.name.toLowerCase() === needle ||
      chain.aliases.some((alias: string): boolean => alias.toLowerCase() === needle),
  );
  if (byName !== undefined) {
    return byName;
  }

  throw new Error(`Unknown source chain "${nameOrId}". Supported: ${supportedChainsSummary()}`);
}

export function defaultRpcUrl(chainId: number): string | undefined {
  return SUPPORTED_SOURCE_CHAINS.find((chain: ChainInfo): boolean => chain.chainId === chainId)
    ?.defaultRpcUrl;
}

export function resolveRpcUrl(
  rpcByChainId: Record<number, string>,
  chainId: number,
): string | undefined {
  return rpcByChainId[chainId] ?? defaultRpcUrl(chainId);
}

export interface Erc20ReadContract {
  balanceOf(owner: string): Promise<bigint>;
  allowance(owner: string, spender: string): Promise<bigint>;
  decimals(): Promise<bigint>;
}

export type Erc20ContractFactory = (token: string) => Erc20ReadContract;

export type ApproveSender = (wallet: Wallet, token: string, spender: string) => Promise<string>;

const ERC20_ABI: string[] = [
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function decimals() view returns (uint8)',
];

const ERC20_WRITE_ABI: string[] = [
  'function approve(address spender, uint256 amount) returns (bool)',
];

export class SourceRpc {
  private readonly contractFactory: Erc20ContractFactory;
  private readonly approveSender: ApproveSender;

  constructor(
    rpcUrl: string,
    contractFactory?: Erc20ContractFactory,
    approveSender?: ApproveSender,
  ) {
    this.approveSender =
      approveSender ??
      (async (wallet: Wallet, token: string, spender: string): Promise<string> => {
        const provider: JsonRpcProvider = new JsonRpcProvider(rpcUrl);
        const erc20: Contract = new Contract(token, ERC20_WRITE_ABI, wallet.connect(provider));
        const tx: TransactionResponse = await erc20.approve(spender, MaxUint256);
        await tx.wait(1);
        return tx.hash;
      });
    if (contractFactory !== undefined) {
      this.contractFactory = contractFactory;
      return;
    }
    const provider: JsonRpcProvider = new JsonRpcProvider(rpcUrl);
    this.contractFactory = (token: string): Erc20ReadContract => {
      const contract: Contract = new Contract(token, ERC20_ABI, provider);
      return {
        balanceOf: (owner: string): Promise<bigint> => contract.balanceOf(owner),
        allowance: (owner: string, spender: string): Promise<bigint> =>
          contract.allowance(owner, spender),
        decimals: (): Promise<bigint> => contract.decimals(),
      };
    };
  }

  async approveUnlimited(wallet: Wallet, token: string, spender: string): Promise<string> {
    return this.approveSender(wallet, token, spender);
  }

  async decimals(token: string): Promise<number> {
    const raw: bigint = await this.contractFactory(token).decimals();
    return Number(raw);
  }

  async balanceOf(token: string, owner: string): Promise<bigint> {
    return this.contractFactory(token).balanceOf(owner);
  }

  async allowance(token: string, owner: string, spender: string): Promise<bigint> {
    return this.contractFactory(token).allowance(owner, spender);
  }
}

export const FALLBACK_USDC_ADDRESSES: Record<string, string> = {
  Arbitrum: '0xaf88d065e77c8cc2239327c5edb3a432268e5831',
  Polygon: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
  Solana: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
};

export const SOLANA_NATIVE_MINT: string = '11111111111111111111111111111111';

export const FALLBACK_SOLANA_DECIMALS: Record<string, number> = {
  [SOLANA_NATIVE_MINT]: 9,
  EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: 6,
};

export const FALLBACK_SOLANA_SYMBOLS: Record<string, string> = {
  USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  SOL: SOLANA_NATIVE_MINT,
};

export function resolveSolanaTokenAddress(tokenArg: string): string {
  const upper = tokenArg.toUpperCase();
  const bySymbol = FALLBACK_SOLANA_SYMBOLS[upper];
  if (bySymbol !== undefined) {
    return bySymbol;
  }
  if (tokenArg.startsWith('0x')) {
    throw new Error(
      `Solana tokens must be a symbol (USDC, SOL) or a base58 mint address, not "${tokenArg}".`,
    );
  }
  return tokenArg;
}

export interface BalanceReader {
  decimals(tokenAddress: string): Promise<number>;
  balanceOf(tokenAddress: string, ownerAddress: string): Promise<bigint>;
}

export interface HyperCoreTokenConstant {
  readonly address: string;
  readonly coreDecimals: number;
  readonly usdPrice: string;
}

export const FALLBACK_HYPERCORE_TOKENS: Record<string, HyperCoreTokenConstant> = {
  USDC: { address: '0xb88339CB7199b77E23DB6E890353E22632Ba630f', coreDecimals: 8, usdPrice: '1.0' },
};

export interface CoreSourceToken {
  symbol: string;
  address: string;
  tokenId?: string;
  coreDecimals?: number;
  evmDecimals?: number;
  verified: boolean;
}

interface CoreTokenConstant {
  readonly address: string;
  readonly tokenId: string;
  readonly coreDecimals: number;
  readonly evmDecimals: number;
}

export const ZERO_ADDRESS: string = '0x0000000000000000000000000000000000000000';
export const WHYPE_ADDRESS: string = '0x5555555555555555555555555555555555555555';

export const CORE_SOURCE_TOKENS: Record<string, CoreTokenConstant> = {
  USDC: {
    address: '0xb88339CB7199b77E23DB6E890353E22632Ba630f',
    tokenId: '0x6d1e7cde53ba9467b783cb7c530ce054',
    coreDecimals: 8,
    evmDecimals: 6,
  },
  HYPE: {
    address: WHYPE_ADDRESS,
    tokenId: '0x0d01dc56dcaaca66ad901c959b4011ec',
    coreDecimals: 8,
    evmDecimals: 18,
  },
};

const ADDRESS_PATTERN: RegExp = /^0x[0-9a-fA-F]{40}$/;

function toCoreSourceToken(symbol: string, constant: CoreTokenConstant): CoreSourceToken {
  return {
    symbol,
    address: constant.address,
    tokenId: constant.tokenId,
    coreDecimals: constant.coreDecimals,
    evmDecimals: constant.evmDecimals,
    verified: true,
  };
}

export function resolveCoreSourceToken(tokenArg: string): CoreSourceToken {
  if (ADDRESS_PATTERN.test(tokenArg)) {
    const needle: string =
      tokenArg.toLowerCase() === ZERO_ADDRESS
        ? WHYPE_ADDRESS.toLowerCase()
        : tokenArg.toLowerCase();
    for (const [symbol, constant] of Object.entries(CORE_SOURCE_TOKENS)) {
      if (constant.address.toLowerCase() === needle) {
        return toCoreSourceToken(symbol, constant);
      }
    }
    return { symbol: tokenArg, address: tokenArg, verified: false };
  }

  const upper: string = tokenArg.toUpperCase();
  const constant: CoreTokenConstant | undefined = CORE_SOURCE_TOKENS[upper];
  if (constant === undefined) {
    throw new Error(
      `Unsupported HyperCore source token "${tokenArg}". Supported symbols: ` +
        `${Object.keys(CORE_SOURCE_TOKENS).join(', ')}. Any other asset must be passed as its ` +
        `HyperEVM 0x address.`,
    );
  }
  return toCoreSourceToken(upper, constant);
}
