import { parseAbi, type Abi } from "viem";
import { INTENT_TUPLE } from "@utils/intent-struct";

/** ERC-20 */
export const Erc20Abi = {
  Balance: parseAbi(["function balanceOf(address account) view returns (uint256)"]),
  Approve: parseAbi(["function approve(address spender, uint256 amount)"]),
  Transfer: parseAbi(["function transfer(address to, uint256 amount)"]),
} as const;

/** ERC-4626 vaults */
export const Erc4626Abi = {
  Decimals: parseAbi(["function decimals() view returns (uint8)"]),
  ConvertToAssets: parseAbi(["function convertToAssets(uint256 shares) view returns (uint256)"]),
  Deposit: parseAbi(["function deposit(uint256 assets, address receiver)"]),
  Withdraw: parseAbi(["function withdraw(uint256 assets, address receiver, address owner)"]),
} as const;

/** Aave V3 */
export const AaveV3Abi = {
  Supply: parseAbi(["function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode)"]),
  Withdraw: parseAbi(["function withdraw(address asset, uint256 amount, address to)"]),
} as const;

/** Echo test contract */
export const EchoAbi = {
  Echo: parseAbi(["function echo(string message) external"]),
} as const;

/** EchoWithSig test contract */
export const EchoWithSigAbi = {
  EchoWithSig: parseAbi([
    "function echoWithSig(address user, bytes32 nonce, string message, uint256 deadline, bytes signature)",
    "event MessageEchoed(address indexed user, bytes32 indexed nonce, string message, bytes signature)",
  ]),
} as const;

/** deBridge IntentManager — the direct on-chain submission surface (verbose
 *  submitIntent + the authorization-flag read). Built as an object rather than
 *  via parseAbi because submitIntent takes the full IIntent.Intent tuple,
 *  reused from @utils/intent-struct. */
export const IntentManagerAbi = [
  {
    type: "function",
    name: "submitIntent",
    stateMutability: "nonpayable",
    inputs: [{ ...(INTENT_TUPLE[0] as object), name: "intent" }],
    outputs: [],
  },
  {
    type: "function",
    name: "isIntentSubmitted",
    stateMutability: "view",
    inputs: [
      { type: "address", name: "intentOwner" },
      { type: "bytes32", name: "intentId" },
    ],
    outputs: [{ type: "bool", name: "" }],
  },
] as unknown as Abi;

// IntentSubmitter (solidity/contracts/submitter/IntentSubmitter.sol).
export const IntentSubmitterAbi = [
  {
    type: "function",
    name: "submitIntent",
    stateMutability: "nonpayable",
    inputs: [{ ...(INTENT_TUPLE[0] as object), name: "intent" }],
    outputs: [{ type: "bytes32", name: "intentId" }],
  },
  {
    type: "function",
    name: "isIntentSubmitted",
    stateMutability: "view",
    inputs: [{ type: "bytes32", name: "intentId" }],
    outputs: [{ type: "bool", name: "" }],
  },
  { type: "function", name: "owner", stateMutability: "view", inputs: [], outputs: [{ type: "address", name: "" }] },
  { type: "function", name: "RECIPIENT", stateMutability: "view", inputs: [], outputs: [{ type: "address", name: "" }] },
] as unknown as Abi;
