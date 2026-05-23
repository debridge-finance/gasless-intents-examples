/**
 * Direct on-chain test of the deployed FillCapEnforcer.
 *   1. setCap(deployer, 1)
 *   2. onPreCall against a fresh intentId → succeeds (fill=1 ≤ cap=1)
 *   3. onPreCall against the SAME intentId → reverts HardCapExceeded
 *   4. setCap(deployer, 0) (restore)
 */
import * as crypto from "node:crypto";
import { encodeAbiParameters, type Hex } from "viem";
import { loadAbi } from "../shared/artefact-loader";
import { requireDeployedAddress } from "../shared/deployed-addresses";
import { getBaseClients, writeTx } from "../shared/base-clients";

const SUBJECT_ONLY_ABI = [{ type: "address" }] as const;

function freshHex32(): Hex {
  return ("0x" + crypto.randomBytes(32).toString("hex")) as Hex;
}

async function main(): Promise<void> {
  const address = requireDeployedAddress("FillCapEnforcer");
  const abi = loadAbi("FillCapEnforcer");
  const { account, publicClient, walletClient } = getBaseClients();

  console.log(`FillCapEnforcer: ${address}`);
  const payload = encodeAbiParameters(SUBJECT_ONLY_ABI, [account.address]);
  const intentId = freshHex32();
  const tradeId = freshHex32();

  console.log("Step 1/4: setCap(deployer, 1)");
  const setHash = await writeTx(walletClient, publicClient, account, {
    address,
    abi,
    functionName: "setCap",
    args: [account.address, 1n],
  });
  console.log(`  Tx: ${setHash}`);
  await publicClient.waitForTransactionReceipt({ hash: setHash });

  console.log("Step 2/4: onPreCall fresh intentId (expect success)");
  const okHash = await writeTx(walletClient, publicClient, account, {
    address,
    abi,
    functionName: "onPreCall",
    args: [intentId, tradeId, payload],
  });
  console.log(`  Tx: ${okHash}`);
  const okReceipt = await publicClient.waitForTransactionReceipt({ hash: okHash });
  if (okReceipt.status !== "success") throw new Error("first onPreCall reverted");

  console.log("Step 3/4: onPreCall same intentId (expect HardCapExceeded)");
  try {
    await publicClient.simulateContract({
      address,
      abi,
      functionName: "onPreCall",
      args: [intentId, tradeId, payload],
      account,
    } as any);
    throw new Error("Expected HardCapExceeded revert");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!/HardCapExceeded/.test(msg)) throw new Error(`Expected HardCapExceeded, got: ${msg}`);
    console.log("  Confirmed: HardCapExceeded revert");
  }

  console.log("Step 4/4: setCap(deployer, 0) (restore)");
  const restoreHash = await writeTx(walletClient, publicClient, account, {
    address,
    abi,
    functionName: "setCap",
    args: [account.address, 0n],
  });
  console.log(`  Tx: ${restoreHash}`);
  await publicClient.waitForTransactionReceipt({ hash: restoreHash });
  console.log("Done.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
