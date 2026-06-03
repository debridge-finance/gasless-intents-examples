import "dotenv/config";
import {
  createPublicClient,
  createWalletClient,
  http,
  type Abi,
  type Account,
  type Address,
  type Hex,
  type PublicClient,
  type WalletClient,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";

export type BaseClients = {
  account: Account;
  publicClient: PublicClient;
  walletClient: WalletClient;
};

export function getBaseClients(): BaseClients {
  const rawKey = process.env.SIGNER_PK;
  if (!rawKey) throw new Error("SIGNER_PK is not set in .env");
  const pk = (rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`) as Hex;
  const rpcUrl = process.env.BASE_RPC_URL || "https://mainnet.base.org";

  const account = privateKeyToAccount(pk);
  const transport = http(rpcUrl);
  const publicClient = createPublicClient({ chain: base, transport }) as unknown as PublicClient;
  const walletClient = createWalletClient({ account, chain: base, transport }) as unknown as WalletClient;

  return { account, publicClient, walletClient };
}

export const ZERO_BYTES32 = "0x0000000000000000000000000000000000000000000000000000000000000000" as Hex;

/**
 * Thin wrappers around viem's read/write that swallow the ABI-generic typing
 * issues common to runtime utilities (where ABIs are loaded from JSON
 * artefacts as `Abi`, not `const`). The body is straight viem; the `as any`
 * is purely to satisfy the strict-generic overloads.
 */
export async function readView<T>(
  publicClient: PublicClient,
  opts: { address: Address; abi: Abi; functionName: string; args?: readonly unknown[] },
): Promise<T> {
  return (await publicClient.readContract(opts as any)) as T;
}

export async function writeTx(
  walletClient: WalletClient,
  publicClient: PublicClient,
  account: Account,
  opts: { address: Address; abi: Abi; functionName: string; args?: readonly unknown[]; gas?: bigint },
): Promise<Hex> {
  const hash = (await walletClient.writeContract({
    ...opts,
    account,
    chain: base,
  } as any)) as Hex;
  return hash;
}

export type LogWithTopics = { topics: readonly Hex[]; data: Hex };

export function firstEventLog(logs: readonly unknown[]): LogWithTopics {
  for (const raw of logs as LogWithTopics[]) {
    if (raw.topics && raw.topics[0] !== undefined) return raw;
  }
  throw new Error("No event log in receipt");
}
