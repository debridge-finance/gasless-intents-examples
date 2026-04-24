import "dotenv/config";
import { createPublicClient, http, formatUnits, type Address } from "viem";
import { polygon, bsc, base, arbitrum, optimism, mainnet } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { Connection, PublicKey, Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import { USDC, USDT, LINK, WBNB, WETH, WBTC, DAI, LINGO, SOL_JUP, DBR_SOL, SOLANA_RPC_URL } from "@utils/constants";

// --- Config ---

const erc20Abi = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

type ChainName = "Ethereum" | "Polygon" | "BNB" | "Base" | "Arbitrum" | "Optimism";

function createClients() {
  return {
    Ethereum: createPublicClient({ chain: mainnet, transport: http() }),
    Polygon: createPublicClient({ chain: polygon, transport: http(process.env.POLYGON_RPC_URL) }),
    BNB: createPublicClient({ chain: bsc, transport: http(process.env.BNB_RPC_URL) }),
    Base: createPublicClient({ chain: base, transport: http(process.env.BASE_RPC_URL) }),
    Arbitrum: createPublicClient({ chain: arbitrum, transport: http(process.env.ARB_RPC_URL) }),
    Optimism: createPublicClient({ chain: optimism, transport: http(process.env.OPTIMISM_RPC_URL) }),
  };
}

const nativeSymbols: Record<ChainName, string> = {
  Ethereum: "ETH",
  Polygon: "MATIC",
  BNB: "BNB",
  Base: "ETH",
  Arbitrum: "ETH",
  Optimism: "ETH",
};

// Token definitions: name -> { chainName -> { address, decimals } }
const tokenRegistry: Record<string, Partial<Record<ChainName | "Solana", { address: string; decimals: number }>>> = {
  USDC: {
    Ethereum: { address: USDC.Ethereum, decimals: 6 },
    Polygon: { address: USDC.Polygon, decimals: 6 },
    BNB: { address: USDC.BNB, decimals: 18 },
    Base: { address: USDC.Base, decimals: 6 },
    Arbitrum: { address: USDC.Arbitrum, decimals: 6 },
    Optimism: { address: USDC.Optimism, decimals: 6 },
    Solana: { address: USDC.Solana, decimals: 6 },
  },
  USDT: {
    Ethereum: { address: USDT.Ethereum, decimals: 6 },
    Polygon: { address: USDT.Polygon, decimals: 6 },
    BNB: { address: USDT.BNB, decimals: 18 },
    Arbitrum: { address: USDT.Arbitrum, decimals: 6 },
    Base: { address: USDT.Base, decimals: 6 },
    Solana: { address: USDT.Solana, decimals: 6 },
  },
  DAI: {
    Polygon: { address: DAI.Polygon, decimals: 18 },
    Arbitrum: { address: DAI.Arbitrum, decimals: 18 },
    Ethereum: { address: DAI.Ethereum, decimals: 18 },
  },
  WETH: {
    Ethereum: { address: WETH.Ethereum, decimals: 18 },
    Polygon: { address: WETH.Polygon, decimals: 18 },
  },
  LINK: {
    Polygon: { address: LINK.Polygon, decimals: 18 },
  },
  WBNB: {
    BNB: { address: WBNB.BNB, decimals: 18 },
  },
  WBTC: {
    Ethereum: { address: WBTC.Ethereum, decimals: 8 },
  },
  LINGO: {
    Base: { address: LINGO.Base, decimals: 18 },
  },
  WSOL: {
    Solana: { address: "So11111111111111111111111111111111111111112", decimals: 9 },
  },
  JUP: {
    Solana: { address: SOL_JUP, decimals: 6 },
  },
  DBR: {
    Solana: { address: DBR_SOL, decimals: 6 },
  },
};

// --- Main ---

async function main() {
  const privateKey = process.env.SIGNER_PK;
  const solPrivateKey = process.env.SOL_PK;

  if (!privateKey) throw new Error("SIGNER_PK not found in .env");
  if (!solPrivateKey) throw new Error("SOL_PK not found in .env");

  const account = privateKeyToAccount(privateKey as `0x${string}`);
  const solKeypair = Keypair.fromSecretKey(bs58.decode(solPrivateKey));
  const evmAddress = account.address;
  const solAddress = solKeypair.publicKey.toBase58();

  console.log("=== Wallet Balances ===");
  console.log(`EVM Address: ${evmAddress}`);
  console.log(`Solana Address: ${solAddress}`);

  const clients = createClients();
  const solRpcUrl = process.env.SOL_RPC_URL || SOLANA_RPC_URL;
  const solConnection = new Connection(solRpcUrl, "confirmed");

  const evmChainNames = Object.keys(clients) as ChainName[];

  // Fetch all EVM balances in parallel (per chain: 1 native + N readContract via multicall)
  const evmResults = await Promise.all(
    evmChainNames.map(async (chainName) => {
      const client = clients[chainName];

      const tokensOnChain = Object.entries(tokenRegistry)
        .filter(([, chains]) => chains[chainName])
        .map(([tokenName, chains]) => ({
          tokenName,
          address: chains[chainName]!.address as Address,
          decimals: chains[chainName]!.decimals,
        }));

      const multicallContracts = tokensOnChain.map((t) => ({
        address: t.address,
        abi: erc20Abi,
        functionName: "balanceOf" as const,
        args: [evmAddress] as const,
      }));

      type MulticallResult = { status: "success"; result: bigint } | { status: "failure"; error: Error };

      const [nativeBalance, multicallResults] = await Promise.all([
        client.getBalance({ address: evmAddress }),
        client.multicall({ contracts: multicallContracts } as never) as Promise<MulticallResult[]>,
      ]);

      const tokenBalances = tokensOnChain.map((t, i) => {
        const result = multicallResults[i];
        const rawBalance = result.status === "success" ? result.result : BigInt(0);
        return {
          tokenName: t.tokenName,
          balance: formatUnits(rawBalance, t.decimals),
        };
      });

      return {
        chainName,
        nativeSymbol: nativeSymbols[chainName],
        nativeBalance: formatUnits(nativeBalance, 18),
        tokenBalances,
      };
    }),
  );

  // Solana: native + all SPL tokens in one call
  const solanaResult = await (async () => {
    const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");

    const [nativeLamports, tokenAccounts] = await Promise.all([
      solConnection.getBalance(solKeypair.publicKey),
      solConnection.getParsedTokenAccountsByOwner(solKeypair.publicKey, {
        programId: TOKEN_PROGRAM_ID,
      }),
    ]);

    const mintBalances = new Map<string, { uiAmount: number; decimals: number }>();
    for (const { account } of tokenAccounts.value) {
      const info = account.data.parsed.info;
      mintBalances.set(info.mint, {
        uiAmount: info.tokenAmount.uiAmount ?? 0,
        decimals: info.tokenAmount.decimals,
      });
    }

    const solTokens = Object.entries(tokenRegistry)
      .filter(([, chains]) => chains.Solana)
      .map(([tokenName, chains]) => {
        const mint = chains.Solana!.address;
        const found = mintBalances.get(mint);
        return {
          tokenName,
          balance: found ? found.uiAmount.toString() : "0",
        };
      });

    return {
      nativeBalance: (nativeLamports / 1e9).toString(),
      tokenBalances: solTokens,
    };
  })();

  // --- Print Report ---

  console.log("\nNATIVE");
  for (const r of evmResults) {
    console.log(`  ${r.chainName}: ${r.nativeBalance} ${r.nativeSymbol}`);
  }
  console.log(`  Solana: ${solanaResult.nativeBalance} SOL`);

  const allTokenNames = Object.keys(tokenRegistry);
  for (const tokenName of allTokenNames) {
    const lines: string[] = [];

    for (const r of evmResults) {
      const entry = r.tokenBalances.find((t) => t.tokenName === tokenName);
      if (entry) {
        lines.push(`  ${r.chainName}: ${entry.balance}`);
      }
    }

    const solEntry = solanaResult.tokenBalances.find((t) => t.tokenName === tokenName);
    if (solEntry) {
      lines.push(`  Solana: ${solEntry.balance}`);
    }

    if (lines.length > 0) {
      console.log(`\n${tokenName}`);
      for (const line of lines) {
        console.log(line);
      }
    }
  }
}

main().catch(console.error);
