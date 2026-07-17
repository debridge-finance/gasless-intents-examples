import "dotenv/config";
import { verifyOnBasescan } from "../../lib/etherscan-verify";

verifyOnBasescan({
  contractName: "IntentSubmitter",
  contractPath: "contracts/submitter/IntentSubmitter.sol",
  cliScriptName: "solidity/scripts/submitter/verify/verify-intent-submitter.ts",
}).catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
