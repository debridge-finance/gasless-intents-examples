import { encodeAbiParameters, decodeEventLog, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";
import { randomBytes } from "node:crypto";
import { deployToBase, ZERO_BYTES32 } from "../lib/deploy-lib";

const ALLOWLIST_PAYLOAD_ABI = [
  { type: "address" },
  { type: "bytes32" },
  { type: "uint256" },
  { type: "bytes" },
] as const;

async function signAuthorization(opts: {
  privateKey: Hex;
  guardAddress: `0x${string}`;
  subject: `0x${string}`;
  nonce: Hex;
  deadline: bigint;
}): Promise<Hex> {
  const acct = privateKeyToAccount(opts.privateKey);
  return acct.signTypedData({
    domain: {
      name: "AllowlistGuard",
      version: "1",
      chainId: base.id,
      verifyingContract: opts.guardAddress,
    },
    types: {
      AllowlistAuthorization: [
        { name: "subject", type: "address" },
        { name: "nonce", type: "bytes32" },
        { name: "deadline", type: "uint256" },
      ],
    },
    primaryType: "AllowlistAuthorization",
    message: { subject: opts.subject, nonce: opts.nonce, deadline: opts.deadline },
  });
}

async function main(): Promise<void> {
  const ctx = await deployToBase({ contractName: "AllowlistGuard" });

  const rawKey = process.env.SIGNER_PK!;
  const pk = (rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`) as Hex;

  // Build a fresh signed payload for each step (the same payload is also fine
  // for steps 1 and 3 since step 1 only simulates — but we use distinct
  // nonces so step 3 doesn't trip "NonceUsed" if anyone replays step 1).
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);

  const buildPayload = async (): Promise<Hex> => {
    const nonce = ("0x" + randomBytes(32).toString("hex")) as Hex;
    const signature = await signAuthorization({
      privateKey: pk,
      guardAddress: ctx.contractAddress,
      subject: ctx.account.address,
      nonce,
      deadline,
    });
    return encodeAbiParameters(ALLOWLIST_PAYLOAD_ABI, [
      ctx.account.address,
      nonce,
      deadline,
      signature,
    ]);
  };

  // Step 1: call with un-allowlisted subject (valid signature, allowlist empty) → revert NotAllowed.
  console.log("Sanity step 1/3: onPreCall() against un-allowlisted subject (expect revert)...");
  const payload1 = await buildPayload();
  try {
    await ctx.publicClient.simulateContract({
      address: ctx.contractAddress,
      abi: ctx.abi,
      functionName: "onPreCall",
      args: [ZERO_BYTES32, ZERO_BYTES32, payload1],
      account: ctx.account,
    });
    throw new Error("Expected revert from onPreCall() with un-allowlisted subject");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!/NotAllowed/.test(msg)) {
      throw new Error(`Expected NotAllowed revert, got: ${msg}`);
    }
    console.log("  Confirmed: revert with NotAllowed");
  }

  // Step 2: allowlist the deployer's address.
  console.log("Sanity step 2/3: setAllowed(deployer, true)...");
  const setHash = await ctx.walletClient.writeContract({
    address: ctx.contractAddress,
    abi: ctx.abi,
    functionName: "setAllowed",
    args: [ctx.account.address, true],
    account: ctx.account,
    chain: base,
    gas: 200_000n,
  });
  console.log(`  Tx: ${setHash} (https://basescan.org/tx/${setHash})`);
  const setReceipt = await ctx.publicClient.waitForTransactionReceipt({ hash: setHash });
  if (setReceipt.status !== "success") {
    throw new Error(`setAllowed() reverted in tx ${setHash}`);
  }
  // Alchemy in-flight rate-limit buffer (see deploy-lib.ts).
  await new Promise((r) => setTimeout(r, 4000));

  // Step 3: call onPreCall with a fresh signed payload — must succeed and emit AllowedCallLogged.
  console.log("Sanity step 3/3: onPreCall() against allowlisted subject (expect success)...");
  const payload3 = await buildPayload();
  const callHash = await ctx.walletClient.writeContract({
    address: ctx.contractAddress,
    abi: ctx.abi,
    functionName: "onPreCall",
    args: [ZERO_BYTES32, ZERO_BYTES32, payload3],
    account: ctx.account,
    chain: base,
    gas: 200_000n,
  });
  console.log(`  Tx: ${callHash} (https://basescan.org/tx/${callHash})`);
  const callReceipt = await ctx.publicClient.waitForTransactionReceipt({ hash: callHash });
  if (callReceipt.status !== "success") {
    throw new Error(`onPreCall() reverted in tx ${callHash}`);
  }
  const allowedLog = callReceipt.logs.find((l) => l.topics[0] !== undefined);
  if (!allowedLog) throw new Error("No AllowedCallLogged event in receipt");
  const decoded = decodeEventLog({
    abi: ctx.abi,
    eventName: "AllowedCallLogged",
    data: allowedLog.data,
    topics: allowedLog.topics,
  });
  const args = decoded.args as { subject: Hex; nonce: Hex };
  if (args.subject.toLowerCase() !== ctx.account.address.toLowerCase()) {
    throw new Error(`Event subject ${args.subject} != deployer ${ctx.account.address}`);
  }
  console.log(`  Confirmed: AllowedCallLogged subject=${args.subject} nonce=${args.nonce}`);
  console.log("Done.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
