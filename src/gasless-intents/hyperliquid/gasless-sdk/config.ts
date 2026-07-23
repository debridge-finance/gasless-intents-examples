export interface AppConfig {
  apiBaseUrl: string;
  explorerApiUrl: string;
  gaslessApiUrl: string;
  gaslessSubmitUrl?: string;
  gaslessRefreshSolanaTxUrl: string;
  privateKey: string | undefined;
  solanaPrivateKey: string | undefined;
  solanaRecipient: string | undefined;
  solanaRpcUrl: string;
  rpcByChainId: Record<number, string>;
  maxOpexReserve: number;
  referralCode?: number;
  pollIntervalMs: number;
  pollTimeoutMs: number;
  deviationAlertBps: number;
  withdrawPollTimeoutMs: number;
  hyperEvmRpcUrl: string;
  escrowFactory: string;
  coreDebitToleranceBps: number;
  coreDebitToleranceUsd: number;
}

// The only value you need to set is HL_PRIVATE_KEY (see README). To deposit FROM
// Solana you also set HL_SOLANA_PRIVATE_KEY. Everything else below is a working
// deBridge default — you do NOT need to change any of it. The values are still read
// from the environment so they can be overridden if ever required.
const DEFAULTS = {
  apiBaseUrl: 'https://hl-spike.debridge.finance',
  explorerApiUrl: 'https://api-gaslessb2b.debridge.finance/v1/explorer',
  gaslessApiUrl: 'https://deswap.debridge.finance/v1.0/bundle',
  solanaRpcUrl: 'https://api.mainnet-beta.solana.com',
  maxOpexReserve: 1.15,
  pollIntervalMs: 3000,
  pollTimeoutMs: 600000,
  deviationAlertBps: 50,
  withdrawPollTimeoutMs: 1200000,
  hyperEvmRpcUrl: 'https://rpc.hyperliquid.xyz/evm',
  escrowFactory: '0xAd635f04134562D58B30C93676FBBdF37f5c6dAB',
  coreDebitToleranceBps: 200,
  coreDebitToleranceUsd: 1,
};

const PRIVATE_KEY_PATTERN: RegExp = /^(0x)?[0-9a-fA-F]{64}$/;
const RPC_ENV_KEY: RegExp = /^HL_RPC_(\d+)$/;
const URL_PATTERN: RegExp = /^https?:\/\//;

function readString(env: NodeJS.ProcessEnv, key: string, fallback: string): string {
  const value: string | undefined = env[key];
  return value !== undefined && value.trim().length > 0 ? value.trim() : fallback;
}

function readNumber(env: NodeJS.ProcessEnv, key: string, fallback: number): number {
  const value: string | undefined = env[key];
  if (value === undefined || value.trim().length === 0) {
    return fallback;
  }
  const parsed: number = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid gasless-sdk config: ${key} must be a number`);
  }
  return parsed;
}

function readOptional(env: NodeJS.ProcessEnv, key: string): string | undefined {
  const value: string | undefined = env[key];
  return value !== undefined && value.trim().length > 0 ? value.trim() : undefined;
}

function resolveRefreshSolanaTxUrl(gaslessApiUrl: string, explicit?: string): string {
  const trimmed: string | undefined = explicit?.trim();
  if (trimmed !== undefined && trimmed.length > 0) {
    return trimmed;
  }
  return `${gaslessApiUrl.replace(/\/$/, '')}/refresh-solana-tx`;
}

function resolvePrivateKey(env: NodeJS.ProcessEnv): string | undefined {
  const raw: string = (env.HL_PRIVATE_KEY ?? '').trim();
  if (raw.length === 0) {
    return undefined;
  }
  if (!PRIVATE_KEY_PATTERN.test(raw)) {
    throw new Error('HL_PRIVATE_KEY must be a 32-byte hex string (with or without a 0x prefix)');
  }
  return raw.startsWith('0x') ? raw : `0x${raw}`;
}

function buildRpcByChainId(env: NodeJS.ProcessEnv): Record<number, string> {
  const map: Record<number, string> = {};
  for (const [key, rawValue] of Object.entries(env)) {
    const match: RegExpMatchArray | null = key.match(RPC_ENV_KEY);
    if (match === null) {
      continue;
    }
    const value: string = (rawValue ?? '').trim();
    if (value.length === 0) {
      continue;
    }
    if (!URL_PATTERN.test(value)) {
      throw new Error(`Invalid gasless-sdk config: ${key} must be a valid URL`);
    }
    map[Number(match[1])] = value;
  }
  return map;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const escrowFactory: string = readString(env, 'HL_ESCROW_FACTORY', DEFAULTS.escrowFactory);
  if (!/^0x[0-9a-fA-F]{40}$/.test(escrowFactory)) {
    throw new Error('HL_ESCROW_FACTORY must be a 0x-prefixed 40-hex address');
  }
  const gaslessApiUrl: string = readString(env, 'GASLESS_API_URL', DEFAULTS.gaslessApiUrl);
  return {
    apiBaseUrl: readString(env, 'HL_API_BASE_URL', DEFAULTS.apiBaseUrl),
    explorerApiUrl: readString(env, 'HL_EXPLORER_API_URL', DEFAULTS.explorerApiUrl),
    gaslessApiUrl,
    gaslessSubmitUrl: readOptional(env, 'GASLESS_BUNDLE_SUBMIT_URL'),
    gaslessRefreshSolanaTxUrl: resolveRefreshSolanaTxUrl(
      gaslessApiUrl,
      readOptional(env, 'GASLESS_REFRESH_SOLANA_TX_URL'),
    ),
    privateKey: resolvePrivateKey(env),
    solanaPrivateKey: readOptional(env, 'HL_SOLANA_PRIVATE_KEY'),
    solanaRecipient: readOptional(env, 'HL_SOLANA_RECIPIENT'),
    solanaRpcUrl: readString(env, 'HL_SOLANA_RPC_URL', DEFAULTS.solanaRpcUrl),
    rpcByChainId: buildRpcByChainId(env),
    maxOpexReserve: readNumber(env, 'HL_MAX_OPEX_RESERVE', DEFAULTS.maxOpexReserve),
    referralCode: undefined,
    pollIntervalMs: readNumber(env, 'HL_POLL_INTERVAL_MS', DEFAULTS.pollIntervalMs),
    pollTimeoutMs: readNumber(env, 'HL_POLL_TIMEOUT_MS', DEFAULTS.pollTimeoutMs),
    deviationAlertBps: readNumber(env, 'HL_DEVIATION_ALERT_BPS', DEFAULTS.deviationAlertBps),
    withdrawPollTimeoutMs: readNumber(
      env,
      'HL_WITHDRAW_POLL_TIMEOUT_MS',
      DEFAULTS.withdrawPollTimeoutMs,
    ),
    hyperEvmRpcUrl: readString(env, 'HL_HYPEREVM_RPC_URL', DEFAULTS.hyperEvmRpcUrl),
    escrowFactory,
    coreDebitToleranceBps: readNumber(
      env,
      'HL_CORE_DEBIT_TOLERANCE_BPS',
      DEFAULTS.coreDebitToleranceBps,
    ),
    coreDebitToleranceUsd: readNumber(
      env,
      'HL_CORE_DEBIT_TOLERANCE_USD',
      DEFAULTS.coreDebitToleranceUsd,
    ),
  };
}
