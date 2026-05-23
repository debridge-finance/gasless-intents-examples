import "dotenv/config";
import { verifyOnBasescan } from "../lib/etherscan-verify";

verifyOnBasescan({
  contractName: "ProtocolFeeRecorder",
  contractPath: "contracts/interactions/ProtocolFeeRecorder.sol",
  cliScriptName: "solidity/scripts/interactions/verify-protocol-fee-recorder.ts",
}).catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
