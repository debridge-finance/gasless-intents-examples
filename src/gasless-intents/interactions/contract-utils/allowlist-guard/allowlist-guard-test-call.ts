/**
 * 5-step on-chain sanity test for the deployed EIP-712 AllowlistGuard:
 *   1. onPreCall with a valid signature for an un-allowlisted subject → revert NotAllowed.
 *   2. setAllowed(deployer, true).
 *   3. onPreCall with a fresh signature → succeed + emit AllowedCallLogged.
 *   4. onPreCall with the SAME signature → revert NonceUsed.
 *   5. setAllowed(deployer, false) (restore).
 *
 * Each call signs the AllowlistAuthorization struct off-chain with the
 * deployer's key, encodes the payload, and submits it as if the IntentManager
 * had bundled it.
 */
import { privateKeyToAccount } from "viem/accounts";
import { decodeEventLog, type Hex } from "viem";
import {
  buildAllowlistPayload,
  freshAllowlistNonce,
  signAllowlistAuthorization,
  encodeAllowlistPayload,
} from "../../helpers/allowlist-payload";
import { loadAbi } from "../shared/artefact-loader";
import { requireDeployedAddress } from "../shared/deployed-addresses";
import {
  ZERO_BYTES32,
  firstEventLog,
  getBaseClients,
  readView,
  writeTx,
} from "../shared/base-clients";

async function main(): Promise<void> {
  const rawKey = process.env.SIGNER_PK;
  if (!rawKey) throw new Error("SIGNER_PK is not set in .env");
  const pk = (rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`) as Hex;
  const signingAccount = privateKeyToAccount(pk);

  const address = requireDeployedAddress("AllowlistGuard");
  const abi = loadAbi("AllowlistGuard");
  const { account, publicClient, walletClient } = getBaseClients();
  if (account.address.toLowerCase() !== signingAccount.address.toLowerCase()) {
    throw new Error("SIGNER_PK mismatch between getBaseClients() and signingAccount");
  }

  console.log(`AllowlistGuard: ${address}`);
  console.log(`Signer: ${account.address}`);

  const initiallyAllowed = await readView<boolean>(publicClient, {
    address,
    abi,
    functionName: "allowed",
    args: [account.address],
  });
  if (initiallyAllowed) {
    console.log(`  (resetting: setAllowed(deployer, false))`);
    const resetHash = await writeTx(walletClient, publicClient, account, {
      address,
      abi,
      functionName: "setAllowed",
      args: [account.address, false],
    });
    await publicClient.waitForTransactionReceipt({ hash: resetHash });
  }

  console.log("Step 1/5: onPreCall with valid sig but un-allowlisted subject (expect NotAllowed)");
  const built1 = await buildAllowlistPayload({
    account: signingAccount,
    guardAddress: address,
    chainId: 8453,
  });
  try {
    await publicClient.simulateContract({
      address,
      abi,
      functionName: "onPreCall",
      args: [ZERO_BYTES32, ZERO_BYTES32, built1.payload],
      account,
    } as any);
    throw new Error("Expected NotAllowed revert");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!/NotAllowed/.test(msg)) throw new Error(`Expected NotAllowed, got: ${msg}`);
    console.log("  Confirmed: NotAllowed revert");
  }

  console.log("Step 2/5: setAllowed(deployer, true)");
  const setHash = await writeTx(walletClient, publicClient, account, {
    address,
    abi,
    functionName: "setAllowed",
    args: [account.address, true],
  });
  console.log(`  Tx: ${setHash}`);
  await publicClient.waitForTransactionReceipt({ hash: setHash });

  console.log("Step 3/5: onPreCall with fresh sig (expect success + AllowedCallLogged)");
  const nonce3 = freshAllowlistNonce();
  const deadline3 = BigInt(Math.floor(Date.now() / 1000) + 3600);
  const sig3 = await signAllowlistAuthorization({
    account: signingAccount,
    guardAddress: address,
    chainId: 8453,
    subject: account.address,
    nonce: nonce3,
    deadline: deadline3,
  });
  const payload3 = encodeAllowlistPayload(account.address, nonce3, deadline3, sig3);
  const callHash = await writeTx(walletClient, publicClient, account, {
    address,
    abi,
    functionName: "onPreCall",
    args: [ZERO_BYTES32, ZERO_BYTES32, payload3],
  });
  console.log(`  Tx: ${callHash}`);
  const callReceipt = await publicClient.waitForTransactionReceipt({ hash: callHash });
  if (callReceipt.status !== "success") {
    throw new Error(`onPreCall reverted in tx ${callHash}`);
  }
  const log = firstEventLog(callReceipt.logs);
  const decoded = decodeEventLog({
    abi,
    eventName: "AllowedCallLogged",
    data: log.data,
    topics: log.topics as [signature: Hex, ...args: Hex[]],
  });
  const args = decoded.args as unknown as { subject: Hex; nonce: Hex };
  if (args.subject.toLowerCase() !== account.address.toLowerCase()) {
    throw new Error(`Event subject ${args.subject} != deployer ${account.address}`);
  }
  if (args.nonce.toLowerCase() !== nonce3.toLowerCase()) {
    throw new Error(`Event nonce ${args.nonce} != submitted ${nonce3}`);
  }
  console.log(`  Confirmed: AllowedCallLogged subject=${args.subject} nonce=${args.nonce}`);

  console.log("Step 4/5: onPreCall replaying the same payload (expect NonceUsed)");
  try {
    await publicClient.simulateContract({
      address,
      abi,
      functionName: "onPreCall",
      args: [ZERO_BYTES32, ZERO_BYTES32, payload3],
      account,
    } as any);
    throw new Error("Expected NonceUsed revert");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!/NonceUsed/.test(msg)) throw new Error(`Expected NonceUsed, got: ${msg}`);
    console.log("  Confirmed: NonceUsed revert");
  }

  console.log("Step 5/5: setAllowed(deployer, false) (restore)");
  const revHash = await writeTx(walletClient, publicClient, account, {
    address,
    abi,
    functionName: "setAllowed",
    args: [account.address, false],
  });
  console.log(`  Tx: ${revHash}`);
  await publicClient.waitForTransactionReceipt({ hash: revHash });
  console.log("Done.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
