/**
 * Sanity call against the deployed EchoWithSig contract on Base. Signs an
 * EIP-712 EchoMessage as the caller and submits `echoWithSig(...)`. Decodes
 * the `MessageEchoed` event from the receipt and verifies it matches the
 * signed payload.
 *
 * EchoWithSig address is read from `solidity/build-artefacts/deployed-base.json`.
 */
import "dotenv/config";
import { randomBytes } from "node:crypto";
import {
  createPublicClient,
  createWalletClient,
  decodeEventLog,
  http,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";
import { loadAbi } from "@gasless-intents/interactions/contract-utils/shared/artefact-loader";
import { requireDeployedAddress } from "@gasless-intents/interactions/contract-utils/shared/deployed-addresses";

const MESSAGE = "sanity-test";

async function main(): Promise<void> {
  const rawKey = process.env.SIGNER_PK;
  if (!rawKey) throw new Error("SIGNER_PK is not set in .env");
  const pk = (rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`) as Hex;
  const rpcUrl = process.env.BASE_RPC_URL || "https://mainnet.base.org";

  const address = requireDeployedAddress("EchoWithSig");
  const abi = loadAbi("EchoWithSig");
  const account = privateKeyToAccount(pk);
  const publicClient = createPublicClient({ chain: base, transport: http(rpcUrl) });
  const walletClient = createWalletClient({ account, chain: base, transport: http(rpcUrl) });

  console.log(`EchoWithSig: ${address}`);
  console.log(`Signer: ${account.address}`);

  const nonce = (`0x${randomBytes(32).toString("hex")}`) as Hex;
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);
  const signature = await account.signTypedData({
    domain: {
      name: "EchoWithSig",
      version: "1",
      chainId: base.id,
      verifyingContract: address,
    },
    types: {
      EchoMessage: [
        { name: "user", type: "address" },
        { name: "nonce", type: "bytes32" },
        { name: "message", type: "string" },
        { name: "deadline", type: "uint256" },
      ],
    },
    primaryType: "EchoMessage",
    message: { user: account.address, nonce, message: MESSAGE, deadline },
  });
  console.log(`  nonce: ${nonce}`);
  console.log(`  deadline: ${deadline}`);
  console.log(`  signature (${(signature.length - 2) / 2} bytes): ${signature}`);

  const hash = await walletClient.writeContract({
    address,
    abi,
    functionName: "echoWithSig",
    args: [account.address, nonce, MESSAGE, deadline, signature],
    account,
    chain: base,
    gas: 120_000n,
  } as any);
  console.log(`  Tx: ${hash} (https://basescan.org/tx/${hash})`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") {
    throw new Error(`echoWithSig reverted in tx ${hash}`);
  }
  const log = (receipt.logs as unknown as Array<{ topics: readonly Hex[]; data: Hex }>).find(
    (l) => l.topics && l.topics[0] !== undefined,
  );
  if (!log) throw new Error("No MessageEchoed event in receipt");
  const decoded = decodeEventLog({
    abi,
    eventName: "MessageEchoed",
    data: log.data,
    topics: log.topics as [signature: Hex, ...args: Hex[]],
  });
  const args = decoded.args as unknown as { user: Address; nonce: Hex; message: string; signature: Hex };
  if (args.user.toLowerCase() !== account.address.toLowerCase()) {
    throw new Error(`Event user ${args.user} != signer ${account.address}`);
  }
  if (args.nonce.toLowerCase() !== nonce.toLowerCase()) {
    throw new Error("Event nonce mismatch");
  }
  if (args.message !== MESSAGE) {
    throw new Error("Event message mismatch");
  }
  console.log("  Confirmed: MessageEchoed matches signed payload");
  console.log("Done.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
