import { parseAbi, PublicClient } from "viem";

import { BASE_URL, BUNDLES, HYPEREVM, SOLANA_RPC_URL, V1_BASE } from "./constants";
import { getHeaders } from "./env";
import { getPublicJsonHeaders } from "./http";

export const HYPERCORE_INFO_URL = "https://api.hyperliquid.xyz/info";
export const gaslessBundleUrl = (bundleId: string): string =>
  `${BASE_URL}${V1_BASE}${BUNDLES}/${bundleId}`;
export const explorerBundleUrl = (bundleId: string): string =>
  `${BASE_URL}/v1/explorer/bundles/${bundleId}`;

export type Fetched = { status: number; body: unknown };

async function getJson(url: string, headers: Headers): Promise<Fetched> {
  const response = await fetch(url, { method: "GET", headers });
  const text = await response.text();
  let body: unknown = text;
  try {
    body = JSON.parse(text);
  } catch {
  }
  return { status: response.status, body };
}

export function fetchGaslessBundle(bundleId: string): Promise<Fetched> {
  return getJson(gaslessBundleUrl(bundleId), getHeaders());
}

export function fetchExplorerBundle(bundleId: string): Promise<Fetched> {
  return getJson(explorerBundleUrl(bundleId), getPublicJsonHeaders());
}

export type SpotBalance = { coin: string; total: string; hold: string };

export async function fetchHyperCoreSpotBalances(user: string): Promise<SpotBalance[]> {
  const response = await fetch(HYPERCORE_INFO_URL, {
    method: "POST",
    headers: getPublicJsonHeaders(),
    body: JSON.stringify({ type: "spotClearinghouseState", user }),
  });
  if (!response.ok) {
    throw new Error(`HyperCore info API responded ${response.status}`);
  }
  const json = (await response.json()) as { balances?: SpotBalance[] };
  return json.balances ?? [];
}

export function spotTotal(balances: SpotBalance[], coin: string): string {
  return balances.find((balance) => balance.coin === coin)?.total ?? "0";
}

const ERC20_BALANCE_ABI = parseAbi(["function balanceOf(address owner) view returns (uint256)"]);

export async function fetchErc20Balance(
  client: Pick<PublicClient, "readContract">,
  token: `0x${string}`,
  owner: `0x${string}`,
): Promise<bigint> {
  const result = await client.readContract(
    { address: token, abi: ERC20_BALANCE_ABI, functionName: "balanceOf", args: [owner] } as any,
  );
  return BigInt(String(result));
}

export async function fetchNativeBalance(
  client: Pick<PublicClient, "getBalance">,
  address: `0x${string}`,
): Promise<bigint> {
  return client.getBalance({ address });
}

const EXECUTOR_ABI = parseAbi(["function getSpotSendStatus(bytes32 orderId) view returns (uint8)"]);
export const SPOT_SEND_STATUS = ["NotStarted", "AwaitingCoreTransfer", "TransferCompleted"] as const;

export async function fetchSpotSendStatus(
  client: Pick<PublicClient, "readContract">,
  orderId: string,
  executor: `0x${string}` = HYPEREVM.spotSendExecutor as `0x${string}`,
): Promise<string> {
  const code = Number(
    await client.readContract(
      { address: executor, abi: EXECUTOR_ABI, functionName: "getSpotSendStatus", args: [orderId] } as any,
    ),
  );
  return `${code}:${SPOT_SEND_STATUS[code] ?? "unknown"}`;
}

export type PerpsState = { accountValue: string; withdrawable: string; totalRawUsd: string };

export async function fetchHyperCorePerpsState(user: string): Promise<PerpsState> {
  const response = await fetch(HYPERCORE_INFO_URL, {
    method: "POST",
    headers: getPublicJsonHeaders(),
    body: JSON.stringify({ type: "clearinghouseState", user }),
  });
  if (!response.ok) {
    throw new Error(`HyperCore info API responded ${response.status}`);
  }
  const json = (await response.json()) as {
    marginSummary?: { accountValue?: string; totalRawUsd?: string };
    withdrawable?: string;
  };
  return {
    accountValue: json.marginSummary?.accountValue ?? "0",
    withdrawable: json.withdrawable ?? "0",
    totalRawUsd: json.marginSummary?.totalRawUsd ?? "0",
  };
}

export async function fetchHyperCoreLedgerUpdates(user: string, startTimeMs: number): Promise<unknown[]> {
  const response = await fetch(HYPERCORE_INFO_URL, {
    method: "POST",
    headers: getPublicJsonHeaders(),
    body: JSON.stringify({ type: "userNonFundingLedgerUpdates", user, startTime: startTimeMs }),
  });
  if (!response.ok) {
    throw new Error(`HyperCore info API responded ${response.status}`);
  }
  return (await response.json()) as unknown[];
}

export async function fetchSolanaTokenBalance(
  owner: string,
  mint: string,
  rpcUrl: string = process.env.SOL_RPC_URL ?? SOLANA_RPC_URL,
): Promise<bigint> {
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: getPublicJsonHeaders(),
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "getTokenAccountsByOwner",
      params: [owner, { mint }, { encoding: "jsonParsed" }],
    }),
  });
  const json = (await response.json()) as {
    result?: {
      value?: Array<{ account: { data: { parsed: { info: { tokenAmount: { amount: string } } } } } }>;
    };
  };
  return (json.result?.value ?? []).reduce(
    (sum, account) => sum + BigInt(account.account.data.parsed.info.tokenAmount.amount),
    0n,
  );
}

export async function fetchHyperCoreUserRole(user: string): Promise<string> {
  const response = await fetch(HYPERCORE_INFO_URL, {
    method: "POST",
    headers: getPublicJsonHeaders(),
    body: JSON.stringify({ type: "userRole", user }),
  });
  if (!response.ok) {
    throw new Error(`HyperCore info API responded ${response.status}`);
  }
  const json = (await response.json()) as { role?: string };
  return json.role ?? "?";
}

export function spotBalanceMap(balances: SpotBalance[]): Record<string, string> {
  return Object.fromEntries(
    balances.filter((balance) => Number(balance.total) !== 0).map((balance) => [balance.coin, balance.total]),
  );
}

export type HyperEvmTx = {
  hash: string;
  blockNumber: string;
  timeStamp: string;
  from: string;
  to: string;
  value: string;
  input: string;
  isError?: string;
  methodId?: string;
  functionName?: string;
  txreceipt_status?: string;
};

export async function fetchHyperEvmTxList(
  address: string,
  options: { sinceMs?: number; internal?: boolean; limit?: number } = {},
): Promise<{ status: string; message: string; result: HyperEvmTx[] }> {
  const apiKey = process.env.ETHERSCAN_API_KEY;
  if (!apiKey) throw new Error("Missing ETHERSCAN_API_KEY in .env");
  const params = new URLSearchParams({
    chainid: "999",
    module: "account",
    action: options.internal ? "txlistinternal" : "txlist",
    address,
    startblock: "0",
    endblock: "999999999",
    page: "1",
    offset: String(options.limit ?? 100),
    sort: "desc",
    apikey: apiKey,
  });
  const response = await fetch(`https://api.etherscan.io/v2/api?${params.toString()}`, {
    method: "GET",
    headers: getPublicJsonHeaders(),
  });
  if (!response.ok) {
    throw new Error(`Etherscan API responded ${response.status}`);
  }
  const json = (await response.json()) as { status: string; message: string; result: HyperEvmTx[] | string };
  const rows = Array.isArray(json.result) ? json.result : [];
  const since = options.sinceMs ?? 0;
  return {
    status: json.status,
    message: typeof json.result === "string" ? `${json.message}: ${json.result}` : json.message,
    result: rows.filter((tx) => Number(tx.timeStamp) * 1000 >= since),
  };
}
