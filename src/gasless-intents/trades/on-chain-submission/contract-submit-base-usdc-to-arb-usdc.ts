/**
 * Contract-based on-chain intent submission — Base USDC -> Arbitrum USDC, 3.2 USDC,
 * submitted through a deployed IntentSubmitter (solidity/contracts/submitter/).
 *
 * Flow:
 *   1. Check the contract holds the input budget (it is the `intentOwner`,
 *      i.e. the account charged on fill) — fund it first via
 *      utility-scripts/erc20/fund-usdc-base.ts.
 *   2. createBundle (propose, AA disabled) with srcChainAuthorityAddress = the
 *      CONTRACT. Recipient / dst authority are hardcoded to match the deployed
 *      contract, so the intent passes _validate by construction.
 *   3. Rebuild the full IIntent.Intent struct and prove byte-parity:
 *      keccak256(abi.encode(struct)) === API intentId (the fill key solvers compute).
 *   4. IntentSubmitter.submitIntent(struct) — validates on-chain, MAX-approves
 *      the AllowanceHolder (first time), forwards to the IntentManager.
 *      The API's requiredActions are NOT executed: the Budget approve is
 *      replaced by the contract's self-approval.
 */
import { randomUUID } from "crypto";
import {
  createWalletClient,
  createPublicClient,
  http,
  formatUnits,
  type Hex,
  type PublicClient,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";

import { clipHexPrefix } from "@utils/string";
import { getEnvConfig } from "@utils/env";
import { createBundle } from "@utils/gasless-api";
import { USDC, DE_BRIDGE_CONTRACTS } from "@utils/constants";
import { CHAIN_IDS } from "@utils/chains";
import { IntentManagerAbi, IntentSubmitterAbi } from "@utils/contract-calls/abis";
import { erc20Balance } from "@utils/contract-calls/erc20";
import { assertIntentIdParity, buildIntentStruct, computeIntentId } from "@utils/intent-struct";
import { BundleProposeBody, TradingAlgorithm } from "@gasless-intents/types";

const USDC_BASE = USDC.Base as Hex;
const AMOUNT = 3_200_000n; // 3.2 USDC (6 decimals)

// IntentSubmitter on Base (deployed 2026-07-16, verified):
// https://basescan.org/address/0xd90994b6e13095e20c64a35bd22f45c271b784dc#code
const INTENT_SUBMITTER = "0xd90994b6e13095e20c64a35bd22f45c271b784dc" as Hex;

// Must match the deployed example contract: CONTRACT_OWNER = its `owner()`
// (the deployer), RECIPIENT = its hardcoded `RECIPIENT()` — _validate rejects
// any other receiver / dst authority.
const CONTRACT_OWNER = "0x55A8f5cce1d53D9Ff84EC0962882b447E5914dB8" as Hex;
const RECIPIENT = "0x55A8f5cce1d53D9Ff84EC0962882b447E5914dB8" as Hex;

async function main() {
  if (INTENT_SUBMITTER === "0x0000000000000000000000000000000000000000") {
    throw new Error("INTENT_SUBMITTER is not set — deploy the contract and hardcode its address");
  }

  const { privateKey } = getEnvConfig();
  const account = privateKeyToAccount(`0x${clipHexPrefix(privateKey)}`);
  const transport = process.env.BASE_RPC_URL ? http(process.env.BASE_RPC_URL) : http();
  const walletClient = createWalletClient({ account, chain: base, transport });
  const publicClient = createPublicClient({ chain: base, transport }) as unknown as PublicClient;

  console.log(`IntentSubmitter: ${INTENT_SUBMITTER}`);
  console.log(`owner:           ${CONTRACT_OWNER}`);
  console.log(`RECIPIENT:       ${RECIPIENT}`);
  console.log(`EOA (caller):    ${account.address}`);
  console.log("Trade: Base (8453) -> Arbitrum (42161), 3.2 USDC\n");
  if (CONTRACT_OWNER.toLowerCase() !== account.address.toLowerCase()) {
    throw new Error("SIGNER_PK is not the contract owner — submitIntent would revert NotOwner");
  }

  // 1) The contract is the charged account — it must hold the input budget
  //    before submission (fund it via utility-scripts/erc20/fund-usdc-base.ts).
  const contractBalance = await erc20Balance(publicClient, USDC_BASE, INTENT_SUBMITTER);
  console.log(`① Contract USDC balance: ${formatUnits(contractBalance, 6)} (budget ${formatUnits(AMOUNT, 6)})\n`);
  if (contractBalance < AMOUNT) {
    throw new Error(
      "Contract underfunded — top it up first:\n" +
        `  npx tsx src/gasless-intents/utility-scripts/erc20/fund-usdc-base.ts ${INTENT_SUBMITTER} ${formatUnits(AMOUNT, 6)}`,
    );
  }

  // 2) Propose: the CONTRACT is the src authority -> intentOwner.
  const requestBody: BundleProposeBody = {
    requestId: randomUUID(),
    expirationTimestamp: Math.floor((Date.now() * 2) / 1000),
    enableAccountAbstraction: false,
    isAtomic: true,
    tradingAlgorithm: TradingAlgorithm.MARKET,
    trades: [
      {
        srcChainId: CHAIN_IDS.Base,
        srcChainTokenIn: USDC_BASE,
        srcChainTokenInAmount: AMOUNT.toString(),
        dstChainId: CHAIN_IDS.Arbitrum,
        dstChainTokenOut: USDC.Arbitrum,
        dstChainTokenOutAmount: "auto",
        dstChainTokenOutRecipient: RECIPIENT,       // _validate: receiver == RECIPIENT
        srcChainAuthorityAddress: INTENT_SUBMITTER, // -> intentOwner == the contract
        dstChainAuthorityAddress: CONTRACT_OWNER,    // _validate: dstAuthority == owner
        prependOperatingExpenses: false
      },
    ],
    preHooks: [],
    postHooks: [],
  };

  console.log("② Proposing bundle (createBundle)...");
  const bundle = await createBundle(requestBody);
  const intent = bundle.intents?.[0]?.intent;
  if (!intent) throw new Error("Propose returned no intents");
  const intentId = intent.intentId as Hex;
  console.log(`   intentId:    ${intentId}`);
  console.log(`   intentOwner: ${intent.intentOwner}`);
  if (intent.intentOwner.toLowerCase() !== INTENT_SUBMITTER.toLowerCase()) {
    throw new Error("API did not set the contract as intentOwner — aborting");
  }

  // 3) Byte-parity gate: never submit a struct that doesn't hash to the API id.
  const intentStruct = buildIntentStruct(intent);
  assertIntentIdParity(intentStruct, intentId);
  console.log(`③ Rebuilt struct hashes to the API intentId ✅ (${computeIntentId(intentStruct)})\n`);

  // 4) Submit through the contract: validates, MAX-approves the AllowanceHolder
  //    (first time), forwards to the IntentManager — one transaction.
  console.log(`④ IntentSubmitter.submitIntent(fullIntent) -> ${INTENT_SUBMITTER}`);
  const submitHash = await walletClient.writeContract({
    address: INTENT_SUBMITTER,
    abi: IntentSubmitterAbi,
    functionName: "submitIntent",
    args: [intentStruct],
  } as any);
  const submitReceipt = await publicClient.waitForTransactionReceipt({ hash: submitHash });
  console.log(`   ${submitHash} (${submitReceipt.status})\n`);
}

main().catch((error) => {
  console.error("\n🚨 FATAL ERROR in script execution:", error);
  process.exitCode = 1;
});
