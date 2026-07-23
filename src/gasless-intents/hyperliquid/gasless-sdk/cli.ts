import { Wallet } from 'ethers';
import { createColors } from 'picocolors';

import { ChainInfo, resolveRpcUrl } from './chains';
import { AppConfig } from './config';
import { ConsoleReporter, DepositReport, FlowReporter } from './report';

export interface CommonFlags {
  dryRun: boolean;
  account?: string;
  recipient?: string;
  dstAuthority?: string;
}

export const ADDRESS_PATTERN: RegExp = /^0x[0-9a-fA-F]{40}$/;
export const AMOUNT_PATTERN: RegExp = /^\d+(\.\d+)?$/;

export function emptyFlags(): CommonFlags {
  return { dryRun: false };
}

export function requireValue(argv: string[], index: number, label: string): string {
  const value: string | undefined = argv[index];
  if (value === undefined) {
    throw new Error(`Missing value for ${label}`);
  }
  return value;
}

export function requireAddress(raw: string, label: string): string {
  if (!ADDRESS_PATTERN.test(raw)) {
    throw new Error(`Invalid ${label} address "${raw}" (expected a 0x-prefixed 40-hex address)`);
  }
  return raw;
}

export function validateToken(token: string): string {
  if (token.startsWith('0x')) {
    return requireAddress(token, 'token');
  }
  return token;
}

function requireNonEmpty(raw: string, label: string): string {
  const value: string = raw.trim();
  if (value.length === 0) {
    throw new Error(`Invalid ${label}: value must not be empty`);
  }
  return value;
}

export function parseCommonFlag(argv: string[], index: number, flags: CommonFlags): number {
  switch (argv[index]) {
    case '--dry-run':
      flags.dryRun = true;
      return 1;
    case '--account':
      flags.account = requireAddress(requireValue(argv, index + 1, '--account'), '--account');
      return 2;
    case '--recipient':
      flags.recipient = requireNonEmpty(requireValue(argv, index + 1, '--recipient'), '--recipient');
      return 2;
    default:
      return 0;
  }
}

export interface ResolvedAuthority {
  account: string;
  wallet?: Wallet;
}

export function resolveAuthority(
  cfg: AppConfig,
  args: CommonFlags,
  label: string,
): ResolvedAuthority {
  const keyAddress: string | undefined =
    cfg.privateKey !== undefined ? new Wallet(cfg.privateKey).address : undefined;

  if (!args.dryRun) {
    if (cfg.privateKey === undefined || keyAddress === undefined) {
      throw new Error(
        `HL_PRIVATE_KEY is required for a real ${label} (it signs). Use --dry-run to preview ` +
          'without it.',
      );
    }
    if (args.account !== undefined && args.account.toLowerCase() !== keyAddress.toLowerCase()) {
      throw new Error(
        '--account only applies to --dry-run; a real run signs and authors as the ' +
          'HL_PRIVATE_KEY address',
      );
    }
    return { account: keyAddress, wallet: new Wallet(cfg.privateKey) };
  }

  const account: string | undefined = args.account ?? keyAddress;
  if (account === undefined) {
    throw new Error(
      '--dry-run needs an account address: pass --account <0xaddr> or set HL_PRIVATE_KEY',
    );
  }
  const wallet: Wallet | undefined =
    cfg.privateKey !== undefined ? new Wallet(cfg.privateKey) : undefined;
  return { account, wallet };
}

export function resolveChainRpcUrl(cfg: AppConfig, chain: ChainInfo): string {
  const url: string | undefined = resolveRpcUrl(cfg.rpcByChainId, chain.chainId);
  if (url === undefined) {
    throw new Error(
      `No RPC for ${chain.name}; set HL_RPC_${chain.chainId} in scripts/gasless-sdk/.env`,
    );
  }
  return url;
}

export function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    if (error.message.length > 0) {
      return error.message;
    }
    if (error.name.length > 0) {
      return error.name;
    }
    if ('code' in error) {
      const code: unknown = error.code;
      if (typeof code === 'string' && code.length > 0) {
        return code;
      }
    }
    return String(error);
  }
  return String(error);
}

export interface RunOptions {
  flags: CommonFlags;
  toolRoot: string;
  alertBps: number;
  flow: (reporter: FlowReporter) => Promise<DepositReport>;
  stdout?: (text: string) => void;
  stderr?: (text: string) => void;
}

export async function runCli(options: RunOptions): Promise<number> {
  const stderr: (text: string) => void =
    options.stderr ?? ((text: string): void => void process.stderr.write(text));

  const reporter: FlowReporter = new ConsoleReporter({ alertBps: options.alertBps });

  let report: DepositReport;
  try {
    report = await options.flow(reporter);
  } catch (error: unknown) {
    const colors: ReturnType<typeof createColors> = createColors(
      Boolean(process.stderr.isTTY) && !process.env.NO_COLOR,
    );
    stderr(`${colors.red(`✗ gasless-sdk failed: ${extractErrorMessage(error)}`)}\n`);
    return 1;
  }

  reporter.render(report);

  return 0;
}

export const TOKEN_ADDRESS_PATTERN: RegExp = /^0x[0-9a-fA-F]{40}$/;

export const EXPIRATION_WINDOW_SECONDS: number = 3600;

export const HEARTBEAT_MS: number = 15000;

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve: () => void): void => {
    setTimeout(resolve, ms);
  });
}

export function generateRequestId(): string {
  return `${Date.now()}${Math.random().toString(36).slice(2, 9)}`;
}
