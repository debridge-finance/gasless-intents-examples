/**
 * Read ProtocolFeeRecorder state.
 *
 * Usage:
 *   npx tsx .../protocol-fee-read.ts <intentId> <token>
 *   npx tsx .../protocol-fee-read.ts --token <token>           # tokenTotalFee only
 */
import { isAddress, isHex, type Address, type Hex } from "viem";
import { loadAbi } from "../shared/abis";
import { requireDeployedAddress } from "../../shared/deployed-addresses";
import { getBaseClients, readView } from "../shared/base-clients";

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  let intentId: Hex | null = null;
  let token: Address | null = null;
  if (args[0] === "--token") {
    if (!args[1] || !isAddress(args[1])) throw new Error("Invalid token address");
    token = args[1] as Address;
  } else {
    if (!args[0] || !isHex(args[0]) || args[0].length !== 66) throw new Error("Invalid intentId");
    if (!args[1] || !isAddress(args[1])) throw new Error("Invalid token address");
    intentId = args[0] as Hex;
    token = args[1] as Address;
  }

  const address = requireDeployedAddress("ProtocolFeeRecorder");
  const abi = loadAbi("ProtocolFeeRecorder");
  const { publicClient } = getBaseClients();

  const total = await readView<bigint>(publicClient, {
    address,
    abi,
    functionName: "tokenTotalFee",
    args: [token!],
  });

  console.log(`ProtocolFeeRecorder: ${address}`);
  console.log(`  tokenTotalFee[${token}]: ${total}`);
  if (intentId) {
    const perIntent = await readView<bigint>(publicClient, {
      address,
      abi,
      functionName: "intentTokenFee",
      args: [intentId, token!],
    });
    console.log(`  intentTokenFee[${intentId}][${token}]: ${perIntent}`);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
