import { spawn, type ChildProcess } from "node:child_process";
import { randomBytes } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  createPublicClient,
  createWalletClient,
  decodeEventLog,
  encodeAbiParameters,
  encodeFunctionData,
  http,
  keccak256,
  parseAbi,
  stringToHex,
  type Abi,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts";
import { foundry } from "viem/chains";

const ANVIL_BIN = process.env.ANVIL_BIN || "/Users/damir/.foundry/bin/anvil";
const ANVIL_PORT = Number(process.env.ANVIL_PORT || 18545);
const RPC_URL = `http://127.0.0.1:${ANVIL_PORT}`;
const ARTIFACT_PATH = path.resolve(__dirname, "../../build-artefacts/EchoWithSig.json");

// Anvil's deterministic dev accounts
const USER_PK = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const SOLVER_PK = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";
const OTHER_PK = "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a";

const userAccount = privateKeyToAccount(USER_PK);
const solverAccount = privateKeyToAccount(SOLVER_PK);
const otherAccount = privateKeyToAccount(OTHER_PK);

const ECHO_ABI = parseAbi([
  "event MessageEchoed(address indexed user, bytes32 indexed nonce, string message, bytes signature)",
  "function echoWithSig(address user, bytes32 nonce, string calldata message, uint256 deadline, bytes calldata signature) external",
  "function usedNonces(address, bytes32) view returns (bool)",
  "function DOMAIN_SEPARATOR() view returns (bytes32)",
]);

let anvil: ChildProcess | null = null;
let testsPassed = 0;
let testsFailed = 0;

function pass(name: string): void {
  testsPassed++;
  console.log(`  PASS  ${name}`);
}

function fail(name: string, err: unknown): void {
  testsFailed++;
  const msg = err instanceof Error ? err.message : String(err);
  console.log(`  FAIL  ${name}\n        ${msg.split("\n")[0]}`);
}

async function withCase(name: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
    pass(name);
  } catch (err) {
    fail(name, err);
  }
}

async function expectRevert(
  name: string,
  fn: () => Promise<unknown>,
  reason: string,
): Promise<void> {
  try {
    await fn();
    fail(name, `expected revert "${reason}" but call succeeded`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes(reason)) pass(name);
    else fail(name, `expected revert "${reason}" — got: ${msg.split("\n")[0]}`);
  }
}

async function startAnvil(): Promise<void> {
  console.log(`Starting anvil on port ${ANVIL_PORT}...`);
  anvil = spawn(ANVIL_BIN, ["--port", String(ANVIL_PORT), "--silent"]);
  anvil.on("error", (err) => {
    console.error("anvil failed to spawn:", err);
    process.exit(1);
  });

  const probe = createPublicClient({ chain: foundry, transport: http(RPC_URL) });
  const start = Date.now();
  while (Date.now() - start < 10_000) {
    try {
      await probe.getBlockNumber();
      console.log("anvil ready");
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  throw new Error(`anvil did not become ready within 10s on ${RPC_URL}`);
}

function stopAnvil(): void {
  if (anvil && !anvil.killed) {
    anvil.kill("SIGKILL");
    anvil = null;
  }
}

process.on("exit", stopAnvil);
process.on("SIGINT", () => {
  stopAnvil();
  process.exit(130);
});
process.on("SIGTERM", () => {
  stopAnvil();
  process.exit(143);
});

type EchoMsg = {
  user: Address;
  nonce: Hex;
  message: string;
  deadline: bigint;
};

async function main(): Promise<void> {
  if (!fs.existsSync(ARTIFACT_PATH)) {
    throw new Error(`Artifact not found at ${ARTIFACT_PATH}. Run build-artefacts.ts first.`);
  }
  const artifact = JSON.parse(fs.readFileSync(ARTIFACT_PATH, "utf8"));
  const abi = artifact.abi as Abi;
  const bytecodeRaw = artifact.data.bytecode.object as string;
  const bytecode = (bytecodeRaw.startsWith("0x") ? bytecodeRaw : `0x${bytecodeRaw}`) as Hex;

  await startAnvil();

  const publicClient = createPublicClient({ chain: foundry, transport: http(RPC_URL) });
  const userClient = createWalletClient({
    account: userAccount,
    chain: foundry,
    transport: http(RPC_URL),
  });
  const solverClient = createWalletClient({
    account: solverAccount,
    chain: foundry,
    transport: http(RPC_URL),
  });

  const chainId = await publicClient.getChainId();
  console.log(`chainId: ${chainId} (anvil)`);
  console.log(`user:    ${userAccount.address}`);
  console.log(`solver:  ${solverAccount.address}`);
  console.log();

  console.log("Deploying EchoWithSig...");
  const deployHash = await userClient.deployContract({ abi, bytecode, args: [] });
  const deployReceipt = await publicClient.waitForTransactionReceipt({ hash: deployHash });
  if (deployReceipt.status !== "success") throw new Error("deploy reverted");
  const echo = deployReceipt.contractAddress as Address;
  if (!echo) throw new Error("no contract address in receipt");
  console.log(`EchoWithSig: ${echo}`);
  console.log();

  const buildMsg = (override: Partial<EchoMsg> = {}): EchoMsg => ({
    user: override.user ?? userAccount.address,
    nonce: override.nonce ?? ((`0x${randomBytes(32).toString("hex")}`) as Hex),
    message: override.message ?? "hello from local test",
    deadline: override.deadline ?? BigInt(Math.floor(Date.now() / 1000) + 3600),
  });

  const signMsg = (signer: PrivateKeyAccount, msg: EchoMsg): Promise<Hex> =>
    signer.signTypedData({
      domain: { name: "EchoWithSig", version: "1", chainId, verifyingContract: echo },
      types: {
        EchoMessage: [
          { name: "user", type: "address" },
          { name: "nonce", type: "bytes32" },
          { name: "message", type: "string" },
          { name: "deadline", type: "uint256" },
        ],
      },
      primaryType: "EchoMessage",
      message: { user: msg.user, nonce: msg.nonce, message: msg.message, deadline: msg.deadline },
    });

  console.log("Tests:");

  // 1) DOMAIN_SEPARATOR matches off-chain re-derivation
  await withCase("DOMAIN_SEPARATOR matches off-chain re-derivation", async () => {
    const onChain = (await publicClient.readContract({
      address: echo,
      abi,
      functionName: "DOMAIN_SEPARATOR",
    })) as Hex;
    const eip712TypeHash = keccak256(
      stringToHex(
        "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)",
      ),
    );
    const offChain = keccak256(
      encodeAbiParameters(
        [
          { type: "bytes32" },
          { type: "bytes32" },
          { type: "bytes32" },
          { type: "uint256" },
          { type: "address" },
        ],
        [
          eip712TypeHash,
          keccak256(stringToHex("EchoWithSig")),
          keccak256(stringToHex("1")),
          BigInt(chainId),
          echo,
        ],
      ),
    );
    if (onChain.toLowerCase() !== offChain.toLowerCase()) {
      throw new Error(`onChain=${onChain} offChain=${offChain}`);
    }
  });

  // Hold a single happy-path tuple so the "nonce used" test can replay it.
  const happyMsg = buildMsg();
  const happySig = await signMsg(userAccount, happyMsg);

  // 2) Happy path: user signs, solver sends, event emitted, usedNonces flips
  await withCase("happy path (user signs, solver sends) emits MessageEchoed + flips usedNonces", async () => {
    if ((happySig.length - 2) / 2 !== 65) {
      throw new Error(`signature length ${(happySig.length - 2) / 2} != 65`);
    }
    const hash = await solverClient.writeContract({
      address: echo,
      abi,
      functionName: "echoWithSig",
      args: [happyMsg.user, happyMsg.nonce, happyMsg.message, happyMsg.deadline, happySig],
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") throw new Error("tx reverted");
    if (receipt.logs.length === 0) throw new Error("no logs emitted");

    const decoded = decodeEventLog({
      abi,
      eventName: "MessageEchoed",
      data: receipt.logs[0].data,
      topics: receipt.logs[0].topics,
    });
    const args = decoded.args as {
      user: Address;
      nonce: Hex;
      message: string;
      signature: Hex;
    };
    if (args.user.toLowerCase() !== happyMsg.user.toLowerCase()) {
      throw new Error("event user mismatch");
    }
    if (args.nonce.toLowerCase() !== happyMsg.nonce.toLowerCase()) {
      throw new Error("event nonce mismatch");
    }
    if (args.message !== happyMsg.message) throw new Error("event message mismatch");
    if (args.signature.toLowerCase() !== happySig.toLowerCase()) {
      throw new Error("event signature mismatch");
    }

    const used = await publicClient.readContract({
      address: echo,
      abi,
      functionName: "usedNonces",
      args: [happyMsg.user, happyMsg.nonce],
    });
    if (used !== true) throw new Error(`usedNonces returned ${used}`);
  });

  // 3) expired deadline
  await expectRevert(
    "rejects expired deadline",
    async () => {
      const msg = buildMsg({ deadline: BigInt(Math.floor(Date.now() / 1000) - 60) });
      const sig = await signMsg(userAccount, msg);
      await publicClient.simulateContract({
        account: solverAccount,
        address: echo,
        abi,
        functionName: "echoWithSig",
        args: [msg.user, msg.nonce, msg.message, msg.deadline, sig],
      });
    },
    "Echo: expired",
  );

  // 4) replayed nonce
  await expectRevert(
    "rejects replayed nonce",
    async () => {
      await publicClient.simulateContract({
        account: solverAccount,
        address: echo,
        abi,
        functionName: "echoWithSig",
        args: [happyMsg.user, happyMsg.nonce, happyMsg.message, happyMsg.deadline, happySig],
      });
    },
    "Echo: nonce used",
  );

  // 5) 64-byte signature
  await expectRevert(
    "rejects 64-byte signature",
    async () => {
      const msg = buildMsg();
      const sig = await signMsg(userAccount, msg);
      const truncated = sig.slice(0, sig.length - 2) as Hex; // drop v byte → 64 bytes
      await publicClient.simulateContract({
        account: solverAccount,
        address: echo,
        abi,
        functionName: "echoWithSig",
        args: [msg.user, msg.nonce, msg.message, msg.deadline, truncated],
      });
    },
    "Echo: bad sig length",
  );

  // 6) signed by user, but user field is otherAccount
  await expectRevert(
    "rejects mismatched user (signed by A, claims to be B)",
    async () => {
      const msg = buildMsg({ user: otherAccount.address });
      const sig = await signMsg(userAccount, msg); // signed by userAccount, not otherAccount
      await publicClient.simulateContract({
        account: solverAccount,
        address: echo,
        abi,
        functionName: "echoWithSig",
        args: [msg.user, msg.nonce, msg.message, msg.deadline, sig],
      });
    },
    "Echo: bad sig",
  );

  // 7) Placeholder substitution: build template, substitute marker, compare to direct
  //    encoding, then send the substituted calldata raw — proves the deBridge API's
  //    substitution semantics work against this contract.
  await withCase(
    "placeholder substitution recipe matches direct encoding + works on-chain",
    async () => {
      const subMsg = buildMsg();
      const subSig = await signMsg(userAccount, subMsg);

      // Anton's recipe: encode with 65-byte dummy sig; replace last 192 hex chars
      // (= 96 bytes = 65 sig + 31 zero pad) with marker + 31 zero bytes.
      const dummySig = (`0x${"00".repeat(65)}`) as Hex;
      const templateBase = encodeFunctionData({
        abi,
        functionName: "echoWithSig",
        args: [subMsg.user, subMsg.nonce, subMsg.message, subMsg.deadline, dummySig],
      });
      const head = templateBase.slice(0, templateBase.length - 192);
      const template = head + "{signature.65}" + "00".repeat(31);

      // API-side: substitute the 14-char marker for the 130-hex-char sig (no 0x prefix).
      const substituted = template.replace("{signature.65}", subSig.slice(2)) as Hex;

      // Direct encoding with the real sig — must be byte-equal.
      const direct = encodeFunctionData({
        abi,
        functionName: "echoWithSig",
        args: [subMsg.user, subMsg.nonce, subMsg.message, subMsg.deadline, subSig],
      });

      if (substituted.toLowerCase() !== direct.toLowerCase()) {
        throw new Error(
          `substituted calldata != direct encoding\n  substituted: ${substituted}\n  direct:      ${direct}`,
        );
      }

      // Round-trip: send the substituted calldata via raw sendTransaction.
      const hash = await solverClient.sendTransaction({ to: echo, data: substituted });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") throw new Error("tx reverted on-chain");
      if (receipt.logs.length === 0) throw new Error("no logs emitted");
      const decoded = decodeEventLog({
        abi,
        eventName: "MessageEchoed",
        data: receipt.logs[0].data,
        topics: receipt.logs[0].topics,
      });
      const args = decoded.args as { signature: Hex };
      if (args.signature.toLowerCase() !== subSig.toLowerCase()) {
        throw new Error("event signature != real sig");
      }
    },
  );

  console.log();
  console.log(`────── ${testsPassed} passed, ${testsFailed} failed ──────`);

  if (testsFailed > 0) process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error("\nFATAL:", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(stopAnvil);
