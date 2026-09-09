import "dotenv/config";
import { verifyOnBasescan } from "../../lib/etherscan-verify";

verifyOnBasescan({
  contractName: "LoggingInteractionHook",
  contractPath: "contracts/interactions/LoggingInteractionHook.sol",
  cliScriptName: "solidity/scripts/interactions/verify/verify-logging-interaction-hook.ts",
}).catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
