import { createPublicClient, http, type Address } from "viem";
import { Connection, PublicKey } from "@solana/web3.js";
import { CHAIN_IDS } from "@utils/chains";
import { EVM_NATIVE_TOKEN, SOL_NATIVE } from "@utils/constants";
import { Erc20Abi } from "@utils/contract-calls/abis";
import { ChainName, evmChainConfig, tokenRegistry } from "./tokens";
import { Holding } from "./holding";

/** Delay between sequential per-chain RPC calls to stay within rate limits. */
const DELAY_BETWEEN_CHAINS_MS = 200;

const sleep = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

/** Retries a call on HTTP 429 (rate limit) with exponential backoff. */
async function withRetry<T>(
  fn: () => Promise<T>,
  { retries = 3, baseDelayMs = 1000 }: { retries?: number; baseDelayMs?: number } = {},
): Promise<T> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      const isRateLimited =
        error?.status === 429 || error?.code === 429 || String(error?.message).includes("429");
      if (attempt === retries || !isRateLimited) throw error;
      const delay = baseDelayMs * 2 ** attempt;
      console.warn(`  ⚠ 429 rate limited, retrying in ${delay}ms (attempt ${attempt + 1}/${retries})...`);
      await sleep(delay);
    }
  }
  throw new Error("unreachable");
}

/** Native + registry-token balances across every configured EVM chain. */
export async function collectEvmHoldings(evmAddress: Address): Promise<Holding[]> {
  const holdings: Holding[] = [];
  const chainNames = Object.keys(evmChainConfig) as ChainName[];

  for (const chainName of chainNames) {
    const { envKey, chain, chainId, nativeSymbol } = evmChainConfig[chainName];
    const rpcUrl = process.env[envKey];
    if (!rpcUrl) {
      console.warn(`⚠ ${envKey} not set — skipping ${chainName}`);
      continue;
    }

    const client = createPublicClient({ chain, transport: http(rpcUrl) });

    const tokensOnChain = Object.entries(tokenRegistry)
      .filter(([, chains]) => chains[chainName])
      .map(([symbol, chains]) => ({
        symbol,
        address: chains[chainName]!.address as Address,
        decimals: chains[chainName]!.decimals,
      }));

    type MulticallResult = { status: "success"; result: bigint } | { status: "failure"; error: Error };

    const [nativeBalance, multicallResults] = await withRetry(() =>
      Promise.all([
        client.getBalance({ address: evmAddress }),
        client.multicall({
          contracts: tokensOnChain.map((token) => ({
            address: token.address,
            abi: Erc20Abi.Balance,
            functionName: "balanceOf" as const,
            args: [evmAddress] as const,
          })),
        } as never) as Promise<MulticallResult[]>,
      ]),
    );

    if (nativeBalance > 0n) {
      holdings.push({
        chainName, chainId, symbol: nativeSymbol, tokenAddress: EVM_NATIVE_TOKEN,
        isNative: true, rawBalance: nativeBalance, decimals: 18,
      });
    }

    tokensOnChain.forEach((token, index) => {
      const result = multicallResults[index];
      const rawBalance = result.status === "success" ? result.result : 0n;
      if (rawBalance > 0n) {
        holdings.push({
          chainName, chainId, symbol: token.symbol, tokenAddress: token.address,
          isNative: false, rawBalance, decimals: token.decimals,
        });
      }
    });

    if (chainNames.indexOf(chainName) < chainNames.length - 1) await sleep(DELAY_BETWEEN_CHAINS_MS);
  }

  return holdings;
}

/** Native SOL + every non-zero SPL token account on Solana (full balances). */
export async function collectSolanaHoldings(connection: Connection, owner: PublicKey): Promise<Holding[]> {
  const holdings: Holding[] = [];
  const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");

  const [nativeLamports, tokenAccounts] = await Promise.all([
    connection.getBalance(owner),
    connection.getParsedTokenAccountsByOwner(owner, { programId: TOKEN_PROGRAM_ID }),
  ]);

  if (nativeLamports > 0) {
    holdings.push({
      chainName: "Solana", chainId: CHAIN_IDS.Solana, symbol: "SOL", tokenAddress: SOL_NATIVE,
      isNative: true, rawBalance: BigInt(nativeLamports), decimals: 9,
    });
  }

  // Reverse-map mint -> known symbol for nicer logs (best effort).
  const mintToSymbol = new Map<string, string>();
  for (const [symbol, chains] of Object.entries(tokenRegistry)) {
    if (chains.Solana) mintToSymbol.set(chains.Solana.address, symbol);
  }

  for (const { account } of tokenAccounts.value) {
    const info = account.data.parsed.info;
    const rawBalance = BigInt(info.tokenAmount.amount);
    if (rawBalance <= 0n) continue;
    holdings.push({
      chainName: "Solana",
      chainId: CHAIN_IDS.Solana,
      symbol: mintToSymbol.get(info.mint) ?? `SPL(${info.mint.slice(0, 4)}…)`,
      tokenAddress: info.mint,
      isNative: false,
      rawBalance,
      decimals: info.tokenAmount.decimals,
    });
  }

  return holdings;
}
